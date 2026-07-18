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

from scapy.all import sniff, IP, DNSQR
from scapy.arch.windows import get_windows_if_list


def list_interfaces():
    """Print available network interfaces so you can find the hotspot's adapter."""
    for iface in get_windows_if_list():
        print(f"- {iface['name']}  (description: {iface['description']})")


def describe_packet(packet):
    """Print a simplified, beginner-friendly summary of a captured packet."""
    if not packet.haslayer(IP):
        return

    src = packet[IP].src
    dst = packet[IP].dst

    if packet.haslayer(DNSQR):
        query_name = packet[DNSQR].qname.decode(errors="ignore")
        print(f"[DNS]  {src} asked to look up: {query_name}")
    else:
        print(f"[IP]   {src} -> {dst}")


if __name__ == "__main__":
    print("Available interfaces:")
    list_interfaces()

    interface_name = input("\nPaste the exact interface name for your hotspot adapter: ")

    print(f"\nSniffing on '{interface_name}'... connect a device to your hotspot now.")
    sniff(iface=interface_name, prn=describe_packet, store=False)
