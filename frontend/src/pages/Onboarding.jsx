import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import pinewireLogo from "../assets/logo.png";
import { Smartphone, Cloud, Wifi, Shield } from "lucide-react";
import { BACKEND_HEALTH_URL, BACKEND_HTTP_ORIGIN } from "../backendConfig";

const SLIDES = [
  { id: 1, mascot: true },
  { id: 2, title: "Becoming the middleman", slide2: true },
  {
    id: 3,
    title: "How devices actually connect",
    slide3: true,
  },
  {
    id: 4,
    title: "Postcards vs Envelopes",
    slide4: true,
  },
  {
    id: 5,
    title: "So what?",
    slide5SoWhat: true,
  },
  { id: 6, title: "Real talk", slide5: true },
  {
    id: 7,
    title: "Consent Agreement",
    slide6: true,
  },
  { id: 8, title: "Quick system check", tutorial: true },
];

function getNextLabel(index) {
  if (index === 0) return "Wait, what's that?";
  if (index === SLIDES.length - 1) return "Finish";
  return "Next";
}

function Onboarding() {
  const [index, setIndex] = useState(0);
  const [viewWidth, setViewWidth] = useState(0);
  const viewRef = useRef(null);
  const [slide2Connected, setSlide2Connected] = useState(false);
  const [slide2Connecting, setSlide2Connecting] = useState(false);

  const [slide3Flipped, setSlide3Flipped] = useState([false, false]);
  const [slide3AllFlipped, setSlide3AllFlipped] = useState(false);
  const [slide4Revealed, setSlide4Revealed] = useState([false, false, false]);
  const [slide4AllRevealed, setSlide4AllRevealed] = useState(false);
  const [slide5Stacked, setSlide5Stacked] = useState([false, false, false]);
  const slide5SessionRef = useRef(null);
  const [slide5Messages, setSlide5Messages] = useState([]);
  const [slide6Accepted, setSlide6Accepted] = useState(false);
  // tutorial slide checks
  const [checking, setChecking] = useState(false);
  const [backendOk, setBackendOk] = useState(null);
  const [interfacesOk, setInterfacesOk] = useState(null);
  const [skipChecks, setSkipChecks] = useState(false);
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return undefined;

    const updateWidth = () => setViewWidth(el.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Re-measure and reset scroll when the active slide changes
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w && w !== viewWidth) setViewWidth(w);
    // ensure any vertical scroll from deeper slides is reset when moving
    // clear any pending reset
    if (viewRef._scrollResetTimer) {
      clearTimeout(viewRef._scrollResetTimer);
      viewRef._scrollResetTimer = null;
    }
    el.scrollTop = 0;
    // schedule a second reset after the slide transition finishes to override
    // any smooth scroll animations (from slide4) that might be in progress
    viewRef._scrollResetTimer = setTimeout(() => {
      if (viewRef.current) viewRef.current.scrollTop = 0;
      viewRef._scrollResetTimer = null;
    }, 520);
  }, [index]);

  // Onboarding remains a simulated tutorial; adapter selection is in Network view.

  // slide4 reveal watcher
  useLayoutEffect(() => {
    setSlide4AllRevealed(slide4Revealed.every(Boolean));
  }, [slide4Revealed]);
  // slide3 flipped watcher
  useLayoutEffect(() => {
    setSlide3AllFlipped(slide3Flipped.every(Boolean));
  }, [slide3Flipped]);

  // Auto-scroll session strip into view when a card is added
  useEffect(() => {
    if (slide5SessionRef.current && slide5Messages.length > 0) {
      // scroll the session strip into view so the timeline and mascot bubble are visible
      slide5SessionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [slide5Messages]);

  function next() {
    if (index < SLIDES.length - 1) setIndex(index + 1);
    else navigate("/dashboard", { state: { fromOnboarding: true } });
  }

  function back() {
    if (index > 0) setIndex(index - 1);
    else navigate("/");
  }

  async function runTutorialChecks() {
    setChecking(true);
    setBackendOk(null);
    setInterfacesOk(null);
    try {
      const h = await fetch(BACKEND_HEALTH_URL);
      setBackendOk(h.ok);
    } catch (e) {
      setBackendOk(false);
    }

    try {
      const resp = await fetch(`${BACKEND_HTTP_ORIGIN}/api/interfaces`);
      setInterfacesOk(resp.ok);
    } catch (e) {
      setInterfacesOk(false);
    }

    setChecking(false);
  }

  return (
    <main className="onboarding-shell">
      {/* <div className="onboarding-top" /> */}

      <div className="onboarding-view" ref={viewRef}>
        <div
          className="onboarding-slides"
          style={{
            width: viewWidth ? `${viewWidth * SLIDES.length}px` : "100%",
            transform: `translateX(-${index * viewWidth}px)`,
          }}
        >
          {SLIDES.map((s) =>
            s.mascot ? (
              <section
                className="onboarding-slide onboarding-slide--mascot"
                key={s.id}
                style={{ width: viewWidth ? `${viewWidth}px` : "100%" }}
              >
                <div className="onboarding-mascot">
                  <div className="mascot-avatar">
                    <img src={pinewireLogo} alt="PineWire mascot" />
                  </div>
                  <div className="mascot-bubble">
                    <p>
                      <em>
                        "Ever heard of a Man-in-the-Middle attack? That's what
                        we'll be doing today (safely of course)"
                      </em>
                    </p>
                  </div>
                </div>
              </section>
            ) : s.slide2 ? (
              <section
                className="onboarding-slide onboarding-slide--center"
                key={s.id}
                style={{ width: viewWidth ? `${viewWidth}px` : "100%" }}
              >
                <h1>{s.title}</h1>

                <div
                  className={`slide2-diagram ${slide2Connected ? "connected" : ""} ${slide2Connecting ? "connecting" : ""}`}
                  role="img"
                  aria-label="Phone to internet diagram"
                >
                  {/* Centered container for SVG line and icons */}
                  <div className="diagram-connector-group">
                    <div className="node phone">
                      <Smartphone size={40} />
                    </div>
                    <svg
                      className="connections"
                      viewBox="0 0 600 140"
                      preserveAspectRatio="none"
                    >
                      <line
                        className="line left"
                        x1="72"
                        y1="50%"
                        x2="288"
                        y2="50%"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                      <line
                        className="line right"
                        x1="312"
                        y1="50%"
                        x2="528"
                        y2="50%"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </svg>

                    {/* center wifi icon shown before connection */}
                    {!slide2Connected && !slide2Connecting && (
                      <div className="wifi-center" aria-hidden>
                        <Wifi size={56} />
                      </div>
                    )}
                    {/* pineapple icon shown after connection */}
                    {(slide2Connected || slide2Connecting) && (
                      <div className="pineapple-icon" aria-hidden>
                        <img src={pinewireLogo} alt="" />
                      </div>
                    )}

                    {/* traffic layer: dots animate across when connected */}
                    <div className="traffic-layer" aria-hidden>
                      <div className="traffic-dot d1" />
                      <div className="traffic-dot d2" />
                      <div className="traffic-dot d3" />
                    </div>

                    <div className="node internet">
                      <Cloud size={40} />
                    </div>
                  </div>
                </div>

                {!slide2Connected && (
                  <div className="mascot-bubble slide2-message slide2-message--inline">
                    <div className="mascot-speaker">
                      <img src={pinewireLogo} alt="PineWire mascot" />
                    </div>
                    <p>
                      Easiest way to explain it? Connect to my (totally safe)
                      Wi-Fi...
                    </p>
                  </div>
                )}

                {slide2Connected && (
                  <div className="mascot-bubble slide2-message slide2-message--top">
                    <p>
                      Congrats, you just made me the Man-in-the-Middle.
                      Everything your phone sends now goes through me!
                    </p>
                  </div>
                )}

                <div className="slide2-controls">
                  <button
                    className="btn primary"
                    onClick={() => {
                      if (slide2Connected || slide2Connecting) return;
                      setSlide2Connecting(true);
                      setTimeout(() => {
                        setSlide2Connecting(false);
                        setSlide2Connected(true);
                      }, 720);
                    }}
                    disabled={slide2Connected || slide2Connecting}
                  >
                    {slide2Connected
                      ? "Connected"
                      : slide2Connecting
                        ? "Connecting…"
                        : "Connect"}
                  </button>
                </div>
              </section>
            ) : s.slide3 ? (
              <section
                className="onboarding-slide onboarding-slide--center"
                key={s.id}
                style={{ width: viewWidth ? `${viewWidth}px` : "100%" }}
              >
                <h1>{s.title}</h1>

                <div style={{ marginTop: 30 }} className="onboarding-mascot">
                  <div className="mascot-bubble" style={{ marginTop: 6 }}>
                    <div className="mascot-speaker">
                      <img src={pinewireLogo} alt="PineWire mascot" />
                    </div>
                    <p>
                      Nobody taps 'connect to sketchy WiFi Pineapple' on
                      purpose... So how does it happen?
                    </p>
                  </div>
                </div>

                <div
                  className="flip-cards"
                  role="list"
                  aria-label="Ways devices connect"
                >
                  {[
                    {
                      title: "Evil twin spoofing",
                      body: "Devices will automatically join (what they think are) known networks",
                    },
                    {
                      title: "Familiar-sounding open networks",
                      body: "Users sometimes join open networks that look legitimate (e.g. 'CoffeeShop WiFi')",
                    },
                  ].map((card, i) => {
                    const isFlipped = slide3Flipped[i];
                    return (
                      <button
                        key={card.title}
                        role="listitem"
                        className={`flip-card ${isFlipped ? "is-flipped" : ""}`}
                        onClick={() => {
                          const copy = [...slide3Flipped];
                          copy[i] = !copy[i];
                          setSlide3Flipped(copy);
                        }}
                        aria-pressed={isFlipped}
                      >
                        <div className="flip-card-inner">
                          <div className="flip-card-front">
                            <div>
                              <strong>{card.title}</strong>
                            </div>
                            <div className="flip-hint">Click to reveal</div>
                          </div>
                          <div className="flip-card-back">
                            <p>{card.body}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!slide3AllFlipped && (
                  <div className="reveal-note" style={{ marginTop: 15 }}>
                    Reveal to continue
                  </div>
                )}
              </section>
            ) : s.slide4 ? (
              <section
                className="onboarding-slide onboarding-slide--center"
                key={s.id}
                style={{ width: viewWidth ? `${viewWidth}px` : "100%" }}
              >
                <h1>{s.title}</h1>

                <div style={{ marginTop: 30 }} className="onboarding-mascot">
                  <div className="mascot-bubble" style={{ marginTop: 6 }}>
                    <div className="mascot-speaker">
                      <img src={pinewireLogo} alt="PineWire mascot" />
                    </div>
                    <p>But what can I actually see when you're connected?</p>
                  </div>
                </div>

                <div className="slide4-note" style={{ marginTop: 12 }}>
                  <p>
                    Links starting with{" "}
                    <span className="inline-code">http://</span> are unencrypted
                    (open)
                    <br></br>
                    Links starting with{" "}
                    <span className="inline-code">https://</span> are encrypted
                    (sealed)
                  </p>
                </div>

                <div
                  className="status-cards"
                  role="list"
                  aria-label="Example apps"
                >
                  {[
                    {
                      title: "Banking app",
                      sealed: true,
                      reason:
                        "HTTPS encrypted, traffic is sealed. I see you're using the app, but not much else",
                    },
                    {
                      title: "Old forum",
                      sealed: false,
                      reason: "HTTP unencrypted. I can read everything!",
                    },
                    {
                      title: "Streaming service",
                      sealed: true,
                      reason:
                        "HTTPS encrypted, traffic is sealed. I see you're using the app, but not much else",
                    },
                  ].map((c, i) => {
                    const revealed = slide4Revealed[i];
                    return (
                      <button
                        key={c.title}
                        className={`status-card ${revealed ? "revealed" : ""}`}
                        onClick={() => {
                          if (slide4Revealed[i]) return;
                          const copy = [...slide4Revealed];
                          copy[i] = true;
                          setSlide4Revealed(copy);
                        }}
                        aria-pressed={revealed}
                        role="listitem"
                      >
                        <div className="status-card-inner">
                          <div className="status-card-title">{c.title}</div>
                          <div className="status-card-body">
                            {revealed ? (
                              <>
                                <span
                                  className={`status-indicator ${c.sealed ? "sealed" : "open"}`}
                                />
                                <span className="status-reason">
                                  {c.reason}
                                </span>
                              </>
                            ) : (
                              <span className="status-hint">
                                Click to reveal
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {slide4AllRevealed && (
                  <div
                    ref={(el) => {
                      if (el)
                        el.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                    }}
                    className="mascot-bubble"
                    style={{ marginTop: 60 }}
                  >
                    <div className="mascot-speaker">
                      <img src={pinewireLogo} alt="PineWire mascot" />
                    </div>
                    <p>
                      Most big stuff uses HTTPS these days, but every now and
                      then sites use HTTP which let us read everything. When
                      this happens, I'll flag it for you!
                    </p>
                  </div>
                )}
              </section>
            ) : s.slide5SoWhat ? (
              <section
                className="onboarding-slide onboarding-slide--center"
                key={s.id}
                style={{ width: viewWidth ? `${viewWidth}px` : "100%" }}
              >
                <h1>{s.title}</h1>

                <div style={{ marginTop: 24 }} className="onboarding-mascot">
                  <div className="mascot-bubble" style={{ marginTop: 6 }}>
                    <div className="mascot-speaker">
                      <img src={pinewireLogo} alt="PineWire mascot" />
                    </div>
                    <p>
                      <em>
                        So I can see you're using your banking app. Big deal,
                        right? Well actually, yes...
                      </em>
                    </p>
                  </div>
                </div>

                <div className="slide5-session" style={{ marginTop: 20 }}>
                  <div className="slide4-note" style={{ marginTop: 6 }}>
                    <p>Tap each card to see what it adds to the session.</p>
                  </div>

                  <div
                    className="status-cards"
                    role="list"
                    aria-label="Example apps"
                  >
                    {[
                      {
                        title: "Banking app",
                        key: "bank",
                      },
                      {
                        title: "Old forum",
                        key: "forum",
                      },
                      {
                        title: "Streaming service",
                        key: "stream",
                      },
                    ].map((c, i) => {
                      const placed = slide5Stacked[i];
                      return (
                        <button
                          key={c.key}
                          className={`status-card ${placed ? "revealed" : ""}`}
                          onClick={() => {
                            if (slide5Stacked[i]) return;
                            const copy = [...slide5Stacked];
                            copy[i] = true;
                            setSlide5Stacked(copy);

                            // add mascot message for this card
                            const msg =
                              c.key === "bank"
                                ? "Checking your balance."
                                : c.key === "forum"
                                  ? "And this one? I don't even have to guess - HTTP means I can read exactly what you typed."
                                  : "Unwinding after. Three taps, and I've already got a pretty specific picture of your morning.";
                            setSlide5Messages((prev) => [
                              ...prev,
                              { key: c.key, msg },
                            ]);
                          }}
                          aria-pressed={placed}
                          role="listitem"
                        >
                          <div className="status-card-inner">
                            <div className="status-card-title">{c.title}</div>
                            <div className="status-card-body">
                              {placed ? (
                                <span className="status-reason">
                                  Added to session
                                </span>
                              ) : (
                                <span className="status-hint">
                                  Tap to add to session
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div
                    ref={slide5SessionRef}
                    className="session-strip"
                    style={{ marginTop: 18 }}
                  >
                    <div className="session-meta">
                      10:03am–10:11am · one sitting · one hotspot
                    </div>
                    <div className="session-items">
                      {slide5Messages.map((m, idx) => (
                        <div key={`${m.key}-${idx}`} className="session-item">
                          <div className="session-item-title">
                            {m.key === "bank"
                              ? "Banking app"
                              : m.key === "forum"
                                ? "Old forum"
                                : "Streaming"}
                          </div>
                          <div className="session-item-msg">{m.msg}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {slide5Messages.length > 0 && (
                    <div className="mascot-bubble" style={{ marginTop: 18 }}>
                      <div className="mascot-speaker">
                        <img src={pinewireLogo} alt="PineWire mascot" />
                      </div>
                      <p>
                        {slide5Messages.length === 3
                          ? "That's just one session. If you connected here again tomorrow - same café, same hotspot - I'd start noticing patterns too."
                          : slide5Messages[slide5Messages.length - 1].msg}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            ) : s.slide5 ? (
              <section
                className="onboarding-slide onboarding-slide--center"
                key={s.id}
                style={{ width: viewWidth ? `${viewWidth}px` : "100%" }}
              >
                <h1>{s.title}</h1>

                <div style={{ marginTop: 30 }} className="onboarding-mascot">
                  <div className="mascot-bubble" style={{ marginTop: 6 }}>
                    <div className="mascot-speaker">
                      <img src={pinewireLogo} alt="PineWire mascot" />
                    </div>
                    <p>
                      <em>
                        "Real attackers won't give warning, introduce themelves,
                        or have a friendly pineapple, and definitely won't ask
                        permission! I'm helping you run a friendly demo version
                        - don't let this make you overconfident out there!"
                      </em>
                    </p>
                  </div>
                </div>

                <div className="slide5-graphics" aria-hidden>
                  <div className="slide5-icon">
                    <Shield size={40} />
                  </div>
                  <div className="slide5-icon">
                    <Wifi size={36} />
                  </div>
                  <div className="slide5-icon">
                    <Cloud size={36} />
                  </div>
                </div>
              </section>
            ) : s.slide6 ? (
              <section
                className="onboarding-slide onboarding-slide--center"
                key={s.id}
                style={{ width: viewWidth ? `${viewWidth}px` : "100%" }}
              >
                <h1>{s.title}</h1>

                <div style={{ marginTop: 24 }} className="onboarding-mascot">
                  <div className="mascot-bubble" style={{ marginTop: 6 }}>
                    <div className="mascot-speaker">
                      <img src={pinewireLogo} alt="PineWire mascot" />
                    </div>
                    <p>
                      This app turns your device into a hotspot - anything that
                      connects to it passes through here first, which is how I
                      can see the following.
                    </p>
                  </div>
                </div>

                <div className="slide6-content">
                  <div className="slide6-section">
                    <h3>What I can see:</h3>
                    <ul>
                      <li>
                        <strong>
                          Which websites and apps connected devices are using
                        </strong>{" "}
                        - like "using Instagram" or "using your bank's app" -
                        but not what you're doing inside them
                      </li>
                      <li>
                        <strong>
                          Whether each connection is encrypted or not
                        </strong>
                        - I'll flag it live if something isn't
                      </li>
                      <li>
                        <strong>Basic connection details</strong> - which device
                        is talking to which service, and when
                      </li>
                    </ul>
                  </div>

                  <div className="slide6-section">
                    <h3>What I can't see:</h3>
                    <ul>
                      <li>
                        Passwords, messages, or page content - unless a site is
                        genuinely unlocked, which I'll clearly flag
                      </li>
                      <li>
                        Anything on devices that never connect to this hotspot
                      </li>
                    </ul>
                  </div>

                  <div className="slide6-section">
                    <h3>What happens to it:</h3>
                    <p>
                      <em>
                        Nothing is saved. Close the app and it's all gone, no
                        logs, nothing leaves this device.
                      </em>
                    </p>
                  </div>
                </div>

                <div className="slide6-consent">
                  <label className="consent-checkbox">
                    <input
                      type="checkbox"
                      checked={slide6Accepted}
                      onChange={(e) => setSlide6Accepted(e.target.checked)}
                    />
                    <span>
                      I understand this creates a hotspot other devices connect
                      to, and what it can see - and I agree to continue.
                    </span>
                  </label>
                </div>
              </section>
            ) : s.tutorial ? (
              <section
                className="onboarding-slide onboarding-slide--center"
                key={s.id}
                style={{ width: viewWidth ? `${viewWidth}px` : "100%" }}
              >
                <h1>{s.title}</h1>

                <div style={{ marginTop: 18 }} className="onboarding-mascot">
                  <div className="mascot-bubble" style={{ marginTop: 6 }}>
                    <div className="mascot-speaker">
                      <img src={pinewireLogo} alt="PineWire mascot" />
                    </div>
                    <p>
                      Quick check to make sure the backend is running and basic
                      interfaces are available. The README has full setup steps,
                      if you face any errors.
                    </p>
                  </div>
                </div>

                <div className="tutorial-checks" style={{ marginTop: 18 }}>
                  <div style={{ marginBottom: 12 }}>
                    <strong>Checks</strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      Backend status:{" "}
                      {backendOk === null ? (
                        "Not checked"
                      ) : backendOk ? (
                        <span className="check-ok">Up</span>
                      ) : (
                        <span className="check-fail">Unreachable</span>
                      )}
                    </div>
                    <div>
                      Interfaces endpoint:{" "}
                      {interfacesOk === null ? (
                        "Not checked"
                      ) : interfacesOk ? (
                        <span className="check-ok">Found</span>
                      ) : (
                        <span className="check-fail">Unavailable</span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 18,
                      display: "flex",
                      gap: 12,
                      justifyContent: "center",
                    }}
                  >
                    <button
                      className="btn primary"
                      onClick={runTutorialChecks}
                      disabled={checking}
                    >
                      {checking ? "Checking…" : "Run checks"}
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => setSkipChecks(true)}
                    >
                      Skip checks
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <section
                className="onboarding-slide"
                key={s.id}
                style={{ width: viewWidth ? `${viewWidth}px` : "100%" }}
              >
                <h1>{s.title}</h1>
                <p>{s.body}</p>
              </section>
            ),
          )}
        </div>
      </div>

      <div className="onboarding-actions">
        <button className="btn ghost" onClick={back}>
          Back
        </button>

        <div className="onboarding-dots" aria-hidden>
          {SLIDES.map((s, i) => (
            <span
              key={s.id}
              className={`onboarding-dot ${i === index ? "onboarding-dot--active" : ""}`}
            />
          ))}
        </div>

        {/** Footer primary: support gating for slide2, slide4, and slide6 */}
        <button
          className="btn primary"
          onClick={next}
          disabled={
            SLIDES[index] && SLIDES[index].tutorial
              ? !(backendOk || skipChecks)
              : SLIDES[index] && SLIDES[index].slide2
                ? !slide2Connected
                : SLIDES[index] && SLIDES[index].slide3
                  ? !slide3AllFlipped
                  : SLIDES[index] && SLIDES[index].slide4
                    ? !slide4AllRevealed
                    : SLIDES[index] && SLIDES[index].slide6
                      ? !slide6Accepted
                      : false
          }
          aria-disabled={
            SLIDES[index] && SLIDES[index].tutorial
              ? !(backendOk || skipChecks)
              : SLIDES[index] && SLIDES[index].slide2
                ? !slide2Connected
                : SLIDES[index] && SLIDES[index].slide3
                  ? !slide3AllFlipped
                  : SLIDES[index] && SLIDES[index].slide4
                    ? !slide4AllRevealed
                    : SLIDES[index] && SLIDES[index].slide6
                      ? !slide6Accepted
                      : false
          }
        >
          {SLIDES[index] && SLIDES[index].tutorial
            ? backendOk || skipChecks
              ? "Next"
              : "Run checks to continue"
            : SLIDES[index] && SLIDES[index].slide2
              ? slide2Connected
                ? "How would this happen?"
                : "Connect to continue"
              : SLIDES[index] && SLIDES[index].slide3
                ? slide3AllFlipped
                  ? "Next"
                  : "Reveal to continue"
                : SLIDES[index] && SLIDES[index].slide4
                  ? slide4AllRevealed
                    ? "So what?"
                    : "Reveal to continue"
                  : SLIDES[index] && SLIDES[index].slide6
                    ? slide6Accepted
                      ? "I UNDERSTAND AND AGREE"
                      : "Check the box to continue"
                    : getNextLabel(index)}
        </button>
      </div>
    </main>
  );
}

export default Onboarding;
