import { useState } from "react";
import { useSearchParams } from "react-router-dom";

const inputStyle = (invalid) => ({
  display: "block",
  width: "100%",
  marginTop: 8,
  background: "transparent",
  border: `1px solid ${invalid ? "#FF8A7A" : "var(--border-strong)"}`,
  padding: "12px 14px",
  color: "var(--fg)",
  fontSize: 14,
  fontFamily: "inherit",
});

const labelStyle = { fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" };
const linkButtonStyle = { display: "block", width: "100%", textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--muted)", cursor: "pointer" };

// A single form that starts as an ordinary email/password login, and
// expands in place rather than sending people to separate pages:
// - server says the email hasn't set a password yet (`needsSetup`) -> asks
//   for a confirmation password and the ADMIN_TOKEN that proves whoever's
//   typing is actually allowed to claim that account.
// - "Forgot password?" -> asks for just the email, then POSTs
//   /api/admin/request-reset (always the same "check your email" outcome,
//   whether or not that email is actually an admin — this form must never
//   reveal who's on the list).
// - the URL itself carries `?reset=<token>` (from the email that request
//   sends) -> skips straight to choosing a new password; the token IS the
//   proof of identity here, verified server-side in POST
//   /api/admin/reset-password.
export default function AdminLoginPage({ onLoggedIn }) {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("reset") || "";

  const [mode, setMode] = useState(resetToken ? "reset" : "login"); // login | setup | forgot | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [status, setStatus] = useState("idle"); // idle | checking | error | sent
  const [error, setError] = useState("");

  const clearErrorOnEdit = (setter) => (e) => {
    setter(e.target.value);
    if (status === "error") setStatus("idle");
  };

  const goTo = (nextMode) => {
    setMode(nextMode);
    setStatus("idle");
    setError("");
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password || status === "checking") return;
    setStatus("checking");
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) return onLoggedIn();
      if (body.needsSetup) {
        setMode("setup");
        setStatus("idle");
        return;
      }
      throw new Error(body.error || "Couldn't log in.");
    } catch (err) {
      setStatus("error");
      setError(err.message || "Couldn't log in.");
    }
  };

  const submitSetup = async (e) => {
    e.preventDefault();
    if (status === "checking") return;
    if (password !== confirmPassword) {
      setStatus("error");
      setError("Those passwords don't match.");
      return;
    }
    setStatus("checking");
    setError("");
    try {
      const res = await fetch("/api/admin/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, token: setupToken.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't set up that account.");
      onLoggedIn();
    } catch (err) {
      setStatus("error");
      setError(err.message || "Couldn't set up that account.");
    }
  };

  const submitForgot = async (e) => {
    e.preventDefault();
    if (!email.trim() || status === "checking") return;
    setStatus("checking");
    try {
      await fetch("/api/admin/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // Same outcome either way — a network hiccup here shouldn't reveal
      // anything different than a normal response would.
    }
    setStatus("sent");
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (status === "checking") return;
    if (password !== confirmPassword) {
      setStatus("error");
      setError("Those passwords don't match.");
      return;
    }
    setStatus("checking");
    setError("");
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't reset that password.");
      onLoggedIn();
    } catch (err) {
      setStatus("error");
      setError(err.message || "Couldn't reset that password.");
    }
  };

  const checking = status === "checking";
  const invalid = status === "error";

  if (mode === "reset") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <form onSubmit={submitReset} style={{ width: "min(380px, 100%)" }}>
          <div className="eyebrow" style={{ marginBottom: 20 }}>
            Reset your password
          </div>

          <label className="mono" style={labelStyle}>
            New password
            <input type="password" autoFocus value={password} onChange={clearErrorOnEdit(setPassword)} style={inputStyle(invalid)} />
          </label>
          <label className="mono" style={{ ...labelStyle, display: "block", marginTop: 14 }}>
            Confirm new password
            <input type="password" value={confirmPassword} onChange={clearErrorOnEdit(setConfirmPassword)} style={inputStyle(invalid)} />
          </label>

          <button
            type="submit"
            disabled={checking || !password || !confirmPassword}
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 20, opacity: checking ? 0.6 : 1 }}
          >
            {checking ? "Please wait…" : "Reset password"}
          </button>

          {status === "error" && (
            <p role="alert" className="mono" style={{ fontSize: 12, color: "#FF8A7A", marginTop: 12 }}>
              {error}
            </p>
          )}
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <form onSubmit={mode === "setup" ? submitSetup : mode === "forgot" ? submitForgot : submitLogin} style={{ width: "min(380px, 100%)" }}>
        <div className="eyebrow" style={{ marginBottom: 20 }}>
          YZ Labs admin
        </div>

        {mode === "forgot" ? (
          status === "sent" ? (
            <p className="mono" style={{ fontSize: 13, color: "var(--fg-dim)", lineHeight: 1.5 }}>
              If that email is on the admin list, a reset link is on its way — it's valid for 30 minutes.
            </p>
          ) : (
            <>
              <p className="mono" style={{ fontSize: 12, color: "var(--fg-dim)", lineHeight: 1.5, marginBottom: 14 }}>
                Enter your admin email and we'll send a reset link if it's on the list.
              </p>
              <label className="mono" style={labelStyle}>
                Email
                <input type="email" autoFocus value={email} onChange={clearErrorOnEdit(setEmail)} style={inputStyle(invalid)} />
              </label>
            </>
          )
        ) : (
          <>
            <label className="mono" style={labelStyle}>
              Email
              <input
                type="email"
                autoFocus
                value={email}
                onChange={clearErrorOnEdit(setEmail)}
                disabled={mode === "setup"}
                style={inputStyle(invalid && mode !== "setup")}
              />
            </label>

            <label className="mono" style={{ ...labelStyle, display: "block", marginTop: 14 }}>
              Password
              <input type="password" value={password} onChange={clearErrorOnEdit(setPassword)} style={inputStyle(invalid)} />
            </label>
          </>
        )}

        {mode === "setup" && (
          <>
            <p className="mono" style={{ fontSize: 12, color: "var(--fg-dim)", lineHeight: 1.5, marginTop: 16 }}>
              This account hasn't been set up yet. Choose a password and enter the admin setup key you were given to
              activate it.
            </p>
            <label className="mono" style={{ ...labelStyle, display: "block", marginTop: 14 }}>
              Confirm password
              <input type="password" value={confirmPassword} onChange={clearErrorOnEdit(setConfirmPassword)} style={inputStyle(invalid)} />
            </label>
            <label className="mono" style={{ ...labelStyle, display: "block", marginTop: 14 }}>
              Admin setup key
              <input type="password" value={setupToken} onChange={clearErrorOnEdit(setSetupToken)} style={inputStyle(invalid)} />
            </label>
          </>
        )}

        {!(mode === "forgot" && status === "sent") && (
          <button
            type="submit"
            disabled={
              checking ||
              (mode === "forgot"
                ? !email.trim()
                : !email.trim() || !password || (mode === "setup" && (!confirmPassword || !setupToken.trim())))
            }
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 20, opacity: checking ? 0.6 : 1 }}
          >
            {checking ? "Please wait…" : mode === "setup" ? "Set up and log in" : mode === "forgot" ? "Send reset link" : "Log in"}
          </button>
        )}

        {mode === "login" && (
          <button type="button" onClick={() => goTo("forgot")} className="mono" style={linkButtonStyle}>
            Forgot password?
          </button>
        )}

        {(mode === "setup" || mode === "forgot") && (
          <button type="button" onClick={() => goTo("login")} className="mono" style={linkButtonStyle}>
            ← Back to login
          </button>
        )}

        {status === "error" && (
          <p role="alert" className="mono" style={{ fontSize: 12, color: "#FF8A7A", marginTop: 12 }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
