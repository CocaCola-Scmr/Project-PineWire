import { useState, useEffect, useRef } from "react";
import pinewireLogo from "../assets/logo.png";

const TOUR_STEPS = [
  {
    id: "intro",
    selector: "main.dashboard-shell",
    title: "Welcome to PineWire",
    body: "To get the most out of this tour, connect a device or two to this hotspot (with their permission, of course!). You'll see their live activity as they use apps.",
    highlight: true,
  },
  {
    id: "status-pills",
    selector: ".status-stack",
    title: "Your hotspot, at a glance",
    body: "This laptop is acting as the hotspot right now - these tell you it's actively running, and which connection it's broadcasting on.",
    highlight: true,
  },
  {
    id: "traffic-tab",
    selector: ".tab-btn:nth-of-type(1)",
    title: "You're here: Traffic",
    body: "Once a device connects to this hotspot, its activity shows up live, right here.",
    highlight: true,
  },
  {
    id: "network-tab",
    selector: ".tab-btn:nth-of-type(2)",
    title: "Next door: Network",
    body: "Head here to see the hotspot itself - its details, and which devices are currently connected to it.",
    highlight: true,
  },
  {
    id: "learn-tab",
    selector: ".tab-btn:nth-of-type(3)",
    title: "For later: Learn",
    body: "If anything about how the hotspot or the traffic works feels unfamiliar, the explanations live here - come back anytime.",
    highlight: true,
  },
  {
    id: "counter-pill",
    selector: ".status-chip--count",
    title: "Your running total",
    body: "This counts up every time a connected device's activity gets recognised - right now, it's waiting for a device to join.",
    highlight: true,
  },
];

export default function Tour({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const targetRef = useRef(null);

  const step = TOUR_STEPS[currentStep];
  const isIntroStep = step.id === "intro";

  useEffect(() => {
    const updatePositions = () => {
      if (isIntroStep) {
        // For intro, we don't highlight a specific element — just show as modal
        setTargetRect(null);
        return;
      }

      const selector = step.selector;
      const element = document.querySelector(selector);

      if (element) {
        targetRef.current = element;
        const rect = element.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });

        // Position tooltip below or above the element, centered
        const tooltipWidth = 360;
        const padding = 16;
        const gap = 12;

        let tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
        let tooltipTop = rect.bottom + gap;

        // Clamp to viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (tooltipLeft < padding) {
          tooltipLeft = padding;
        } else if (tooltipLeft + tooltipWidth > viewportWidth - padding) {
          tooltipLeft = viewportWidth - tooltipWidth - padding;
        }

        // If tooltip goes off bottom, position above
        if (tooltipTop + 240 > viewportHeight - padding) {
          tooltipTop = rect.top - 240 - gap;
        }

        setTooltipPos({
          top: Math.max(padding, tooltipTop),
          left: tooltipLeft,
        });
      }
    };

    updatePositions();
    window.addEventListener("resize", updatePositions);
    return () => window.removeEventListener("resize", updatePositions);
  }, [step.selector, isIntroStep]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete?.();
    }
  };

  const handleSkip = () => {
    onComplete?.();
  };

  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  return (
    <>
      {/* Dark overlay */}
      <div className="tour-overlay" aria-hidden="true">
        {/* Only show spotlight SVG when not intro step */}
        {targetRect && !isIntroStep && (
          <svg
            className="tour-spotlight"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            <defs>
              <mask id="tour-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={targetRect.left - 4}
                  y={targetRect.top - 4}
                  width={targetRect.width + 8}
                  height={targetRect.height + 8}
                  fill="black"
                  rx="8"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(9, 12, 15, 0.7)"
              mask="url(#tour-mask)"
            />
          </svg>
        )}

        {/* Plain dark overlay for intro */}
        {isIntroStep && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 12, 15, 0.7)",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Tooltip with pineapple logo */}
        <div
          className="tour-tooltip"
          style={{
            position: "fixed",
            top: isIntroStep ? "50%" : `${tooltipPos.top}px`,
            left: "50%",
            transform: isIntroStep
              ? "translate(-50%, -50%)"
              : `translateX(-50%)`,
            width: "360px",
            maxWidth: "90vw",
            zIndex: 1001,
          }}
        >
          <div className="tour-tooltip-inner">
            <div className="tour-tooltip-header">
              <div className="tour-tooltip-avatar">
                <img src={pinewireLogo} alt="" />
              </div>
              <h3 className="tour-tooltip-title">{step.title}</h3>
            </div>
            <p className="tour-tooltip-body">{step.body}</p>
            <div className="tour-tooltip-actions">
              <button className="btn ghost" onClick={handleSkip} type="button">
                Skip tour
              </button>
              <button
                className="btn primary"
                onClick={handleNext}
                type="button"
              >
                {isLastStep ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        <div
          className="tour-progress"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
          }}
        >
          <div className="tour-dots">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                className={`tour-dot ${i === currentStep ? "tour-dot--active" : ""}`}
                onClick={() => setCurrentStep(i)}
                type="button"
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
