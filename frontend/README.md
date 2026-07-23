# PineWire Frontend

## Environment

Copy [`.env.example`](.env.example) to `.env` if you want to change the backend address without editing code.

```env
VITE_BACKEND_ORIGIN=http://localhost:8001
```

## Running

```powershell
npm.cmd run dev
```

## Notes

The frontend reads the backend base URL from `VITE_BACKEND_ORIGIN` and derives both the HTTP and WebSocket endpoints from it. The backend CORS origin can also be configured with `PINEWIRE_FRONTEND_ORIGIN` or `PINEWIRE_FRONTEND_ORIGINS` if you run the app on a different port or host.
