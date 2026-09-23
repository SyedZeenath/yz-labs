import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Nav from "../components/Nav.jsx";
import CTAFooter from "../components/CTAFooter.jsx";
import RevealText from "../components/RevealText.jsx";

function fmtDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function rupees(paise) {
  return (Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const inputStyle = {
  flex: "1 1 240px",
  background: "transparent",
  border: "1px solid var(--border-strong)",
  borderRight: "none",
  padding: "14px 16px",
  color: "var(--fg)",
  fontSize: 14,
  fontFamily: "inherit",
};

// No password anywhere in this form on purpose — see server/customerAuth.js.
// Entering an email always ends the same way ("check your inbox"), whether
// or not that email has ever ordered, same reasoning as the admin
// forgot-password flow this mirrors.
function SignInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || status === "sending") return;
    setStatus("sending");
    try {
      await fetch("/api/customer/request-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // same outcome either way — a network hiccup here reveals nothing
    }
    setStatus("sent");
  };

  if (status === "sent") {
    return (
      <p className="mono" style={{ fontSize: 14, color: "var(--accent)", maxWidth: 480, lineHeight: 1.6 }}>
        ✓ If that's a real email, a sign-in link is on its way — it's valid for 30 minutes.
      </p>
    );
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 480 }}>
      <p className="mono" style={{ fontSize: 13, color: "var(--fg-dim)", lineHeight: 1.6, marginBottom: 20 }}>
        Sign in with the email you used at checkout to see your order history and tracking. No password needed — we'll
        email you a one-click sign-in link.
      </p>
      <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          disabled={status === "sending"}
          className="mono"
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={!email.trim() || status === "sending"}
          className="btn btn-primary"
          style={{ borderRadius: 0, opacity: !email.trim() || status === "sending" ? 0.6 : 1 }}
        >
          {status === "sending" ? "Sending…" : "Send sign-in link"}
        </button>
      </div>
    </form>
  );
}

const FULFILLMENT_LABEL = { unfulfilled: "Preparing", shipped: "Shipped" };

function OrderCard({ order }) {
  const shipped = order.fulfillmentStatus === "shipped";
  return (
    <div style={{ border: "1px solid var(--border-strong)", padding: 24, marginBottom: 20, background: "var(--card)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {fmtDate(order.createdAt)}
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            {order.id}
          </div>
        </div>
        <span
          className="mono"
          style={{
            fontSize: 11,
            padding: "4px 10px",
            height: "fit-content",
            border: `1px solid ${shipped ? "var(--accent)" : "var(--border-strong)"}`,
            color: shipped ? "var(--accent)" : "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {FULFILLMENT_LABEL[order.fulfillmentStatus] || order.fulfillmentStatus}
        </span>
      </div>

      <div style={{ marginBottom: 16 }}>
        {order.items.map((it, i) => (
          <div
            key={i}
            className="mono"
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              color: "var(--fg-dim)",
              padding: "6px 0",
              borderBottom: i < order.items.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <span>
              {it.qty} &times; {it.name}
              {it.colorName ? ` (${it.colorName})` : ""}
            </span>
            <span>₹{it.price}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 13, marginBottom: order.trackingNote ? 12 : 0 }}>
        <span className="mono" style={{ color: "var(--muted)" }}>
          {order.discountCode ? `Discount: ${order.discountCode}` : ""}
        </span>
        <span className="mono" style={{ color: "var(--fg)", fontWeight: 600 }}>
          Total: ₹{rupees(order.totalPaise)}
        </span>
      </div>

      {order.trackingNote && (
        <p className="mono" style={{ fontSize: 12, color: "var(--accent)", marginTop: 8 }}>
          Tracking: {order.trackingNote}
        </p>
      )}
    </div>
  );
}

function OrdersList() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/customer/orders")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then(setOrders)
      .catch(() => setError("Could not load your orders."));
  }, []);

  if (error) return <p className="mono" style={{ color: "#FF8A7A", fontSize: 13 }}>{error}</p>;
  if (!orders) return <p className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>Loading your orders…</p>;
  if (orders.length === 0) {
    return <p className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>No orders yet — once you buy something, it'll show up here.</p>;
  }

  return (
    <div>
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} />
      ))}
    </div>
  );
}

// Fully separate from checkout (still guest, no login required to buy) —
// this is purely an optional "see my past orders and tracking" area, signed
// in via a one-click emailed link (see server/customerAuth.js). The URL
// itself carries `?signin=<token>` when arriving from that email; it's
// verified once on mount, then stripped from the address bar so a refresh
// or a copied link doesn't keep re-submitting it.
export default function AccountPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const signinToken = searchParams.get("signin") || "";

  const [session, setSession] = useState(signinToken ? "verifying" : "checking"); // checking | verifying | in | out
  const [email, setEmail] = useState("");
  const [verifyError, setVerifyError] = useState("");

  useEffect(() => {
    if (signinToken) {
      fetch("/api/customer/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: signinToken }),
      })
        .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
        .then(({ ok, body }) => {
          setSearchParams({}, { replace: true });
          if (ok) {
            setEmail(body.email);
            setSession("in");
          } else {
            setVerifyError(body.error || "Couldn't sign you in.");
            setSession("out");
          }
        })
        .catch(() => {
          setSearchParams({}, { replace: true });
          setVerifyError("Couldn't sign you in.");
          setSession("out");
        });
      return;
    }
    fetch("/api/customer/session")
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (ok) {
          setEmail(body.email);
          setSession("in");
        } else {
          setSession("out");
        }
      })
      .catch(() => setSession("out"));
    // Only ever runs once on mount (or once for the signin-token branch
    // above) — intentionally not re-running when searchParams changes,
    // since clearing the token via setSearchParams above would otherwise
    // re-trigger this same effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    fetch("/api/customer/logout", { method: "POST" }).finally(() => {
      setSession("out");
      setEmail("");
    });
  };

  return (
    <>
      <Nav />
      <main>
        <section className="section-frame" style={{ padding: "150px 0 110px", minHeight: "60vh" }}>
          <div className="container" style={{ maxWidth: 720 }}>
            <div className="eyebrow" style={{ display: "flex", marginBottom: 16 }}>
              Account
            </div>
            <RevealText as="h1" style={{ fontSize: "clamp(30px, 4vw, 46px)", maxWidth: 560, marginBottom: 40 }} parts={["Your orders."]} />

            {(session === "checking" || session === "verifying") && (
              <p className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>
                {session === "verifying" ? "Signing you in…" : "Loading…"}
              </p>
            )}

            {session === "out" && (
              <>
                {verifyError && (
                  <p role="alert" className="mono" style={{ fontSize: 13, color: "#FF8A7A", marginBottom: 16 }}>
                    {verifyError}
                  </p>
                )}
                <SignInForm />
              </>
            )}

            {session === "in" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
                  <p className="mono" style={{ fontSize: 13, color: "var(--fg-dim)" }}>
                    Signed in as <span style={{ color: "var(--fg)" }}>{email}</span>
                  </p>
                  <button onClick={logout} className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: 12 }}>
                    Sign out
                  </button>
                </div>
                <OrdersList />
              </>
            )}
          </div>
        </section>

        <CTAFooter />
      </main>
    </>
  );
}
