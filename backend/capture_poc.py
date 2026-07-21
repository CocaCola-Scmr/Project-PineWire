"""
Windows-only packet capture proof of concept.

This is intentionally NOT wired into the FastAPI app yet. The goal is to
prove that capturing packets on the hotspot's virtual adapter works at
all, before integrating it with the rest of PineWire.

Run this natively on Windows (not inside WSL), after:
1. Turning on Windows Mobile Hotspot (Settings > Network & Internet > Mobile hotspot)
2. Installing Npcap (https://npcap.com) with "WinPcap API-compatible Mode" checked
3. Installing scapy: pip install scapy
4. Running this script from an Administrator terminal (packet capture needs elevated rights)
"""

import re
import time

from scapy.all import sniff, IP, TCP, Raw, DNS, DNSQR
from scapy.arch.windows import get_windows_if_list

from common_services import NOISE_KEYWORDS, ORGANISATION_LABELS, ORG_DEDUP_WINDOW_SECONDS

# Well-known ports mapped to a beginner-friendly label. Used when we see a
# new connection attempt (TCP SYN) so we can say *what kind* of connection
# it is, not just a raw port number.
KNOWN_PORTS = {
    80: "HTTP (unencrypted web)",
    443: "HTTPS (encrypted web)",
    22: "SSH (secure remote access)",
    21: "FTP (file transfer)",
}

HTTP_METHODS = (b"GET ", b"POST ", b"PUT ", b"HEAD ", b"DELETE ", b"OPTIONS ")

# A rough "does this look like a real hostname" check, used to reject
# corrupted/garbage strings (e.g. from a TLS ClientHello split across
# multiple TCP segments) instead of printing them.
_HOSTNAME_RE = re.compile(
    r"^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$"
)

# How long (seconds) to hide a repeat of the exact same event before showing
# it again. Real traffic constantly repeats itself - browsers open several
# connections to the same site, apps re-check the same server every few
# seconds, etc. Without this, the output is mostly the same line scrolling
# over and over, which isn't useful for a novice watching a dashboard.
DEDUP_WINDOW_SECONDS = 8
_recently_shown = {}

# Maps an IP address to the hostname most recently resolved for it (learned
# from DNS responses). A bare IP address means nothing to a novice, so we
# use this to show friendly names instead, and skip events where we don't
# know a hostname at all.
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


# --- Tier 3: "does this look like a real website?" ---
#
# Anything that isn't known noise and isn't a recognised organisation still
# needs a decision: is this likely a specific website the user visited
# (e.g. lynxracing.com.au), or just another unrecognised piece of app/SDK
# infrastructure we don't have a label for? Packets can't answer this with
# certainty - for HTTPS traffic all we ever see is the hostname (via SNI),
# never the actual page request - so this is a structural guess based on
# the *shape* of the hostname itself:
#   - a bare domain or "www" subdomain (e.g. lynxracing.com.au,
#     www.lynxracing.com.au) is treated as a likely website
#   - a subdomain matching common technical jargon (api, cdn, sdk, auth,
#     events, ...) or an auto-generated-looking label (e.g.
#     occ-0-998-2568) is treated as infrastructure, not a visit
#
# This is still just a heuristic and will sometimes be wrong in both
# directions, but it avoids the alternative of either showing every
# unrecognised subdomain (noisy) or hiding every unrecognised domain
# (which would also hide genuine, uncommon websites).
_COMPOUND_TLDS = {
    "com.au", "co.uk", "co.nz", "com.br", "co.in", "co.jp", "com.sg", "co.za",
}

