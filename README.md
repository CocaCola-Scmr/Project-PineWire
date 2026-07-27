# PineWire

PineWire is a cybersecurity education project that demonstrates, in a safe and controlled way, how rogue access points and man-in-the-middle style attacks can be used to observe network traffic.

The project is intended as a visual simulator and learning tool, not a real offensive attack tool. It will focus on showing beginner-friendly explanations of traffic, encryption, and the risks of untrusted Wi-Fi.

Planned scope:

- React frontend for a simple dashboard and tutorial flow
- Python backend for demo or simulated traffic data
- clear explanations of encrypted vs unencrypted traffic
- ethical and consent-focused design

Out of scope:

- impersonating real Wi-Fi networks
- forcing unsuspecting users to connect
- exposing sensitive encrypted payloads

## Setup (Windows) — Quick & Simple

### What you need to do:

- Install Npcap (Windows packet-capture driver): download https://nmap.org/npcap/ and run the installer as Administrator — required to capture raw Wi‑Fi traffic.
- Turn ON Mobile Hotspot: Settings → Network & internet → Mobile hotspot.
- Connect at least one phone/tablet to that hotspot so Windows keeps it active.
- Open two PowerShell windows: one for the backend and one for the frontend.

Run these exact commands.

#### Terminal 1 — backend (PowerShell)

```powershell
cd "C:\path\to\Project-PineWire\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

#### Terminal 2 — frontend (PowerShell)

```powershell
cd "C:\path\to\Project-PineWire\frontend"
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Troubleshooting

#### If the app doesn't show traffic correctly

```powershell
netsh wlan show interfaces
```

Look for `SSID` (the hotspot name) and `Name` (the adapter name). If you see them, the backend should detect them.

If you prefer the GUI: Settings → Network & internet → Advanced network settings → More network adapter options (look for names like `Wi‑Fi`).
If the app doesn't show hotspot/adapter info

### Finding the correct adapter (beginner-friendly)

If PineWire can't detect the adapter automatically, here's how to find it using either the Windows Settings GUI or PowerShell.

- GUI (recommended for beginners):
  1.  Open **Settings** → **Network & internet** → **Mobile hotspot**. Make sure Mobile Hotspot is turned on.
  2.  In **Network & internet**, click **Advanced network settings** → **More network adapter options**.
  3.  Look for the adapter that corresponds to your Wi‑Fi radio. Common names: **Wi‑Fi**, **Wireless Network Connection**, or names that include your wireless card vendor. That's the adapter to pick in PineWire > Network → Advanced.

- PowerShell (quick, exact):
  1.  Open PowerShell (no admin required for this read-only check).
  2.  Run:

```powershell
netsh wlan show interfaces
```

    3. You will see blocks like:

```
		Name                   : Wi-Fi
		State                  : connected
		SSID                   : MyPhoneHotspot
		BSSID                  : xx:xx:xx:xx:xx:xx
```

    - The **Name** field is the adapter name (use this in the Advanced dropdown). The **SSID** field is the hotspot name shown to devices.

If you see these fields, the backend should detect them automatically; if not, use the Advanced dropdown in the app to pick the adapter.

**Note about adapter names (Realtek vs Microsoft Wi‑Fi Direct)**

Some systems list the physical Wi‑Fi adapter (for example: "Realtek RTL8852AE WiFi 6 802.11ax PCIe Adapter") while the Mobile Hotspot feature is actually provided through a virtual adapter named `Microsoft Wi‑Fi Direct Virtual Adapter` (often suffixed with a number, e.g. `Microsoft Wi‑Fi Direct Virtual Adapter #2`). If PineWire shows the physical adapter but your hotspot is running on the virtual adapter, pick the `Microsoft Wi‑Fi Direct Virtual Adapter` entry in the app's Advanced dropdown.

If you can't find the virtual adapter in the GUI list, open **Device Manager** → **Network adapters** and enable or show hidden devices; look for entries starting with `Microsoft Wi‑Fi Direct Virtual Adapter`.

#### Need the backend to use a specific adapter?

- In Terminal 1, set the adapter just for that session before starting the backend:

```powershell

python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

- Use the app's Network → Advanced dropdown to choose the adapter your Mobile Hotspot uses; run `netsh wlan show interfaces` in PowerShell to find the SSID or adapter name.

#### Changing the frontend's backend URL

- If you run the backend on a different port, set this in Terminal 2 before starting Vite:

```powershell
$env:VITE_BACKEND_ORIGIN = 'http://localhost:8000'
npm run dev
```

### Simple troubleshooting

- If detection fails or capture errors appear: run the backend PowerShell as Administrator (right-click PowerShell → Run as administrator) and repeat the backend commands.
- If the frontend can't reach the backend: ensure both terminals are running and the correct port is used, and allow the firewall if prompted.
