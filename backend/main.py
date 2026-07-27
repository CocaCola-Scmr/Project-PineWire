"""FastAPI server for the PineWire live dashboard."""

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scapy.arch.windows import get_windows_if_list

from capture_service import CaptureService
import subprocess
from typing import Optional


DEFAULT_FRONTEND_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}


class CaptureStartRequest(BaseModel):
    interface_name: str


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, event: dict) -> None:
        disconnected: list[WebSocket] = []
        for websocket in self._connections:
            try:
                await websocket.send_json(event)
            except Exception:
                disconnected.append(websocket)
        for websocket in disconnected:
            self.disconnect(websocket)


connections = ConnectionManager()


def get_frontend_origins() -> list[str]:
    configured_origins = os.getenv("PINEWIRE_FRONTEND_ORIGINS")
    if configured_origins:
        origins = [origin.strip() for origin in configured_origins.split(",") if origin.strip()]
        if origins:
            return origins

    single_origin = os.getenv("PINEWIRE_FRONTEND_ORIGIN")
    if single_origin:
        return [single_origin.strip()]

    return sorted(DEFAULT_FRONTEND_ORIGINS)


def publish_app_event(event: dict) -> None:
    """Send capture events from the worker thread to the app event loop."""
    event_loop = app.state.event_loop
    asyncio.run_coroutine_threadsafe(connections.broadcast(event), event_loop)


@asynccontextmanager
async def lifespan(application: FastAPI):
    application.state.event_loop = asyncio.get_running_loop()
    application.state.capture_service = CaptureService(publish_app_event)

    interface_name = os.getenv("PINEWIRE_INTERFACE")
    if interface_name:
        application.state.capture_service.start(interface_name)

    yield

    application.state.capture_service.stop()


app = FastAPI(title="PineWire API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_frontend_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "PineWire API is running."}


@app.get("/health")
def health():
    capture_service: CaptureService = app.state.capture_service
    return {
        "status": "ok",
        "capture_running": capture_service.is_running,
        "interface_name": capture_service.interface_name,
    }


@app.get("/api/interfaces")
def interfaces():
    return [
        {"name": interface["name"], "description": interface["description"]}
        for interface in get_windows_if_list()
    ]


@app.post("/api/capture/start")
def start_capture(request: CaptureStartRequest):
    capture_service: CaptureService = app.state.capture_service
    try:
        capture_service.start(request.interface_name)
    except (RuntimeError, ValueError) as error:
        raise HTTPException(status_code=409, detail=str(error)) from error

    return {"status": "started", "interface_name": capture_service.interface_name}


@app.post("/api/capture/stop")
def stop_capture():
    capture_service: CaptureService = app.state.capture_service
    capture_service.stop()
    return {"status": "stopping"}


@app.get("/api/devices")
def get_devices():
    capture_service: CaptureService = app.state.capture_service
    return {"devices": capture_service.get_devices()}


@app.get("/api/hotspot")
def get_hotspot():
    """Attempt to detect Mobile Hotspot / Wi‑Fi interface and SSID on Windows.

    This is best-effort: Windows sometimes hides Mobile Hotspot details
    behind system settings. We call `netsh wlan show interfaces` and
    fall back to a helpful message when parsing fails.
    """
    # Try to read the wireless interface info via netsh
    try:
        result = subprocess.run(
            ["netsh", "wlan", "show", "interfaces"],
            capture_output=True,
            text=True,
            timeout=1,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return {"available": False, "message": "Hotspot details are managed by Windows Settings."}

    out = (result.stdout or "").splitlines()
    ssid: Optional[str] = None
    iface_name: Optional[str] = None
    state: Optional[str] = None
    for line in out:
        # lines look like: "    State                   : connected" or "    SSID                   : MyHotspot"
        if ":" not in line:
            continue
        key, val = [s.strip() for s in line.split(":", 1)]
        low = key.lower()
        if low == "ssid":
            ssid = val or None
        elif low in ("name", "interface name", "interface"):
            iface_name = val or None
        elif low == "state":
            state = val or None

    if ssid:
        # Try to map the reported interface name to the scapy/windows interface list
        scapy_iface = None
        try:
            windows_ifaces = get_windows_if_list()
            low_iface = (iface_name or "").lower()
            for interface in windows_ifaces:
                # match either by exact name/description or by substring (case-insensitive)
                name = (interface.get("name") or "").lower()
                desc = (interface.get("description") or "").lower()
                if low_iface and (low_iface == name or low_iface == desc or low_iface in name or low_iface in desc or name in low_iface or desc in low_iface):
                    scapy_iface = interface.get("name")
                    break
        except Exception:
            scapy_iface = None

        resp = {
            "available": True,
            "ssid": ssid,
            "interface": iface_name,
            "state": state,
            "message": "Hotspot / Wi‑Fi info detected.",
        }
        if scapy_iface:
            resp["scapy_interface"] = scapy_iface
        return resp

    # If we didn't find an SSID, return a simple message guiding the user.
    return {
        "available": False,
        "message": "Hotspot details are managed by Windows Settings. Please enable Mobile Hotspot and connect a device.",
    }


@app.websocket("/ws/traffic")
async def traffic_websocket(websocket: WebSocket):
    await connections.connect(websocket)
    try:
        while True:
            # Keep the socket open until the browser disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        connections.disconnect(websocket)
