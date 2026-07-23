"""Packet capture service used by the dashboard."""

import threading
import time
import socket
import subprocess
from collections.abc import Callable

from scapy.all import BOOTP, DHCP, DNS, DNSQR, Ether, IP, Raw, TCP, sniff

from capture_poc import (
    HTTP_METHODS,
    _ip_to_hostname,
    _is_background_noise,
    _organisation_for,
    _remember_dns_answers,
    extract_sni,
)

AppEventCallback = Callable[[dict], None]

_LOCAL_SUFFIXES = (".mshome.net", ".local", ".localdomain", ".internal", ".home", ".lan")


def _strip_local_suffix(name: str) -> str:
    lower = name.lower()
    for suffix in _LOCAL_SUFFIXES:
        if lower.endswith(suffix):
            return name[: -len(suffix)]
    return name


class CaptureService:
    """Captures packets on one interface and sends app events."""

    def __init__(self, on_app_event: AppEventCallback) -> None:
        self._on_app_event = on_app_event
        self._thread: threading.Thread | None = None
        self._interface_name: str | None = None
        self._stop_event = threading.Event()
        self._recent_apps: dict[tuple[str, str], float] = {}
        self._dedup_window_seconds = 20
        self._device_names_by_ip: dict[str, str] = {}
        self._device_names_by_mac: dict[str, str] = {}
        self._device_labels_by_ip: dict[str, str] = {}
        self._device_labels_by_mac: dict[str, str] = {}

    @property
    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    @property
    def interface_name(self) -> str | None:
        return self._interface_name

    def start(self, interface_name: str) -> None:
        if self.is_running:
            raise RuntimeError("Packet capture is already running.")
        if not interface_name.strip():
            raise ValueError("An interface name is required.")

        self._interface_name = interface_name.strip()
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()

    def _capture_loop(self) -> None:
        while not self._stop_event.is_set():
            sniff(
                iface=self._interface_name,
                prn=self._handle_packet,
                store=False,
                timeout=1,
            )
        self._interface_name = None

    def _handle_packet(self, packet) -> None:
        if not packet.haslayer(IP):
            self._remember_device_name_from_dhcp(packet)
            return

        self._remember_device_name_from_dhcp(packet)

        if packet.haslayer(DNS):
            _remember_dns_answers(packet[DNS])

        source_ip = packet[IP].src
        destination_ip = packet[IP].dst
        source_mac = self._source_mac(packet)

        if packet.haslayer(DNSQR) and packet[DNS].qr == 0:
            hostname = packet[DNSQR].qname.decode(errors="ignore").rstrip(".")
            self._emit_app_event(source_ip, source_mac, hostname)
            return

        if not packet.haslayer(TCP):
            return

        tcp = packet[TCP]
        if tcp.flags == "S":
            self._emit_app_event(
                source_ip,
                source_mac,
                _ip_to_hostname.get(destination_ip),
            )
            return

        if not packet.haslayer(Raw):
            return

        payload = bytes(packet[Raw].load)
        if tcp.dport == 80 and payload.startswith(HTTP_METHODS):
            lines = payload.split(b"\r\n")
            host = next(
                (
                    line.decode(errors="ignore").split(": ", 1)[1]
                    for line in lines
                    if line.lower().startswith(b"host:") and b": " in line
                ),
                None,
            )
            self._emit_app_event(source_ip, source_mac, host)
        elif tcp.dport == 443:
            self._emit_app_event(source_ip, source_mac, extract_sni(payload))

    def _remember_device_name_from_dhcp(self, packet) -> None:
        if not packet.haslayer(DHCP) or not packet.haslayer(BOOTP):
            return

        bootp = packet[BOOTP]
        device_mac = self._format_mac(getattr(bootp, "chaddr", b""))
        dhcp_options = packet[DHCP].options
        device_name = self._dhcp_hostname(dhcp_options)
        device_label = self._dhcp_device_label(dhcp_options)
        if not device_name:
            if not device_label:
                return

        if device_mac:
            if device_name:
                self._device_names_by_mac[device_mac] = device_name
            if device_label:
                self._device_labels_by_mac[device_mac] = device_label

        device_ip = getattr(bootp, "yiaddr", "") or getattr(bootp, "ciaddr", "")
        if device_ip and device_ip != "0.0.0.0":
            if device_name:
                self._device_names_by_ip[device_ip] = device_name
            if device_label:
                self._device_labels_by_ip[device_ip] = device_label

    def _dhcp_hostname(self, options) -> str | None:
        for option in options:
            if not isinstance(option, tuple) or len(option) != 2:
                continue
            key, value = option
            if key in {"hostname", "fqdn", 12, 81} and value:
                if isinstance(value, bytes):
                    value = value.decode("utf-8", errors="ignore")
                if isinstance(value, tuple):
                    value = value[-1]
                hostname = str(value).strip().rstrip(".")
                if hostname and hostname.lower() not in {"none", "null"}:
                    return hostname
        return None

    def _dhcp_device_label(self, options) -> str | None:
        for option in options:
            if not isinstance(option, tuple) or len(option) != 2:
                continue
            key, value = option
            if key != "vendor_class_id" or not value:
                continue
            if isinstance(value, bytes):
                value = value.decode(errors="ignore")

            lowered = str(value).strip().lower()
            if not lowered:
                continue
            if "android" in lowered or lowered.startswith("udhcp"):
                return "Android phone"
            if "apple" in lowered or "iphone" in lowered:
                return "Apple device"
            return str(value).strip()[:40]
        return None

    def _source_mac(self, packet) -> str | None:
        if packet.haslayer(Ether):
            return packet[Ether].src.lower()
        return None

    def _format_mac(self, chaddr) -> str | None:
        if not chaddr:
            return None
        mac_bytes = bytes(chaddr)[:6]
        if len(mac_bytes) < 6:
            return None
        return ":".join(f"{byte:02x}" for byte in mac_bytes)

    def _device_name_for(self, device_ip: str, device_mac: str | None) -> str | None:
        if device_mac and device_mac in self._device_names_by_mac:
            return self._device_names_by_mac[device_mac]
        device_name = self._device_names_by_ip.get(device_ip)
        if device_name:
            return device_name
        return self._resolve_windows_name(device_ip)

    def _resolve_windows_name(self, device_ip: str) -> str | None:
        """Try names Windows can learn outside the captured packet stream."""
        try:
            hostname = socket.gethostbyaddr(device_ip)[0].strip().rstrip(".")
        except (OSError, socket.herror):
            hostname = ""
        if hostname and hostname != device_ip:
            return _strip_local_suffix(hostname)

        try:
            result = subprocess.run(
                ["nbtstat.exe", "-A", device_ip],
                capture_output=True,
                text=True,
                timeout=1,
                check=False,
            )
        except (OSError, subprocess.SubprocessError):
            return None

        for line in result.stdout.splitlines():
            fields = line.split()
            if len(fields) >= 2 and fields[1] == "<00>" and fields[-1] == "UNIQUE":
                name = fields[0].strip()
                if name and name.lower() != "name":
                    return name
        return None

    def _device_label_for(self, device_ip: str, device_mac: str | None) -> str | None:
        if device_mac and device_mac in self._device_labels_by_mac:
            return self._device_labels_by_mac[device_mac]
        return self._device_labels_by_ip.get(device_ip)

    def _emit_app_event(self, device_ip: str, device_mac: str | None, hostname: str | None) -> None:
        if not hostname or _is_background_noise(hostname):
            return

        app = _organisation_for(hostname)
        if app is None:
            return

        device_name = self._device_name_for(device_ip, device_mac)
        device_label = self._device_label_for(device_ip, device_mac)

        key = (device_ip, app)
        now = time.monotonic()
        last_seen = self._recent_apps.get(key)
        self._recent_apps[key] = now
        if last_seen is not None and now - last_seen < self._dedup_window_seconds:
            return

        event = {
            "type": "app",
            "device_ip": device_ip,
            "device_name": device_name,
            "device_label": device_label,
            "app": app,
            "hostname": hostname,
            "timestamp": time.time(),
        }
        self._on_app_event(event)
