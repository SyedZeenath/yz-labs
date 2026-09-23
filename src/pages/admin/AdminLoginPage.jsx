import { useState } from "react";

export default function AdminLoginPage({ onLoggedIn }) {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("idle"); // idle | checking | error
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!token.trim() || status === "checking") return;
    setStatus("checking");
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't log in.");
      onLoggedIn();
    } catch (err) {
      setStatus("error");
      setError(err.message || "Couldn't log in.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <form onSubmit={submit} style={{ width: "min(360px, 100%)" }}>
        <div className="eyebrow" style={{ marginBottom: 20 }}>
          YZ Labs admin
        </div>
        <label className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Admin token
          <input
            type="password"
            autoFocus
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            aria-invalid={status === "error" ? true : undefined}
            style={{
              display: "block",
              width: "100%",
              marginTop: 8,
              background: "transparent",
              border: `1px solid ${status === "error" ? "#FF8A7A" : "var(--border-strong)"}`,
              padding: "12px 14px",
              color: "var(--fg)",
              fontSize: 14,
              fontFamily: "inherit",
            }}
          />
        </label>
        <button
          type="submit"
          disabled={!token.trim() || status === "checking"}
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 16, opacity: !token.trim() || status === "checking" ? 0.6 : 1 }}
        >
          {status === "checking" ? "Checking…" : "Log in"}
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