_TECHNICAL_SUBDOMAIN_WORDS = {
    "api", "sdk", "cdn", "static", "asset", "assets", "img", "image",
    "images", "media", "ingest", "ingestion", "event", "events", "msgstore",
    "telemetry", "analytics", "metrics", "config", "gateway", "gw", "ws",
    "wss", "mqtt", "push", "notify", "notifications", "log", "logs",
    "logging", "graph", "edge", "id", "auth", "login", "oauth", "token",
    "session", "sessions", "track", "tracking", "beacon", "collector",
    "admin", "status", "health", "settings", "update", "sync", "csync",
    "connect", "service", "services", "backend", "internal", "staging",
    "dev", "cache", "proxy", "lb", "node", "cluster", "pixel", "tag",
    "rtb", "bid", "bids", "ads", "adserver",
}
# Suffixes checked against a whole (non-hyphenated) label, for compound
# words like "idsync" that aren't hyphen-separated. Deliberately a much
# smaller, safer list than the word set above - these are chosen because
# no common English word ends this way (unlike e.g. "log", which would
# wrongly flag "blog" if matched the same way).
_SAFE_TECHNICAL_SUFFIXES = ("sync", "api", "sdk")
_LOOKS_AUTOGENERATED_RE = re.compile(r"^[a-z0-9]*\d[a-z0-9-]*\d[a-z0-9-]*$")
# A minimum length for a subdomain label to be taken seriously as a "real"
# destination. Tracking pixels/ad-tech beacons overwhelmingly use ultra-short,
# cryptic labels (e.g. "d.adroll.com", "s.adroll.com", "ib.adnxs.com",
# "c.6sc.co") - genuine, human-chosen subdomains people navigate to are
# rarely this short. Anything shorter is treated as infrastructure, not a
# website (well-known short exceptions like t.co are handled via the
# organisation list instead, which is checked first).
_MIN_CREDIBLE_LABEL_LENGTH = 3
SITE_DEDUP_WINDOW_SECONDS = 20


def _base_domain_label_count(labels):
    """How many trailing labels make up the 'registrable' domain - e.g. 2
    for example.com, 3 for example.com.au. A small, hardcoded approximation
    (not a full public suffix list), just enough to tell whether a hostname
    has extra subdomain labels in front of it."""
    if len(labels) >= 3 and ".".join(labels[-2:]) in _COMPOUND_TLDS:
        return 3
    return 2


def _looks_like_technical_label(label):
    """True if a single subdomain label looks like infrastructure jargon
    rather than a name a human would choose. Matches whole hyphen-separated
    segments exactly (e.g. "tracking-api" -> "tracking", "api") rather than
    plain substrings, to avoid false positives like "blog" containing
    "log". Compound, non-hyphenated words like "idsync" are still caught
    via a small, safe suffix list."""
    segments = label.split("-")
    if any(segment in _TECHNICAL_SUBDOMAIN_WORDS for segment in segments):
        return True
    return any(label.endswith(suffix) for suffix in _SAFE_TECHNICAL_SUFFIXES)


def _looks_like_website(hostname):
    """Best-effort guess at whether a hostname is a 'real' website someone
    would recognise as a destination, rather than a technical subdomain
    used by an app's backend/SDK infrastructure. See the module-level note
    above - this can only ever be a guess."""
    labels = hostname.lower().split(".")
    if len(labels) < 2:
        return False

    subdomain_labels = labels[:-_base_domain_label_count(labels)]

    if not subdomain_labels:
        return True  # bare domain, e.g. lynxracing.com.au
    if subdomain_labels == ["www"]:
        return True

    for label in subdomain_labels:
        if len(label) < _MIN_CREDIBLE_LABEL_LENGTH:
            return False
        if _looks_like_technical_label(label):
            return False
        if len(label) >= 6 and _LOOKS_AUTOGENERATED_RE.match(label):
            return False

    # An unfamiliar but "normal-looking" subdomain (e.g. shop.example.com)
    # - treated as a website, since it doesn't match any technical pattern
    return True


# How many events we've silently filtered out (as noise, or as an
# unrecognised, not-website-shaped hostname) since the last time we
# actually showed something. Rather than pretending the filtering above is
# perfect, we surface this count alongside the next real event - the tool
# should be honest about how much it's hiding, not imply it has flawlessly
# identified everything.
_suppressed_since_last_shown = 0

