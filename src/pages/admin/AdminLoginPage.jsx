import { useState } from "react";

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

// A single form that starts as an ordinary email/password login. If the
// server says that email hasn't set a password yet (`needsSetup`), it
// expands in place to ask for the two extra things first-time setup needs —
// a confirmation of the password, and the ADMIN_TOKEN that proves whoever's
// typing is actually allowed to claim that account — rather than sending
// them to a separate page.
export default function AdminLoginPage({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | checking | error
  const [error, setError] = useState("");

  const clearErrorOnEdit = (setter) => (e) => {
    setter(e.target.value);
    if (status === "error") setStatus("idle");
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
        setNeedsSetup(true);
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

  const checking = status === "checking";
  const invalid = status === "error";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <form onSubmit={needsSetup ? submitSetup : submitLogin} style={{ width: "min(380px, 100%)" }}>
        <div className="eyebrow" style={{ marginBottom: 20 }}>
          YZ Labs admin
        </div>

        <label className="mono" style={labelStyle}>
          Email
          <input
            type="email"
            autoFocus
            value={email}
            onChange={clearErrorOnEdit(setEmail)}
            disabled={needsSetup}
            style={inputStyle(invalid && !needsSetup)}
          />
        </label>

        <label className="mono" style={{ ...labelStyle, display: "block", marginTop: 14 }}>
          Password
          <input type="password" value={password} onChange={clearErrorOnEdit(setPassword)} style={inputStyle(invalid)} />
        </label>

        {needsSetup && (
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

        <button
          type="submit"
          disabled={checking || !email.trim() || !password || (needsSetup && (!confirmPassword || !setupToken.trim()))}
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 20, opacity: checking ? 0.6 : 1 }}
        >
          {checking ? "Please wait…" : needsSetup ? "Set up and log in" : "Log in"}
        </button>

        {needsSetup && (
          <button
            type="button"
            onClick={() => {
              setNeedsSetup(false);
              setStatus("idle");
              setError("");
            }}
            className="mono"
            style={{ display: "block", width: "100%", textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}
          >
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
