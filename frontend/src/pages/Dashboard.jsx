import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import "../App.css";
import {
  BACKEND_HEALTH_URL,
  BACKEND_HTTP_ORIGIN,
  BACKEND_TRAFFIC_WS_URL,
} from "../backendConfig";
import pinewireLogo from "../assets/logo.png";
import Tour from "../components/Tour";
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
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("traffic");
  const [events, setEvents] = useState([]);
  const [connectionState, setConnectionState] = useState("connecting");
  const [captureState, setCaptureState] = useState({
    status: "loading",
    interfaceName: null,
  });
  const [devices, setDevices] = useState([]);
  const [hotspotAvailable, setHotspotAvailable] = useState(null);
  const [interfacesList, setInterfacesList] = useState([]);
  const [selectedInterface, setSelectedInterface] = useState("");
  const [interfaceLoading, setInterfaceLoading] = useState(false);
  const [hotspotInfo, setHotspotInfo] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [showTour, setShowTour] = useState(
    location.state?.fromOnboarding || false,
  );
  const adapterChangeInProgress = useRef(false);
  const initialSelectedRef = useRef(true);
  const captureStateRef = useRef(captureState);

  useEffect(() => {
    captureStateRef.current = captureState;
  }, [captureState]);

  // When the selected adapter changes, automatically start/restart capture so users don't have to
  useEffect(() => {
    if (initialSelectedRef.current) {
      initialSelectedRef.current = false;
      return;
    }

    if (!selectedInterface) return;
    if (adapterChangeInProgress.current) return;

    (async () => {
      adapterChangeInProgress.current = true;
      try {
        // If capture is running, restart it on the new interface. Otherwise start it.
        if (captureStateRef.current.status === "running") {
          setStopLoading(true);
          try {
            await fetch(`${BACKEND_HTTP_ORIGIN}/api/capture/stop`, {
              method: "POST",
            });
          } catch (e) {
            // ignore
          } finally {
            setStopLoading(false);
          }
        }

        setStartLoading(true);
        try {
          await fetch(`${BACKEND_HTTP_ORIGIN}/api/capture/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ interface_name: selectedInterface }),
          });
        } catch (e) {
          // ignore
        } finally {
          setStartLoading(false);
        }

        // refresh health immediately
        try {
          const h = await fetch(BACKEND_HEALTH_URL);
          if (h.ok) {
            const j = await h.json();
            setCaptureState({
              status: j.capture_running ? "running" : "stopped",
              interfaceName: j.interface_name,
            });
          }
        } catch (e) {
          // ignore
        }
      } finally {
        adapterChangeInProgress.current = false;
      }
    })();
  }, [selectedInterface]);

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
          setHotspotInfo(data || null);
        }
      } catch {
        if (!controller.signal.aborted) {
          setHotspotAvailable(false);
          setHotspotInfo(null);
        }
      }
    }

    checkHotspotInfo();
    return () => controller.abort();
  }, []);

  // Load available interfaces for Network controls
  useEffect(() => {
    let cancelled = false;
    async function loadIfaces() {
      setInterfaceLoading(true);
      let reportedInterface = hotspotInfo?.interface;
      try {
        const resp = await fetch(`${BACKEND_HTTP_ORIGIN}/api/interfaces`);
        if (!cancelled && resp.ok) {
          const list = await resp.json();
          setInterfacesList(list || []);
          if (list && list.length > 0) {
            // Try to prefer the interface reported by /api/hotspot, if available.
            try {
              const hs = await fetch(`${BACKEND_HTTP_ORIGIN}/api/hotspot`);
              if (hs.ok) {
                const hotspot = await hs.json();
                // keep hotspot info for UI decisions
                setHotspotInfo(hotspot || null);
                reportedInterface = hotspot?.interface || reportedInterface;
                const ifaceName = hotspot?.interface || null;
                // If hotspot reported an interface and it exists in the list, pick it.
                if (ifaceName) {
                  const match = list.find(
                    (it) =>
                      it.name === ifaceName || it.description === ifaceName,
                  );
                  if (match) {
                    setSelectedInterface(match.name);
                  } else {
                    setSelectedInterface(list[0].name);
                  }
                } else {
                  setSelectedInterface(list[0].name);
                }
              } else {
                setSelectedInterface(list[0].name);
              }
            } catch {
              setSelectedInterface(list[0].name);
            }
            // Keep advanced controls collapsed by default; do not auto-open
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setInterfaceLoading(false);
      }
    }
    loadIfaces();
    return () => {
      cancelled = true;
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

  useEffect(() => {
    const controller = new AbortController();

    async function fetchDevices() {
      try {
        const response = await fetch(`${BACKEND_HTTP_ORIGIN}/api/devices`, {
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
    <>
      {showTour && (
        <Tour
          onComplete={() => {
            setShowTour(false);
            // Mark tour as completed in localStorage
            localStorage.setItem("pinewire_tour_completed", "true");
          }}
        />
      )}
      <main className="dashboard-shell">
        <header className="topbar">
          <div className="brand">
            <img
              className="brand-logo"
              src={pinewireLogo}
              alt="PineWire logo"
            />
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
              <div
                className="activity-header"
                aria-labelledby="activity-heading"
              >
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
                    them in Windows Settings under Network &amp; internet,
                    Mobile hotspot.
                  </p>
                </div>
              )}

              <div
                className="network-controls"
                style={{
                  marginBottom: 12,
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
                  {hotspotInfo?.ssid
                    ? `Detected hotspot: ${hotspotInfo.ssid}`
                    : ""}
                </div>
              </div>

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
                          <div className="device-ip">
                            IP Address: {device.ip}
                          </div>
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
              {/* Capture controls moved below devices */}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  className={`btn ${startLoading ? "loading" : ""}`}
                  disabled={interfaceLoading || startLoading || stopLoading}
                  aria-busy={startLoading}
                  onClick={async () => {
                    if (!selectedInterface) return;
                    setStartLoading(true);
                    try {
                      await fetch(`${BACKEND_HTTP_ORIGIN}/api/capture/start`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          interface_name: selectedInterface,
                        }),
                      });
                      const h = await fetch(BACKEND_HEALTH_URL);
                      if (h.ok) {
                        const j = await h.json();
                        setCaptureState({
                          status: j.capture_running ? "running" : "stopped",
                          interfaceName: j.interface_name,
                        });
                      }
                    } catch (e) {
                      // ignore
                    } finally {
                      setStartLoading(false);
                    }
                  }}
                >
                  {startLoading ? "Starting…" : "Start Capture"}
                </button>

                <button
                  className={`btn ghost ${stopLoading ? "loading" : ""}`}
                  disabled={
                    interfaceLoading ||
                    startLoading ||
                    stopLoading ||
                    !captureRunning
                  }
                  aria-busy={stopLoading}
                  onClick={async () => {
                    setStopLoading(true);
                    try {
                      await fetch(`${BACKEND_HTTP_ORIGIN}/api/capture/stop`, {
                        method: "POST",
                      });
                      const h = await fetch(BACKEND_HEALTH_URL);
                      if (h.ok) {
                        const j = await h.json();
                        setCaptureState({
                          status: j.capture_running ? "running" : "stopped",
                          interfaceName: j.interface_name,
                        });
                      }
                    } catch (e) {
                      // ignore
                    } finally {
                      setStopLoading(false);
                    }
                  }}
                >
                  {stopLoading ? "Stopping…" : "Stop Capture"}
                </button>
              </div>
              {/* Advanced controls positioned below main Network content */}
              <section className="advanced-shell" style={{ marginTop: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h4 style={{ margin: 0 }}>Advanced</h4>
                  <button
                    className="btn ghost"
                    onClick={() => setAdvancedOpen((v) => !v)}
                  >
                    {advancedOpen ? "Hide" : "Show"} advanced
                  </button>
                </div>

                {advancedOpen && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <label style={{ fontSize: 13 }}>Adapter:</label>
                      <select
                        value={selectedInterface}
                        onChange={(e) => setSelectedInterface(e.target.value)}
                        disabled={interfaceLoading}
                        className="adapter-select"
                      >
                        {interfacesList.map((it) => (
                          <option key={it.name} value={it.name}>
                            {it.description || it.name}
                          </option>
                        ))}
                      </select>
                      <span className="adapter-hint">
                        If blank, run <code>netsh wlan show interfaces</code> in
                        PowerShell
                      </span>
                    </div>

                    <p
                      style={{
                        marginTop: 8,
                        color: "var(--muted)",
                        fontSize: "0.95rem",
                      }}
                    >
                      Use this only if PineWire doesn't detect the right adapter
                      automatically.
                    </p>
                  </div>
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
    </>
  );
}

export default Dashboard;
