"""Hostname/traffic parsing helpers, shared with capture_service.py.

Run this file directly to sniff on an interface from a terminal, without
starting the full API - useful for a quick sanity check that Npcap and
the hotspot adapter are working before relying on the dashboard.
"""

import re
import time
import argparse
import threading

from scapy.all import sniff, IP, TCP, Raw, DNS, DNSQR
from scapy.arch.windows import get_windows_if_list

from common_services import NOISE_KEYWORDS, ORGANISATION_LABELS, ORG_DEDUP_WINDOW_SECONDS

HTTP_METHODS = (b"GET ", b"POST ", b"PUT ", b"HEAD ", b"DELETE ", b"OPTIONS ")

# Rejects corrupted/garbage strings (e.g. a TLS ClientHello split across
# multiple TCP segments) instead of treating them as a real hostname.
_HOSTNAME_RE = re.compile(
    r"^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$"
)

# IP -> hostname, learned from DNS responses so later packets to that IP
# can be labelled instead of showing a raw address.
_ip_to_hostname = {}

def _is_background_noise(hostname):
    lowered = hostname.lower()
    return any(keyword in lowered for keyword in NOISE_KEYWORDS)


# Many apps spread traffic across several different-looking subdomains of
# the same underlying service (opening Reddit alone touched reddit.com,
# redd.it, redditmedia.com, and redditspace.com). Rather than showing each
# one as a separate line, known subdomains (see common_services.py) are
# grouped under one friendly organisation label and only announced once per
# ORG_DEDUP_WINDOW_SECONDS.


def _organisation_for(hostname):
    lowered = hostname.lower()
    for suffix, label in ORGANISATION_LABELS.items():
        if lowered == suffix or lowered.endswith("." + suffix):
            return label
    return None


def _looks_like_hostname(value):
    return bool(value) and len(value) <= 255 and bool(_HOSTNAME_RE.match(value))


def _remember_dns_answers(dns_layer):
    """Learn IP -> hostname mappings from a DNS response, so later packets
    to that IP can be shown with a friendly name instead of a raw address."""
    if dns_layer.qr != 1 or not dns_layer.an or not dns_layer.qd:
        return  # only interested in responses that answered a question

    query_name = dns_layer.qd.qname.decode(errors="ignore").rstrip(".")
    if not query_name or query_name.lower().endswith(".local"):
        return  # ignore mDNS/local device discovery noise

    for i in range(dns_layer.ancount):
        try:
            answer = dns_layer.an[i]
        except (IndexError, TypeError, AttributeError):
            break
        if getattr(answer, "type", None) in (1, 28) and getattr(answer, "rdata", None):
            _ip_to_hostname[answer.rdata] = query_name


def extract_sni(raw_bytes):
    """Best-effort parse of the hostname from a TLS ClientHello.

    The TLS handshake (including the "Server Name Indication" extension) is
    always sent in plaintext - encryption only starts afterwards. So this is
    reading metadata anyone on the network could already see, not decrypting
    anything. Returns None if this isn't a (complete) ClientHello or has no
    valid-looking SNI.
    """
    try:
        if len(raw_bytes) < 6 or raw_bytes[0] != 0x16 or raw_bytes[5] != 0x01:
            return None  # not a TLS handshake / not a ClientHello

        # A ClientHello with many extensions is often bigger than one TCP
        # segment (~1400 bytes) and gets split across multiple packets. We
        # only see one segment at a time here, so if the record's declared
        # length is bigger than what we actually captured, bail out instead
        # of parsing partial/garbage data.
        record_len = int.from_bytes(raw_bytes[3:5], "big")
        if record_len + 5 > len(raw_bytes):
            return None

        offset = 43  # record header(5) + handshake header(4) + version(2) + random(32)
        offset += 1 + raw_bytes[offset]  # skip session id
        cipher_suites_len = int.from_bytes(raw_bytes[offset:offset + 2], "big")
        offset += 2 + cipher_suites_len
        offset += 1 + raw_bytes[offset]  # skip compression methods

        extensions_len = int.from_bytes(raw_bytes[offset:offset + 2], "big")
        offset += 2
        extensions_end = offset + extensions_len
        if extensions_end > len(raw_bytes):
            return None

        while offset < extensions_end:
            ext_type = int.from_bytes(raw_bytes[offset:offset + 2], "big")
            ext_len = int.from_bytes(raw_bytes[offset + 2:offset + 4], "big")
            if ext_type == 0x00:  # server_name extension
                name_len = int.from_bytes(raw_bytes[offset + 9:offset + 11], "big")
                name_start = offset + 11
                hostname = raw_bytes[name_start:name_start + name_len].decode(errors="ignore")
                return hostname if _looks_like_hostname(hostname) else None
            offset += 4 + ext_len
    except (IndexError, UnicodeDecodeError):
        return None
    return None


