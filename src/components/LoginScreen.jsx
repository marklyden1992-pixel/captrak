/**
 * LoginScreen.jsx — Captrak branded login gate
 *
 * Dummy auth: email = demo@captrak.com, password = demo
 * On success calls onLogin() which sets localStorage + lifts state in App.
 */

import { useState } from "react";

const VALID_EMAIL    = "demo@captrak.com";
const VALID_PASSWORD = "demo";

export default function LoginScreen({ onLogin }) {
  const [email,    setEmail   ] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError   ] = useState("");
  const [loading,  setLoading ] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Simulate a brief async check so it feels real
    setTimeout(() => {
      if (email.trim() === VALID_EMAIL && password === VALID_PASSWORD) {
        onLogin();
      } else {
        setError("Invalid email or password. Please try again.");
        setLoading(false);
      }
    }, 400);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        {/* Accent bar */}
        <div className="login-card-bar" />

        {/* Brand */}
        <div className="login-brand">
          <span className="login-logo-icon">⬡</span>
          <span className="login-logo-text">Captrak</span>
        </div>
        <p className="login-tagline">The Future of Loan Draw Management</p>
        <div className="login-divider" />

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label className="login-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="login-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="login-input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="login-error" role="alert">{error}</div>
          )}

          <button
            className="login-btn"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="login-hint">Demo: demo@captrak.com · demo</p>
      </div>
    </div>
  );
}
