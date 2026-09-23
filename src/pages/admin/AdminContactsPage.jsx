import { useEffect, useState } from "react";

function fmt(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    fetch("/api/admin/contacts")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then(setContacts)
      .catch(() => setError("Could not load contacts."));
  };
  useEffect(load, []);

  // Surfaces a failed request instead of silently doing nothing — a request
  // that fails (server briefly down, a stale dev server not yet restarted
  // with new routes) previously looked exactly like "the button does
  // nothing" with no way to tell why.
  const markHandled = async (id) => {
    setBusyId(id);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/contacts/${id}/handled`, { method: "PATCH" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status}).`);
      load();
    } catch (err) {
      setActionError(err.message || "Could not update the contact.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    setBusyId(id);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status}).`);
      load();
    } catch (err) {
      setActionError(err.message || "Could not delete the contact.");
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <p className="mono" style={{ color: "#FF8A7A", fontSize: 13 }}>{error}</p>;
  if (!contacts) return <p className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>;

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Contacts</h1>
      {actionError && (
        <p role="alert" className="mono" style={{ color: "#FF8A7A", fontSize: 12, marginBottom: 16 }}>
          {actionError}
        </p>
      )}
      {contacts.length === 0 ? (
        <p className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>
          No waitlist signups or messages yet.
        </p>
      ) : (
        <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-strong)", textAlign: "left" }}>
              {["When", "Source", "Name", "Email", "Phone", "Message", "", ""].map((h, i) => (
                <th key={i} style={{ padding: "10px 12px", color: "var(--muted)", fontWeight: 400 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--border)", opacity: c.handledAt ? 0.5 : 1 }}>
                <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{fmt(c.createdAt)}</td>
                <td style={{ padding: "10px 12px" }}>{c.source}</td>
                <td style={{ padding: "10px 12px" }}>{c.name || "-"}</td>
                <td style={{ padding: "10px 12px" }}>{c.email}</td>
                <td style={{ padding: "10px 12px" }}>{c.phone || "-"}</td>
                <td style={{ padding: "10px 12px", maxWidth: 280 }}>{c.message || "-"}</td>
                <td style={{ padding: "10px 12px" }}>
                  {!c.handledAt && (
                    <button
                      onClick={() => markHandled(c.id)}
                      disabled={busyId === c.id}
                      style={{ color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}
                    >
                      Mark handled
                    </button>
                  )}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <button
                    onClick={() => remove(c.id)}
                    disabled={busyId === c.id}
                    style={{ color: "#FF8A7A", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