def describe_packet(packet):
    """Print one line per recognised app event, deduped against recent
    repeats. Mirrors the logic capture_service.py uses for the dashboard,
    so a terminal run shows the same events the web app would.
    """
    if not packet.haslayer(IP):
        return

    src = packet[IP].src
    dst = packet[IP].dst

    if packet.haslayer(DNS):
        _remember_dns_answers(packet[DNS])

    if packet.haslayer(DNSQR) and packet[DNS].qr == 0:
        hostname = packet[DNSQR].qname.decode(errors="ignore").rstrip(".")
        _show_if_recognised(src, hostname)
        return

    if not packet.haslayer(TCP):
        return

    tcp = packet[TCP]
    if tcp.flags == "S":
        _show_if_recognised(src, _ip_to_hostname.get(dst))
        return

    if not packet.haslayer(Raw):
        return

    payload = bytes(packet[Raw].load)
    if tcp.dport == 80 and payload.startswith(HTTP_METHODS):
        lines = payload.split(b"\r\n")
        host = next(
            (line.decode(errors="ignore").split(": ", 1)[1] for line in lines
             if line.lower().startswith(b"host:") and b": " in line),
            None,
        )
        _show_if_recognised(src, host)
    elif tcp.dport == 443:
        _show_if_recognised(src, extract_sni(payload))


_last_shown = {}


def _show_if_recognised(device_ip, hostname):
    if not hostname or _is_background_noise(hostname):
        return

    org = _organisation_for(hostname)
    if org is None:
        return

    key = (device_ip, org)
    now = time.monotonic()
    last_seen = _last_shown.get(key)
    _last_shown[key] = now
    if last_seen is not None and now - last_seen < ORG_DEDUP_WINDOW_SECONDS:
        return

    print(f"{device_ip} is using {org}")


# Debug / verbose packet counting
_PACKET_COUNT = 0
_PACKET_COUNT_LOCK = threading.Lock()
VERBOSE = False


def _pps_reporter():
    """Background thread that prints packets-per-second once per second."""
    global _PACKET_COUNT
    while True:
        time.sleep(1)
        with _PACKET_COUNT_LOCK:
            cnt = _PACKET_COUNT
            _PACKET_COUNT = 0
        print(f"[pps] {cnt} packets/s")


def _handle_packet_verbose(packet):
    """Wrapper for sniff() that optionally prints each packet and counts PPS.

    The original, human-friendly event printing is still produced by
    `describe_packet()`. When `--verbose` is passed the script will also
    print one-line summaries for every captured packet and a PPS metric.
    """
    global _PACKET_COUNT
    with _PACKET_COUNT_LOCK:
        _PACKET_COUNT += 1

    def _label_for(ip_addr: str) -> str:
        """Return a readable label for an IP if available, otherwise the IP.

        Uses learned DNS answers stored in `_ip_to_hostname`. If a hostname
        maps to a known organisation (via `_organisation_for`) include the
        organisation label for readability.
        """
        if not ip_addr:
            return ""
        name = _ip_to_hostname.get(ip_addr)
        if name:
            org = _organisation_for(name)
            return f"{org} ({name})" if org else name
        return ip_addr

    if VERBOSE:
        try:
            if packet.haslayer(IP):
                src = packet[IP].src
                dst = packet[IP].dst
                src_label = _label_for(src)
                dst_label = _label_for(dst)

                # Classify packets into a short human-friendly event type
                evt = "IP"
                if packet.haslayer(DNS):
                    evt = "DNS"
                elif packet.haslayer(Raw) and packet.haslayer(TCP):
                    tcp = packet[TCP]
                    payload = bytes(packet[Raw].load)
                    if tcp.dport == 80 and payload.startswith(HTTP_METHODS):
                        evt = "HTTP"
                    elif tcp.dport == 443:
                        evt = "TLS"
                    else:
                        evt = f"TCP:{tcp.sport}->{tcp.dport}"

                print(f"{time.time():.3f} {src_label} -> {dst_label} [{evt}]")
            else:
                # Non-IP packet fallback
                print(f"{time.time():.3f} {packet.summary()}")
        except Exception:
            print(f"{time.time():.3f} <packet>")

    # Keep the original, filtered behaviour (recognised app/org events)
    describe_packet(packet)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="POC packet sniffer for PineWire")
    parser.add_argument("-i", "--interface", help="Interface name to sniff on")
    parser.add_argument("-v", "--verbose", action="store_true", help="Print every packet and show PPS")
    args = parser.parse_args()

    print("Available interfaces:")
    for iface in get_windows_if_list():
        print(f"- {iface['name']}  ({iface['description']})")

    interface_name = args.interface or input("\nInterface name to sniff on: ")
    VERBOSE = bool(args.verbose)

    print(f"\nSniffing on '{interface_name}'... connect a device now.\n")

    # Start PPS reporter thread when verbose mode is requested so users can
    # capture a screenshot of the packets-per-second metric.
    if VERBOSE:
        t = threading.Thread(target=_pps_reporter, daemon=True)
        t.start()

    sniff(iface=interface_name, prn=_handle_packet_verbose, store=False)
