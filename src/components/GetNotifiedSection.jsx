import { useState } from "react";
import RevealText from "./RevealText.jsx";
import RevealBox from "./RevealBox.jsx";

// The plain, normal-flow "Get notified" heading + waitlist form — used only
// by ClassicHome (reduced-motion / budget-Android visitors). The particle
// version lives in the journey's pinned GetNotifiedChapter instead; this is
// the same content and behavior, just without the canvas/scroll-jacking
// those two preferences exist to opt out of.
export default function GetNotifiedSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | sending | error
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong. Please try again.");
      setSubmitted(true);
    } catch (err) {
      setStatus("error");
      setError(err.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <section id="contact" className="section-frame" style={{ padding: "120px 0 0" }}>
      <div className="container">
        <div className="eyebrow" style={{ marginBottom: 20 }}>
          05 / Get notified
        </div>

        <RevealText
          as="h2"
          y={34}
          blur={14}
          stagger={0.05}
          style={{ fontSize: "clamp(34px, 6vw, 74px)", maxWidth: 780, marginBottom: 40 }}
          parts={["Next batch drops soon."]}
        />

        <RevealBox duration={0.7} y={18} blur={4} amount={0.8}>
          {submitted ? (
            <p className="mono" style={{ fontSize: 14, color: "var(--accent)" }}>
              ✓ You're on the list. We'll email you when the next batch opens.
            </p>
          ) : (
            <>
              <form onSubmit={handleSubmit} style={{ display: "flex", gap: 0, maxWidth: 480, flexWrap: "wrap" }}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === "error") setStatus("idle");
                  }}
                  placeholder="you@email.com"
                  aria-invalid={status === "error" ? true : undefined}
                  disabled={status === "sending"}
                  className="mono"
                  style={{
                    flex: "1 1 240px",
                    background: "transparent",
                    border: `1px solid ${status === "error" ? "#FF8A7A" : "var(--border-strong)"}`,
                    borderRight: "none",
                    padding: "16px 18px",
                    color: "var(--fg)",
                    fontSize: 14,
                  }}
                />
                <button
                  type="submit"
                  disabled={!email.trim() || status === "sending"}
                  className="btn btn-primary"
                  style={{ borderRadius: 0, opacity: !email.trim() || status === "sending" ? 0.6 : 1 }}
                >
                  {status === "sending" ? "Joining…" : "Join waitlist"}
                </button>
              </form>
              {status === "error" && (
                <p role="alert" className="mono" style={{ fontSize: 13, color: "#FF8A7A", marginTop: 12 }}>
                  {error}
                </p>
              )}
            </>
          )}
        </RevealBox>
      </div>
    </section>
  );
}
