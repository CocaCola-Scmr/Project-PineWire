"""FastAPI server for the PineWire live dashboard."""

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scapy.arch.windows import get_windows_if_list

from capture_service import CaptureService


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


@app.websocket("/ws/traffic")
async def traffic_websocket(websocket: WebSocket):
    await connections.connect(websocket)
    try:
        while True:
            # Keep the socket open until the browser disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        connections.disconnect(websocket)
