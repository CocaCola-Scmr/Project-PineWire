import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
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
  const programmaticSelectionRef = useRef(false);
  const initialAutoStartRef = useRef(true);
  const captureStateRef = useRef(captureState);

  useEffect(() => {
    captureStateRef.current = captureState;
  }, [captureState]);

  // When the selected adapter changes, automatically start/restart capture so users don't have to
  useEffect(() => {
    if (programmaticSelectionRef.current) {
      programmaticSelectionRef.current = false;
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

  // Load available interfaces for Network controls — re-run when hotspot info changes
  useEffect(() => {
    let cancelled = false;
    async function loadIfaces() {
      setInterfaceLoading(true);
      try {
        const resp = await fetch(`${BACKEND_HTTP_ORIGIN}/api/interfaces`);
        if (!cancelled && resp.ok) {
          const list = await resp.json();
          setInterfacesList(list || []);
          if (list && list.length > 0) {
            // If user already has a selection, keep it — don't override.
            if (selectedInterface) {
              // noop — user already has a selection
            } else {
              // Prefer interface reported by hotspot if present (prefer scapy mapping when available).
              const ifaceName =
                hotspotInfo?.scapy_interface || hotspotInfo?.interface || null;
              if (ifaceName) {
                const lower = String(ifaceName).toLowerCase();
                const match =
                  list.find((it) => it.name === ifaceName) ||
                  list.find((it) => it.description === ifaceName) ||
                  list.find(
                    (it) => String(it.name || "").toLowerCase() === lower,
                  ) ||
                  list.find(
                    (it) =>
                      String(it.description || "").toLowerCase() === lower,
                  ) ||
                  list.find((it) =>
                    String(it.name || "")
                      .toLowerCase()
                      .includes(lower),
                  ) ||
                  list.find((it) =>
                    String(it.description || "")
                      .toLowerCase()
                      .includes(lower),
                  );

                if (match) {
                  programmaticSelectionRef.current = true;
                  setSelectedInterface(match.name);
                } else {
                  programmaticSelectionRef.current = true;
                  setSelectedInterface(list[0].name);
                }
              } else {
                programmaticSelectionRef.current = true;
                setSelectedInterface(list[0].name);
              }
            }
          }
        }
      } catch (e) {
        // ignore
      } finally {
        if (!cancelled) setInterfaceLoading(false);
      }
    }
    loadIfaces();
    return () => {
      cancelled = true;
    };
  }, [hotspotInfo]);

  // Auto-start capture on first mount when we detect a hotspot and capture isn't running
  useEffect(() => {
    if (!initialAutoStartRef.current) return;
    initialAutoStartRef.current = false;

    if (
      captureState.status !== "running" &&
      hotspotAvailable &&
      selectedInterface &&
      !interfaceLoading
    ) {
      (async () => {
        setStartLoading(true);
        try {
          await fetch(`${BACKEND_HTTP_ORIGIN}/api/capture/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ interface_name: selectedInterface }),
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
      })();
    }
  }, [
    hotspotAvailable,
    selectedInterface,
    interfaceLoading,
    captureState.status,
  ]);

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

  const startBtnClass = `btn primary ${startLoading ? "loading" : ""} ${captureRunning ? "btn--running" : ""}`;
  const startBtnLabel = startLoading
    ? "Starting…"
    : captureRunning
      ? captureState.interfaceName
        ? `Running on ${captureState.interfaceName}`
        : "Running"
      : "Start Capture";

  const handleReplayFullTutorial = () => {
    localStorage.removeItem("pinewire_tour_completed");
    navigate("/onboarding");
  };

  const handleReplayInterfaceTour = () => {
    setActiveTab("traffic");
    setShowTour(false);
    window.setTimeout(() => {
      setShowTour(true);
    }, 0);
  };

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
                  <p className="subtle" style={{ marginTop: 6 }}>
                    Note: PineWire may surface background system or app network
                    activity — you may sometimes see app names even when not
                    actively using them.
                  </p>
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
            <section className="learn-shell">
              <div className="learn-header">
                <p className="eyebrow">Learn</p>
                <h2>Learn</h2>
                <p className="subtle">
                  Everything explained, whenever you want it.
                </p>
              </div>

              <section
                className="learn-card"
                aria-labelledby="learn-start-again"
              >
                <h3 id="learn-start-again">Start again</h3>
                <div className="learn-actions">
                  <button
                    type="button"
                    className="learn-action-btn"
                    onClick={handleReplayFullTutorial}
                  >
                    <span className="learn-action-title">
                      Replay the full tutorial
                    </span>
                    <span className="learn-action-copy">
                      Go back through the story from the start.
                    </span>
                  </button>

                  <button
                    type="button"
                    className="learn-action-btn"
                    onClick={handleReplayInterfaceTour}
                  >
                    <span className="learn-action-title">
                      Replay the interface tour
                    </span>
                    <span className="learn-action-copy">
                      Just the quick pointers around the dashboard.
                    </span>
                  </button>
                </div>
              </section>

              <section
                className="learn-card"
                aria-labelledby="learn-staying-safe"
              >
                <h3 id="learn-staying-safe">Staying safe on real networks</h3>
                <ul className="learn-list">
                  <li>
                    Check the network name carefully - rogue hotspots often use
                    names like "Free_WiFi" or copy a real one nearby.
                  </li>
                  <li>
                    Avoid logging into banking or sensitive accounts on public
                    Wi-Fi when you can.
                  </li>
                  <li>
                    Look for the lock - sites using HTTPS keep your traffic
                    sealed, even on a dodgy network.
                  </li>
                  <li>
                    A VPN seals your traffic in its own envelope, even over an
                    unlocked connection.
                  </li>
                </ul>
              </section>

              <section className="learn-card" aria-labelledby="learn-terms">
                <h3 id="learn-terms">Terms, explained simply</h3>
                <dl className="learn-glossary">
                  <div>
                    <dt>Rogue access point</dt>
                    <dd>
                      A hotspot pretending to be normal, set up by someone who
                      should not be watching.
                    </dd>
                  </div>
                  <div>
                    <dt>Man-in-the-Middle</dt>
                    <dd>
                      When someone sits between you and the internet, seeing
                      what passes through.
                    </dd>
                  </div>
                  <div>
                    <dt>HTTPS / HTTP</dt>
                    <dd>
                      Sealed envelope vs. postcard - one&apos;s private, one
                      isn&apos;t.
                    </dd>
                  </div>
                  <div>
                    <dt>DNS</dt>
                    <dd>
                      Basically, the internet&apos;s contacts list - it&apos;s
                      how your device finds the right website.
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="learn-card" aria-labelledby="learn-faq">
                <h3 id="learn-faq">Questions people actually ask</h3>
                <dl className="learn-faq">
                  <div>
                    <dt>Why a pineapple?</dt>
                    <dd>
                      Real devices like this exist and are called Wi-Fi
                      Pineapples - used by security folks (and sometimes
                      attackers) to demonstrate exactly this kind of risk. This
                      app is a safe, friendly version of one.
                    </dd>
                  </div>
                  <div>
                    <dt>Is this actually spying on me?</dt>
                    <dd>
                      No - it only sees devices that connect to this hotspot on
                      purpose, and nothing is ever saved.
                    </dd>
                  </div>
                  <div>
                    <dt>Could someone do this to me for real?</dt>
                    <dd>
                      Yes - that is exactly why this exists. Real ones will not
                      ask permission or look this friendly.
                    </dd>
                  </div>
                </dl>
              </section>

              <section
                className="learn-card"
                aria-labelledby="learn-coming-soon"
              >
                <h3 id="learn-coming-soon">More on the way</h3>
                <p className="learn-coming-soon">
                  Got a question this did not answer? More content is coming
                  soon.
                </p>
              </section>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

export default Dashboard;
