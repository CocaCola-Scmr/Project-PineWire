import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./WelcomePage.css";
import pinewireLogo from "../assets/logo.png";

const CONCEPTS = [
  "Man-in-the-Middle attacks",
  "Rogue access points",
  "Encryption",
  "Live packet traffic",
];

function WelcomePage() {
  const navigate = useNavigate();
  const [isLeaving, setIsLeaving] = useState(false);

  function startOnboarding() {
    setIsLeaving(true);
    window.setTimeout(() => navigate("/onboarding"), 360);
  }

  return (
    <main
      className={`welcome-shell ${isLeaving ? "welcome-shell--leaving" : ""}`}
    >
      <div className="welcome-content">
        <div className="welcome-logo-wrap">
          <img
            className="welcome-logo"
            src={pinewireLogo}
            alt="PineWire logo"
          />
        </div>

        <p className="welcome-eyebrow">Cybersecurity education tool</p>

        <h1 className="welcome-title">
          What can someone see
          <br />
          on your Wi&#8209;Fi?
        </h1>

        <p className="welcome-subtitle">
          A hands-on look at network monitoring — see what your devices connect
          to and whether that traffic is encrypted, in real time.
        </p>

        <ul className="welcome-concepts" aria-label="Topics covered">
          {CONCEPTS.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        <button
          type="button"
          className="welcome-cta"
          onClick={startOnboarding}
          disabled={isLeaving}
        >
          Start exploring
        </button>
      </div>
    </main>
  );
}

export default WelcomePage;
