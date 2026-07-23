import { useEffect, useState } from "react";
import "./App.css";
import { BACKEND_HEALTH_URL, BACKEND_TRAFFIC_WS_URL } from "./backendConfig";
import pinewireLogo from "./assets/logo.png";

const MAX_EVENTS = 50;

function formatTime(timestamp) {
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function App() {
  const [events, setEvents] = useState([]);
  const [connectionState, setConnectionState] = useState("connecting");
  const [captureState, setCaptureState] = useState({
    status: "loading",
    interfaceName: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function refreshCaptureState() {
      try {
        const response = await fetch(BACKEND_HEALTH_URL, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Health request failed with ${response.status}`);
        }

        const health = await response.json();
        if (controller.signal.aborted) {
          return;
        }

        setCaptureState({
          status: health.capture_running ? "running" : "stopped",
          interfaceName: health.interface_name,
        });
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setCaptureState({
          status: "unreachable",
          interfaceName: null,
        });
      }
    }

    refreshCaptureState();
    const intervalId = window.setInterval(refreshCaptureState, 5000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let socket;
    let reconnectTimer;
    let cancelled = false;

    function connect() {
      if (cancelled) {
        return;
      }

      socket = new WebSocket(BACKEND_TRAFFIC_WS_URL);
      setConnectionState("connecting");

      socket.onopen = () => {
        if (cancelled) return;
        setConnectionState("live");
      };

      socket.onmessage = (message) => {
        if (cancelled) return;
        const event = JSON.parse(message.data);
        if (event.type !== "app") {
          return;
        }

        setEvents((currentEvents) =>
          [event, ...currentEvents].slice(0, MAX_EVENTS),
        );
      };

      socket.onclose = () => {
        if (cancelled) return;
        setConnectionState("offline");
        reconnectTimer = window.setTimeout(connect, 3000);
      };

      socket.onerror = () => {
        if (cancelled) return;
        setConnectionState("offline");
      };
    }

    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  const isLive = connectionState === "live";
  const captureRunning = captureState.status === "running";
  const connectionLabel = isLive
    ? "Live"
    : connectionState === "connecting"
      ? "Connecting"
      : "Offline";

  const captureLabel = captureRunning
    ? `Running${captureState.interfaceName ? ` on ${captureState.interfaceName}` : ""}`
    : captureState.status === "loading"
      ? "Checking"
      : captureState.status === "unreachable"
        ? "Backend down"
        : "Stopped";

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={pinewireLogo} alt="PineWire logo" />
          <div>
            <p className="eyebrow">Network monitor</p>
            <h1>PineWire</h1>
            <p className="subtle hero-subtle">
              Live app activity picked up from the hotspot.
            </p>
          </div>
        </div>

        <div
          className="status-stack"
          aria-label="Connection and capture status"
        >
          <div className={`status-chip connection--${connectionState}`}>
            <span className="connection-dot" aria-hidden="true" />
            <span>{connectionLabel}</span>
          </div>
          <div className={`status-chip capture--${captureState.status}`}>
            <span className="capture-dot" aria-hidden="true" />
            <span>{captureLabel}</span>
          </div>
          <div className="status-chip status-chip--count">
            <span>{events.length} shown</span>
          </div>
        </div>
      </header>

      <section className="activity-shell">
        <div className="activity-header" aria-labelledby="activity-heading">
          <div>
            <p className="eyebrow">Live activity</p>
            <h2 id="activity-heading">Recognised connections</h2>
            <p className="subtle">Updated as traffic comes through.</p>
          </div>
        </div>

        <section
          className="event-panel"
          aria-live="polite"
          aria-label="App activity"
        >
          {events.length === 0 ? (
            <div className="empty-state">
              <img className="empty-logo" src={pinewireLogo} alt="" />
              <h3>Waiting for traffic</h3>
              <p>Connect a device to the hotspot, then open an app or site.</p>
            </div>
          ) : (
            <ol className="event-list">
              {events.map((event, index) => (
                <li
                  className="event-row"
                  key={`${event.timestamp}-${event.hostname}-${index}`}
                >
                  <div className="event-time-block">
                    <time
                      dateTime={new Date(event.timestamp * 1000).toISOString()}
                    >
                      {formatTime(event.timestamp)}
                    </time>
                  </div>
                  <div className="event-message">
                    <span className="device-label">
                      {event.device_name ||
                        event.device_label ||
                        event.device_ip}
                    </span>
                    <strong>is using {event.app}</strong>
                    {event.device_name || event.device_label ? (
                      <span className="device-ip-label">{event.device_ip}</span>
                    ) : null}
                  </div>
                  <span className="app-label">{event.app}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </section>
    </main>
  );
}

export default App;
