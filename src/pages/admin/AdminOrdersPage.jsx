import { useEffect, useState } from "react";

function fmt(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function rupees(paise) {
  return (Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function OrderRow({ order, onSaved }) {
  const [status, setStatus] = useState(order.fulfillmentStatus);
  const [trackingNote, setTrackingNote] = useState(order.trackingNote || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notifyState, setNotifyState] = useState("idle"); // idle | sending | sent | error
  const [notifyError, setNotifyError] = useState("");
  const dirty = status !== order.fulfillmentStatus || trackingNote !== (order.trackingNote || "");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/fulfillment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfillmentStatus: status, trackingNote: trackingNote.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status}).`);
      onSaved(await res.json());
    } catch (err) {
      setError(err.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  // A first "shipped" email fires on its own the moment Save above flips
  // the status — this is only for resending, e.g. after adding or fixing
  // the tracking note (editing it alone doesn't auto-notify, see
  // server/index.js's admin fulfillment route).
  const notify = async () => {
    setNotifyState("sending");
    setNotifyError("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/notify-shipped`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status}).`);
      setNotifyState("sent");
    } catch (err) {
      setNotifyState("error");
      setNotifyError(err.message || "Could not send the email.");
    }
  };

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{fmt(order.createdAt)}</td>
      <td style={{ padding: "10px 12px", fontSize: 11 }}>{order.id}</td>
      <td style={{ padding: "10px 12px" }}>
        {order.shipName || "-"}
        <div style={{ color: "var(--muted)", fontSize: 11 }}>{order.shipEmail}</div>
      </td>
      <td style={{ padding: "10px 12px" }}>₹{rupees(order.totalPaise)}</td>
      <td style={{ padding: "10px 12px" }}>{order.discountCode || "-"}</td>
      <td style={{ padding: "10px 12px", fontSize: 11 }}>
        {order.shiprocketOrderId ? <span style={{ color: "#8FE0A8" }}>Pushed ({order.shiprocketOrderId})</span> : <span style={{ color: "var(--muted)" }}>Not yet</span>}
      </td>
      <td style={{ padding: "10px 12px" }}>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mono"
          style={{ background: "transparent", border: "1px solid var(--border-strong)", color: "var(--fg)", padding: "5px 8px", fontSize: 12 }}
        >
          <option value="unfulfilled">Unfulfilled</option>
          <option value="shipped">Shipped</option>
        </select>
      </td>
      <td style={{ padding: "10px 12px" }}>
        <input
          value={trackingNote}
          onChange={(e) => setTrackingNote(e.target.value)}
          placeholder="Tracking / note"
          className="mono"
          style={{ background: "transparent", border: "1px solid var(--border-strong)", color: "var(--fg)", padding: "5px 8px", fontSize: 12, width: 140 }}
        />
      </td>
      <td style={{ padding: "10px 12px" }}>
        {dirty && (
          <button onClick={save} disabled={saving} className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 11, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        )}
        {error && (
          <div role="alert" className="mono" style={{ color: "#FF8A7A", fontSize: 11, marginTop: 4 }}>
            {error}
          </div>
        )}
        {!dirty && order.fulfillmentStatus === "shipped" && (
          <button
            onClick={notify}
            disabled={notifyState === "sending"}
            className="btn btn-ghost"
            style={{ padding: "6px 12px", fontSize: 11, opacity: notifyState === "sending" ? 0.6 : 1 }}
          >
            {notifyState === "sending" ? "Sending…" : "Resend shipping email"}
          </button>
        )}
        {notifyState === "sent" && <div className="mono" style={{ color: "#8FE0A8", fontSize: 11, marginTop: 4 }}>Sent.</div>}
        {notifyState === "error" && (
          <div role="alert" className="mono" style={{ color: "#FF8A7A", fontSize: 11, marginTop: 4 }}>
            {notifyError}
          </div>
        )}
      </td>
    </tr>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/admin/orders")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then(setOrders)
      .catch(() => setError("Could not load orders."));
  };
  useEffect(load, []);

  const onRowSaved = (updated) => setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

  if (error) return <p className="mono" style={{ color: "#FF8A7A", fontSize: 13 }}>{error}</p>;
  if (!orders) return <p className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>;

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Orders</h1>
      <p className="mono" style={{ color: "var(--muted)", fontSize: 12, marginBottom: 20 }}>
        Mirrored from Razorpay for browsing — payment status itself is always Razorpay's own record. Fulfillment status and
        tracking notes here are the one thing this page is the source of truth for. Marking an order "Shipped" emails the
        customer automatically; editing the tracking note afterward doesn't re-send on its own — use "Resend shipping email" for that.
      </p>
      {orders.length === 0 ? (
        <p className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>
          No paid orders yet.
        </p>
      ) : (
        <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-strong)", textAlign: "left" }}>
              {["When", "Order ID", "Customer", "Total", "Discount", "Shiprocket", "Fulfillment", "Tracking / note", ""].map((h, i) => (
                <th key={i} style={{ padding: "10px 12px", color: "var(--muted)", fontWeight: 400 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} onSaved={onRowSaved} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
