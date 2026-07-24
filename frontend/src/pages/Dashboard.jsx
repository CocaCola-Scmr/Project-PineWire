import { useEffect, useState } from "react";
import "../App.css";
import {
  BACKEND_HEALTH_URL,
  BACKEND_HTTP_ORIGIN,
  BACKEND_TRAFFIC_WS_URL,
} from "../backendConfig";
import pinewireLogo from "../assets/logo.png";
import {
  Activity,
  Wifi,
  BookOpen,
  Smartphone,
  Laptop,
  Tablet,
  Monitor,
  Router,
  Apple,
  Cpu,
  Info,
} from "lucide-react";

const MAX_EVENTS = 50;

function formatTime(timestamp) {
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getDeviceIcon(label, name) {
  if (!label && !name) {
    return <Cpu size={18} />;
  }

  const str = (label || name || "").toLowerCase();

  if (str.includes("android") || str.includes("phone")) {
    return <Smartphone size={18} />;
  }
  if (str.includes("iphone") || str.includes("apple") || str.includes("ipad")) {
    if (str.includes("ipad")) return <Tablet size={18} />;
    return <Apple size={18} />;
  }
  if (str.includes("laptop") || str.includes("macbook")) {
    return <Laptop size={18} />;
  }
  if (str.includes("tablet")) {
    return <Tablet size={18} />;
  }
  if (str.includes("desktop") || str.includes("pc")) {
    return <Monitor size={18} />;
  }
  if (str.includes("router") || str.includes("gateway")) {
    return <Router size={18} />;
  }

  return <Cpu size={18} />;
}

function getEventDeviceName(event, devices) {
  if (event.device_name || event.device_label) {
    return event.device_name || event.device_label;
  }

  const device = devices.find((candidate) => candidate.ip === event.device_ip);
  return device?.name || device?.label || event.device_ip;
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState("traffic");
  const [events, setEvents] = useState([]);
  const [connectionState, setConnectionState] = useState("connecting");
  const [captureState, setCaptureState] = useState({
    status: "loading",
    interfaceName: null,
  });
  const [devices, setDevices] = useState([]);
  const [hotspotAvailable, setHotspotAvailable] = useState(null);

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
    const controller = new AbortController();

    async function checkHotspotInfo() {
      try {
        const response = await fetch(`${BACKEND_HTTP_ORIGIN}/api/hotspot`, {
          signal: controller.signal,
        });
        const data = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) {
          setHotspotAvailable(Boolean(data?.available));
        }
      } catch {
        if (!controller.signal.aborted) {
          setHotspotAvailable(false);
        }
      }
    }

    checkHotspotInfo();
    return () => controller.abort();
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

  useEffect(() => {
    const controller = new AbortController();

    async function fetchDevices() {
      try {
        const response = await fetch("http://localhost:8001/api/devices", {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = await response.json();
          setDevices(data.devices || []);
        }
      } catch {
        // Silently fail, keep empty list
      }
    }

    fetchDevices();
    const intervalId = window.setInterval(fetchDevices, 5000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
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
            <p className="eyebrow">Educational network monitor</p>
            <h1>PineWire</h1>
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

      <nav className="tab-bar" aria-label="Dashboard sections">
        {[
          { id: "traffic", label: "Traffic", icon: <Activity size={15} /> },
          { id: "network", label: "Network", icon: <Wifi size={15} /> },
          { id: "learn", label: "Learn", icon: <BookOpen size={15} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn${activeTab === tab.id ? " tab-btn--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="tab-panel" key={activeTab}>
        {activeTab === "traffic" && (
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
                  <p>
                    Connect a device to the hotspot, then open an app or site.
                  </p>
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
                          dateTime={new Date(
                            event.timestamp * 1000,
                          ).toISOString()}
                        >
                          {formatTime(event.timestamp)}
                        </time>
                      </div>
                      <div className="event-message">
                        <span className="device-label">
                          {getEventDeviceName(event, devices)}
                        </span>
                        <strong>is using {event.app}</strong>
                        {event.device_name || event.device_label ? (
                          <span className="device-ip-label">
                            {event.device_ip}
                          </span>
                        ) : null}
                      </div>
                      <span className="app-label">{event.app}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </section>
        )}

        {activeTab === "network" && (
          <div className="network-panel">
            {hotspotAvailable === false && (
              <div className="network-notice">
                <Info size={18} aria-hidden="true" />
                <p>
                  PineWire could not read the hotspot name or password. Check
                  them in Windows Settings under Network &amp; internet, Mobile
                  hotspot.
                </p>
              </div>
            )}

            {/* Connected Devices Card */}
            <section className="card-shell">
              <div className="card-header">
                <div className="card-title-group">
                  <Smartphone size={20} className="card-icon" />
                  <div>
                    <p className="eyebrow">Connected clients</p>
                    <h3>Devices on network</h3>
                  </div>
                </div>
                <span className="device-count">{devices.length}</span>
              </div>

              {devices.length === 0 ? (
                <div className="devices-empty">
                  <Wifi size={32} className="empty-icon" />
                  <p>No devices discovered yet</p>
                  <p className="empty-hint">
                    Devices will appear as they connect and use apps
                  </p>
                </div>
              ) : (
                <ul className="devices-list">
                  {devices.map((device, index) => (
                    <li key={`${device.ip}-${index}`} className="device-item">
                      <div className="device-icon-wrapper">
                        {getDeviceIcon(device.label, device.name)}
                      </div>
                      <div className="device-info">
                        <div className="device-name">
                          {device.name || device.label || "Unknown"}
                        </div>
                        <div className="device-ip">IP Address: {device.ip}</div>
                      </div>
                      {device.label && (
                        <span className="device-type-badge">
                          {device.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {activeTab === "learn" && (
          <section className="activity-shell">
            <div className="activity-header">
              <div>
                <p className="eyebrow">Education</p>
                <h2>Learn</h2>
                <p className="subtle">
                  Tutorials and explanations about what you&apos;re seeing.
                </p>
              </div>
            </div>
            <div className="placeholder-panel">
              <p className="placeholder-label">
                Tutorials and educational content coming soon.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default Dashboard;
