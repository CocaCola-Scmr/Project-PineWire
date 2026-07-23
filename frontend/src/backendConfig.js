const DEFAULT_BACKEND_ORIGIN = "http://localhost:8001";

const backendUrl = new URL(
  import.meta.env.VITE_BACKEND_ORIGIN ?? DEFAULT_BACKEND_ORIGIN,
);

export const BACKEND_HTTP_ORIGIN = backendUrl.origin;
export const BACKEND_WS_ORIGIN = `${backendUrl.protocol === "https:" ? "wss:" : "ws:"}//${backendUrl.host}`;
export const BACKEND_HEALTH_URL = `${BACKEND_HTTP_ORIGIN}/health`;
export const BACKEND_TRAFFIC_WS_URL = `${BACKEND_WS_ORIGIN}/ws/traffic`;