# A structured log of every hidden/suppressed event, kept (not just
# counted) so this data isn't thrown away - a future version of this tool
# running inside the real web app can expose these through an "expand to
# see hidden packets" UI element instead of only a terminal count. Capped
# to avoid growing forever during a long capture session.
_MAX_HIDDEN_EVENTS = 500
_hidden_events = []


def _note_suppressed():
    global _suppressed_since_last_shown
    _suppressed_since_last_shown += 1


def _record_hidden(kind, hostname, message):
    """Suppress an event from the terminal output, but keep a record of it
    (kind is "noise" or "unsupported") so the data isn't lost."""
    _note_suppressed()
    _hidden_events.append({
        "kind": kind,
        "hostname": hostname,
        "message": message,
        "timestamp": time.time(),
    })
    if len(_hidden_events) > _MAX_HIDDEN_EVENTS:
        del _hidden_events[0]


def get_hidden_events():
    """Return the recently hidden/suppressed events. This is what a future
    web app's "expand to see hidden packets" feature would call to show the
    detail behind a "(N other background connections hidden)" summary."""
    return list(_hidden_events)


def _print_event(message):
    global _suppressed_since_last_shown
    if _suppressed_since_last_shown:
        count = _suppressed_since_last_shown
        noun = "connection" if count == 1 else "connections"
        print(f"          ...({count} other background {noun} hidden)")
        _suppressed_since_last_shown = 0
    print(message)


def list_interfaces():
    """Print available network interfaces so you can find the hotspot's adapter."""
    for iface in get_windows_if_list():
        print(f"- {iface['name']}  (description: {iface['description']})")


def _looks_like_hostname(value):
    return bool(value) and len(value) <= 255 and bool(_HOSTNAME_RE.match(value))


