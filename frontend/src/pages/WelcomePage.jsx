import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./WelcomePage.css";
import pinewireLogo from "../assets/logo.png";

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
          A hands-on educational demo, where you get to play the other side.
          Step behind the curtain and run the hotspot yourself...
        </p>

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
