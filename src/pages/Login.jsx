import { useEffect, useRef, useState } from "react";
import "./Login.css";
import "./LoginMotion.css";
import { apiRequest } from "../api";

function Login({ onLoginSuccess }) {
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const loginPageRef = useRef(null);

  useEffect(() => {
    const page = loginPageRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (!page || reduceMotion || coarsePointer) return undefined;

    let pointerPosition = null;
    let frameId = 0;
    const updatePointerGlow = () => {
      frameId = 0;
      if (!pointerPosition) return;
      const x = Math.max(0, Math.min(100, (pointerPosition.x / window.innerWidth) * 100));
      const y = Math.max(0, Math.min(100, (pointerPosition.y / window.innerHeight) * 100));
      page.style.setProperty("--auth-light-x", `${x}%`);
      page.style.setProperty("--auth-light-y", `${y}%`);
    };
    const handlePointerMove = (event) => {
      if (event.pointerType === "touch") return;
      pointerPosition = { x: event.clientX, y: event.clientY };
      if (!frameId) frameId = window.requestAnimationFrame(updatePointerGlow);
    };
    const handlePointerLeave = () => {
      pointerPosition = null;
      page.style.setProperty("--auth-light-x", "72%");
      page.style.setProperty("--auth-light-y", "28%");
    };

    page.addEventListener("pointermove", handlePointerMove, { passive: true });
    page.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    return () => {
      page.removeEventListener("pointermove", handlePointerMove);
      page.removeEventListener("pointerleave", handlePointerLeave);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setAuthMessage("");
    const formData = new FormData(event.currentTarget);
    const account = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || ""),
      rememberMe,
    };

    try {
      await apiRequest(isCreateMode ? "/api/auth/register" : "/api/auth/login", account);
      onLoginSuccess?.();
    } catch (error) {
      setAuthMessage(error.message);
    }
  };

  const selectMode = (createMode) => {
    setIsCreateMode(createMode);
    setAuthMessage("");
  };

  return (
    <div className="login-page" ref={loginPageRef}>

      {/* Header */}

      <header className="login-header">
        <button className="login-logo" type="button" onClick={() => selectMode(false)}>
          <span className="login-logo-icon">🛡</span>
          <span>Forensi<span>X</span></span>
        </button>

        <div className={`login-header-actions ${isCreateMode ? "register-mode" : ""}`} role="group" aria-label="Login or register">
          <button
            className={`login-header-button ${!isCreateMode ? "active" : ""}`}
            type="button"
            aria-pressed={!isCreateMode}
            onClick={() => selectMode(false)}
          >
            Login
          </button>
          <button
            className={`login-header-button ${isCreateMode ? "active" : ""}`}
            type="button"
            aria-pressed={isCreateMode}
            onClick={() => selectMode(true)}
          >
            Register
          </button>
        </div>
      </header>

      {/* Main */}

      <main className="auth-shell">

        {/* LEFT */}

        <section className="auth-panel">

          <div className={`auth-heading ${isCreateMode ? "auth-mode-register" : "auth-mode-login"}`}>

            <div className="protected-label">
              <span></span>
              DEMO PREVIEW
            </div>

            <h1>
              {isCreateMode
                ? "Create your access."
                : "Welcome back."}
            </h1>

            <p>
              {isCreateMode
                ? "Create a ForensiX account to open the console."
                : "Log in with your ForensiX account to open the console."}
            </p>

          </div>

          <form className={isCreateMode ? "auth-mode-register" : "auth-mode-login"} onSubmit={handleSubmit}>

            {authMessage && <p className="operation-error" role="status">{authMessage}</p>}

            {/* Name */}

            {isCreateMode && (
              <div className="form-field">

                <label htmlFor="full-name">Full name</label>

                <input
                  type="text"
                  id="full-name"
                  name="name"
                  autoComplete="name"
                  placeholder="Your full name"
                  maxLength={80}
                  required
                />

              </div>
            )}

            {/* Email */}

            <div className="form-field">

              <label htmlFor="work-email">Work email</label>

              <input
                type="email"
                id="work-email"
                name="email"
                autoComplete="email"
                placeholder="name@organisation.com"
                required
              />

            </div>

            {/* Password */}

            <div className="form-field">

              <div className="password-label">

                <label htmlFor="account-password">Password</label>

                {!isCreateMode && (
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={() => setAuthMessage("Password reset is not connected in this prototype.")}
                  >
                    Forgot password?
                  </button>
                )}

              </div>

              <div className="password-box">

                <input
                  type={showPassword ? "text" : "password"}
                  id="account-password"
                  name="password"
                  autoComplete={isCreateMode ? "new-password" : "current-password"}
                  placeholder="Enter your password"
                  minLength={8}
                  maxLength={128}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>

              </div>

            </div>

            {/* Remember */}

            <label className="remember-row">

              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) =>
                  setRememberMe(event.target.checked)
                }
              />

              <span>
                Remember this device
              </span>

            </label>

            {/* Main button */}

            <button
              type="submit"
              className="auth-submit"
            >
              {isCreateMode
                ? "Create account"
                : "Log in"}

              <span>→</span>
            </button>

          </form>

          {/* Divider */}

          <div className="continue-divider">
            <span></span>
            <p>or continue with</p>
            <span></span>
          </div>

          {/* Social */}

          <div className="social-buttons">

            <button
              type="button"
              onClick={() => setAuthMessage("Google sign-in is not configured in this prototype.")}
            >
              <span className="google-icon">G</span>
              Google
            </button>

            <button
              type="button"
              onClick={() => setAuthMessage("Microsoft sign-in is not configured in this prototype.")}
            >
              <span className="microsoft-icon">
                ▦
              </span>
              Microsoft
            </button>

          </div>

          <p className="terms-text">
            Accounts are stored on this backend; scans and recovery use sample data only.
          </p>

        </section>

        {/* RIGHT */}

        <section className="auth-visual">

          <div className="case-badge">
            <span>●</span>
            SAMPLE CASE CONTEXT
          </div>

          <div className="visual-content">

            <div className="protocol-label">
              <span></span>
              FORENSIX DEMO PROTOCOL
            </div>

            <h2>
              Evidence is
              <br />

              <span>
                only as strong
              </span>

              <br />

              as its trail.
            </h2>

            <p>
              This preview shows the case details an audit workflow could capture
              before, during and after an operation.
            </p>

          </div>

          {/* Orbital graphic */}

          <div className="forensic-orbit">

            <div className="orbit orbit-one"></div>
            <div className="orbit orbit-two"></div>
            <div className="orbit orbit-three"></div>

            <div className="orbit-dot dot-one"></div>
            <div className="orbit-dot dot-two"></div>
            <div className="orbit-dot dot-three"></div>

            <div className="security-core">
              🛡
            </div>

          </div>

          {/* Status */}

          <div className="integrity-card">

            <div className="integrity-icon">
              ✓
            </div>

            <div>
            <small>
                INTEGRITY PREVIEW
              </small>

              <strong>
                Audit trail preview
              </strong>
            </div>

            <span>
              DEMO
            </span>

          </div>

        </section>

      </main>

    </div>
  );
}

export default Login;