def _is_duplicate(key, window=DEDUP_WINDOW_SECONDS):
    """Return True if `key` was already shown within `window` seconds
    (and record it as shown now either way)."""
    now = time.monotonic()
    last_seen = _recently_shown.get(key)
    _recently_shown[key] = now
    return last_seen is not None and (now - last_seen) < window


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
    """Print a simplified, beginner-friendly summary of a captured packet.

    Only a handful of "interesting" event types are printed, each deduped
    against recent repeats. Plain TCP ACKs, retransmissions, raw encrypted
    data segments, local network discovery chatter (mDNS), and connections
    to IPs we can't put a name to are intentionally dropped - they're noise
    with no learning value for a novice user.

    Every candidate hostname passes through four tiers, in order:
    1. Known noise (_is_background_noise) - OS/app background plumbing
       (telemetry, ad SDKs, connectivity checks, software update, etc.) -
       hidden, recorded, and counted as suppressed.
    2. Known organisation (_organisation_for) - a recognised, commonly used
       app/service (Reddit, YouTube, WhatsApp, ...) - shown once as a single
       friendly "is using X" line, deduped over a longer window, since one
       app touches many different-looking subdomains at once.
    3. Looks like a website (_looks_like_website) - an unrecognised hostname
       shaped like a real destination (e.g. lynxracing.com.au) rather than
       app/SDK plumbing - shown once as a "visited X" line.
    4. Anything else - an unrecognised, technical-looking hostname we can't
       confidently label either way - hidden and recorded as "unsupported",
       same as tier 1, rather than shown raw.

    None of this is perfect - it's a set of best-effort approximations,
    since raw packets don't carry any signal about user intent.
    """
    if not packet.haslayer(IP):
        return

    src = packet[IP].src
    dst = packet[IP].dst

    if packet.haslayer(DNS):
        _remember_dns_answers(packet[DNS])

    # DNS queries - "what site is this device looking up?"
    if packet.haslayer(DNSQR):
        query_name = packet[DNSQR].qname.decode(errors="ignore").rstrip(".")
        if not query_name or query_name.lower().endswith(".local"):
            return  # ignore mDNS/local device discovery noise
        message = f"[DNS]     {src} looked up: {query_name}"
        if _is_background_noise(query_name):
            _record_hidden("noise", query_name, message)
            return
        org = _organisation_for(query_name)
        if org:
            if not _is_duplicate(("org", org), window=ORG_DEDUP_WINDOW_SECONDS):
                _print_event(f"[APP]     {src} is using {org}")
            return
        if _looks_like_website(query_name):
            if not _is_duplicate(("site", query_name), window=SITE_DEDUP_WINDOW_SECONDS):
                _print_event(f"[SITE]    {src} visited {query_name}")
            return
        _record_hidden("unsupported", query_name, message)
        return

    if not packet.haslayer(TCP):
        return

    tcp = packet[TCP]
    dport = tcp.dport

    # A new connection attempt (SYN, no ACK yet) - "device X is connecting to Y"
    if tcp.flags == "S":
        hostname = _ip_to_hostname.get(dst)
        if hostname is None:
            return  # an unnamed IP means nothing to a novice - skip it
        service = KNOWN_PORTS.get(dport, f"port {dport}")
        message = f"[CONNECT] {src} is starting a connection to {hostname}  ({service})"
        if _is_background_noise(hostname):
            _record_hidden("noise", hostname, message)
            return
        org = _organisation_for(hostname)
        if org:
            if not _is_duplicate(("org", org), window=ORG_DEDUP_WINDOW_SECONDS):
                _print_event(f"[APP]     {src} is using {org}")
            return
        if _looks_like_website(hostname):
            if not _is_duplicate(("site", hostname), window=SITE_DEDUP_WINDOW_SECONDS):
                _print_event(f"[SITE]    {src} visited {hostname}")
            return
        _record_hidden("unsupported", hostname, message)
        return

    if packet.haslayer(Raw):
        payload = bytes(packet[Raw].load)

        # Plaintext HTTP request - since it's unencrypted, we can show exactly
        # what's being requested (method, host, path)
        if dport == 80 and payload.startswith(HTTP_METHODS):
            lines = payload.split(b"\r\n")
            request_line = lines[0].decode(errors="ignore")
            host = next(
                (line.decode(errors="ignore").split(": ", 1)[1] for line in lines
                 if line.lower().startswith(b"host:")),
                dst,
            )
            message = f"[HTTP]    {src} -> {host}  |  {request_line}  (not encrypted - visible to anyone)"
            if _is_background_noise(host):
                _record_hidden("noise", host, message)
                return
            org = _organisation_for(host)
            if org:
                if not _is_duplicate(("org", org), window=ORG_DEDUP_WINDOW_SECONDS):
                    _print_event(f"[APP]     {src} is using {org}")
                return
            # An actual HTTP GET/POST/etc. is direct evidence of a real
            # request, not just a guess - no need for the website heuristic
            if _is_duplicate(("http", src, host, request_line)):
                return
            _print_event(message)
            return

        # TLS ClientHello - the hostname is visible even though the actual
        # traffic that follows will be encrypted
        if dport == 443:
            sni = extract_sni(payload)
            if sni:
                message = f"[HTTPS]   {src} is connecting securely to {sni}  (site name visible, contents hidden)"
                if _is_background_noise(sni):
                    _record_hidden("noise", sni, message)
                    return
                org = _organisation_for(sni)
                if org:
                    if not _is_duplicate(("org", org), window=ORG_DEDUP_WINDOW_SECONDS):
                        _print_event(f"[APP]     {src} is using {org}")
                    return
                if _looks_like_website(sni):
                    if not _is_duplicate(("site", sni), window=SITE_DEDUP_WINDOW_SECONDS):
                        _print_event(f"[SITE]    {src} visited {sni}")
                    return
                _record_hidden("unsupported", sni, message)
                return


if __name__ == "__main__":
    print("Available interfaces:")
    list_interfaces()

    interface_name = input("\nPaste the exact interface name for your hotspot adapter: ")

    print(f"\nSniffing on '{interface_name}'... connect a device to your hotspot now.")
    sniff(iface=interface_name, prn=describe_packet, store=False)
