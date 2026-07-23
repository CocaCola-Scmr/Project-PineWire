import { useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import pinewireLogo from "../assets/logo.png";

const SLIDES = [
  { id: 1, mascot: true },
  ...Array.from({ length: 7 }, (_, i) => ({
    id: i + 2,
    title: `Welcome — Slide ${i + 2}`,
    body: `Placeholder content for slide ${i + 2}. Replace with onboarding text.`,
  })),
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

  function next() {
    if (index < SLIDES.length - 1) setIndex(index + 1);
    else navigate("/dashboard");
  }

  function back() {
    if (index > 0) setIndex(index - 1);
    else navigate("/");
  }

  return (
    <main className="onboarding-shell">
      <div className="onboarding-top">
        <div className="onboarding-dots" aria-hidden>
          {SLIDES.map((s, i) => (
            <span
              key={s.id}
              className={`onboarding-dot ${i === index ? "onboarding-dot--active" : ""}`}
            />
          ))}
        </div>
      </div>

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
                        "Ever heard of a Man-in-the-Middle attack? That's
                        basically my whole personality."
                      </em>
                    </p>
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
        <button className="btn primary" onClick={next}>
          {getNextLabel(index)}
        </button>
      </div>
    </main>
  );
}

export default Onboarding;
