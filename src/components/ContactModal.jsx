import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const EMPTY = { name: "", email: "", phone: "", message: "" };

// Same always-mounted, CSS-transition pattern as ProductModal (and for the
// same reason): Motion's AnimatePresence exit lifecycle is unreliable in
// this environment, so visibility is driven by plain opacity/transform
// instead of mount/unmount.
export default function ContactModal({ open, onClose }) {
  const [fields, setFields] = useState(EMPTY);
  // idle | sending | sent | error
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Reset back to a blank form a moment after it's closed, so it doesn't
  // flash the previous state open the next time.
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setFields(EMPTY);
      setStatus("idle");
      setError(null);
    }, 400);
    return () => clearTimeout(t);
  }, [open]);

  const setField = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Could not send your message.");
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err.message || "Could not send your message. Please try again.");
    }
  };

  const inputStyle = {
    width: "100%",
    background: "transparent",
    border: "1px solid var(--border-strong)",
    padding: "10px 14px",
    color: "var(--fg)",
    fontSize: 14,
    fontFamily: "inherit",
  };

  // Portaled to document.body — a position:fixed element nested inside any
  // transformed ancestor (Journey's chapterMotion wrapper applies a CSS
  // transform to every chapter for the scroll-driven camera pan/zoom) stops
  // being positioned relative to the viewport and gets trapped inside that
  // ancestor's box instead, per the CSS spec. That's what made this modal
  // render shifted up and cropped behind the Nav when opened from
  // GetInTouchChapter — its close button ended up outside the clickable
  // area entirely. Rendering here escapes the whole chapter tree so the
  // modal is always genuinely viewport-fixed (see ProductModal, which
  // already needed the same fix).
  return createPortal(
    <>
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          zIndex: 130,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 340ms ease",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label="Contact YZ Labs"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: open ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.94)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 380ms cubic-bezier(0.16,1,0.3,1), transform 380ms cubic-bezier(0.16,1,0.3,1)",
          zIndex: 131,
          width: "min(440px, 94vw)",
          maxHeight: "calc(100svh - 32px)",
          overflowY: "auto",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          padding: "clamp(20px, 4vh, 32px) clamp(20px, 4vw, 28px) clamp(18px, 3.5vh, 28px)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            fontSize: 24,
            lineHeight: 1,
            cursor: "pointer",
            color: "var(--fg)",
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--border-strong)",
            background: "var(--bg-elevated)",
          }}
        >
          ×
        </button>

        <div className="eyebrow" style={{ marginBottom: "clamp(6px, 1.5vh, 12px)" }}>
          Get in touch
        </div>
        <h2 style={{ fontSize: 23, marginBottom: 6 }}>Send us a message</h2>
        <p style={{ fontSize: 13, color: "var(--fg-dim)", lineHeight: 1.5, marginBottom: "clamp(10px, 2.2vh, 20px)" }}>
          We read every message ourselves and usually reply within 1-2 business days.
        </p>

        {status === "sent" ? (
          <p className="mono" style={{ fontSize: 14, color: "var(--accent)", padding: "20px 0" }}>
            ✓ Message sent. We'll get back to you soon.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "clamp(8px, 1.6vh, 12px)" }}>
            <label className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Name
              <input
                type="text"
                required
                maxLength={100}
                value={fields.name}
                onChange={setField("name")}
                placeholder="Your name"
                style={{ ...inputStyle, marginTop: 6 }}
              />
            </label>

            <label className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Email
              <input
                type="email"
                required
                maxLength={200}
                value={fields.email}
                onChange={setField("email")}
                placeholder="you@email.com"
                style={{ ...inputStyle, marginTop: 6 }}
              />
            </label>

            <label className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Phone (optional)
              <input
                type="tel"
                maxLength={30}
                value={fields.phone}
                onChange={setField("phone")}
                placeholder="+91 00000 00000"
                style={{ ...inputStyle, marginTop: 6 }}
              />
            </label>

            <label className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Message
              <textarea
                required
                maxLength={4000}
                rows={3}
                value={fields.message}
                onChange={setField("message")}
                placeholder="How can we help?"
                style={{ ...inputStyle, marginTop: 6, resize: "vertical", fontFamily: "inherit" }}
              />
            </label>

            <button
              type="submit"
              disabled={status === "sending"}
              className="btn btn-primary"
              style={{ marginTop: 8, opacity: status === "sending" ? 0.6 : 1 }}
            >
              {status === "sending" ? "Sending..." : "Send message"}
            </button>

            {status === "error" && (
              <p className="mono" style={{ fontSize: 12, color: "#FF8A7A", textAlign: "center" }}>
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </>,
    document.body
  );
}
