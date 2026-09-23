import { Fragment, useEffect, useState } from "react";
import { COLORWAYS } from "../../data/colorways.js";

const COLOR_KEYS = Object.keys(COLORWAYS);

const EMPTY_FORM = {
  id: "",
  imageFolder: "",
  name: "",
  category: "",
  tagline: "",
  material: "",
  dims: "",
  weight: "",
  weightG: "",
  price: "",
  status: "In stock",
  batch: "",
  sortOrder: "0",
  colors: {}, // { [colorKey]: priceDelta string } — only keys present are selected
};

const inputStyle = {
  width: "100%",
  background: "transparent",
  border: "1px solid var(--border-strong)",
  padding: "9px 12px",
  color: "var(--fg)",
  fontSize: 13,
  fontFamily: "inherit",
};

const labelStyle = { fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 };

function Field({ label, children, span }) {
  return (
    <label className="mono" style={{ ...labelStyle, gridColumn: span ? "1 / -1" : undefined }}>
      {label}
      {children}
    </label>
  );
}

function ProductForm({ initial, editingId, onCancel, onSaved }) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState("idle"); // idle | saving | error
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggleColor = (key) =>
    setForm((f) => {
      const colors = { ...f.colors };
      if (Object.hasOwn(colors, key)) delete colors[key];
      else colors[key] = "0";
      return { ...f, colors };
    });
  const setColorDelta = (key) => (e) => setForm((f) => ({ ...f, colors: { ...f.colors, [key]: e.target.value } }));

  const submit = async (e) => {
    e.preventDefault();
    setStatus("saving");
    setError("");
    const body = {
      ...(editingId ? {} : { id: form.id.trim() }),
      imageFolder: form.imageFolder,
      name: form.name,
      category: form.category,
      tagline: form.tagline,
      material: form.material,
      dims: form.dims,
      weight: form.weight,
      weightG: Number(form.weightG) || 0,
      price: Number(form.price),
      status: form.status,
      batch: form.batch,
      sortOrder: Number(form.sortOrder) || 0,
      colors: Object.entries(form.colors).map(([id, priceDelta]) => ({ id, priceDelta: Number(priceDelta) || 0 })),
    };
    try {
      const res = await fetch(editingId ? `/api/admin/products/${editingId}` : "/api/admin/products", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = result.errors ? Object.values(result.errors).join(" ") : result.error || "Could not save.";
        throw new Error(msg);
      }
      onSaved();
    } catch (err) {
      setStatus("error");
      setError(err.message || "Could not save.");
    }
  };

  return (
    <form
      onSubmit={submit}
      style={{ border: "1px solid var(--border-strong)", padding: 20, marginBottom: 28, display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr", background: "var(--card)" }}
    >
      <div style={{ gridColumn: "1 / -1" }} className="eyebrow">
        {editingId ? `Edit ${editingId}` : "New product"}
      </div>

      {!editingId && (
        <Field label="ID (lowercase, hyphens)">
          <input style={inputStyle} value={form.id} onChange={set("id")} placeholder="round-planter" required />
        </Field>
      )}
      <Field label="Image folder (public/products/<folder>)">
        <input style={inputStyle} value={form.imageFolder} onChange={set("imageFolder")} placeholder="round" required />
      </Field>
      <Field label="Name">
        <input style={inputStyle} value={form.name} onChange={set("name")} required />
      </Field>
      <Field label="Category">
        <input style={inputStyle} value={form.category} onChange={set("category")} required />
      </Field>
      <Field label="Price (Rs)">
        <input type="number" min="1" style={inputStyle} value={form.price} onChange={set("price")} required />
      </Field>
      <Field label="Status">
        <input style={inputStyle} value={form.status} onChange={set("status")} placeholder="In stock" />
      </Field>
      <Field label="Material">
        <input style={inputStyle} value={form.material} onChange={set("material")} placeholder="PLA" />
      </Field>
      <Field label="Batch">
        <input style={inputStyle} value={form.batch} onChange={set("batch")} placeholder="B-001" />
      </Field>
      <Field label="Dimensions">
        <input style={inputStyle} value={form.dims} onChange={set("dims")} placeholder="90 × 90 × 95 mm" />
      </Field>
      <Field label="Weight">
        <input style={inputStyle} value={form.weight} onChange={set("weight")} placeholder="134 g" />
      </Field>
      <Field label="Weight for shipping (grams)">
        <input type="number" min="0" style={inputStyle} value={form.weightG} onChange={set("weightG")} placeholder="134" />
      </Field>
      <Field label="Tagline" span>
        <input style={inputStyle} value={form.tagline} onChange={set("tagline")} />
      </Field>
      <Field label="Catalog sort order (lower shows first)">
        <input type="number" style={inputStyle} value={form.sortOrder} onChange={set("sortOrder")} />
      </Field>

      <div style={{ gridColumn: "1 / -1" }}>
        <span className="mono" style={labelStyle}>
          Colors offered
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {COLOR_KEYS.map((key) => {
            const selected = Object.hasOwn(form.colors, key);
            return (
              <label
                key={key}
                className="mono"
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, border: "1px solid var(--border-strong)", padding: "6px 10px" }}
              >
                <input type="checkbox" checked={selected} onChange={() => toggleColor(key)} />
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: COLORWAYS[key].hex, display: "inline-block" }} />
                {COLORWAYS[key].name}
                {selected && (
                  <input
                    type="number"
                    value={form.colors[key]}
                    onChange={setColorDelta(key)}
                    title="Price delta (Rs)"
                    style={{ width: 56, background: "transparent", border: "1px solid var(--border)", color: "var(--fg)", fontSize: 11, padding: "2px 4px" }}
                  />
                )}
              </label>
            );
          })}
        </div>
      </div>

      {status === "error" && (
        <p role="alert" className="mono" style={{ gridColumn: "1 / -1", fontSize: 12, color: "#FF8A7A" }}>
          {error}
        </p>
      )}

      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}>
        <button type="submit" disabled={status === "saving"} className="btn btn-primary" style={{ opacity: status === "saving" ? 0.6 : 1 }}>
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

function formFromProduct(p) {
  const colors = {};
  for (const c of p.colors) colors[c.id] = String(c.priceDelta || 0);
  return {
    id: p.id,
    imageFolder: p.imageFolder,
    name: p.name,
    category: p.category,
    tagline: p.tagline || "",
    material: p.material || "",
    dims: p.dims || "",
    weight: p.weight || "",
    weightG: p.weightG ? String(p.weightG) : "",
    price: String(p.price),
    status: p.status || "In stock",
    batch: p.batch || "",
    sortOrder: String(p.sortOrder || 0),
    colors,
  };
}

// Every action below reports whether it actually succeeded — a silently
// swallowed failure (server briefly down, a stale dev server not yet
// restarted with new routes, etc.) looks exactly like "the button does
// nothing", which is worse than a visible error.
async function parseError(res) {
  const body = await res.json().catch(() => ({}));
  if (body.errors) return Object.values(body.errors).join(" ");
  if (body.error) return body.error;
  return `Request failed (${res.status}).`;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  // In-page confirmation rather than window.confirm() — a native browser
  // dialog can be silently blocked or auto-dismissed inside an embedded
  // preview pane, which looked exactly like "the button does nothing".
  const [confirmingId, setConfirmingId] = useState(null);

  const load = () => {
    fetch("/api/admin/products")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then(setProducts)
      .catch(() => setError("Could not load products."));
  };
  useEffect(load, []);

  const closeForm = () => {
    setCreating(false);
    setEditingId(null);
  };
  const onSaved = () => {
    closeForm();
    load();
  };

  const toggleArchive = async (p) => {
    setBusyId(p.id);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/products/${p.id}/${p.archived ? "restore" : "archive"}`, { method: "POST" });
      if (!res.ok) throw new Error(await parseError(res));
      load();
    } catch (err) {
      setActionError(err.message || "Could not update the product.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async (p) => {
    setBusyId(p.id);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await parseError(res));
      setConfirmingId(null);
      load();
    } catch (err) {
      setActionError(err.message || "Could not delete the product.");
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <p className="mono" style={{ color: "#FF8A7A", fontSize: 13 }}>{error}</p>;
  if (!products) return <p className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Products</h1>
        {!creating && !editingId && (
          <button onClick={() => setCreating(true)} className="btn btn-primary" style={{ padding: "10px 18px", fontSize: 13 }}>
            + New product
          </button>
        )}
      </div>

      {actionError && (
        <p role="alert" className="mono" style={{ color: "#FF8A7A", fontSize: 12, marginBottom: 16 }}>
          {actionError}
        </p>
      )}

      {creating && <ProductForm initial={EMPTY_FORM} editingId={null} onCancel={closeForm} onSaved={onSaved} />}
      {editingId && (
        <ProductForm
          initial={formFromProduct(products.find((p) => p.id === editingId))}
          editingId={editingId}
          onCancel={closeForm}
          onSaved={onSaved}
        />
      )}

      <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-strong)", textAlign: "left" }}>
            {["ID", "Name", "Category", "Price", "Status", "", "", ""].map((h, i) => (
              <th key={i} style={{ padding: "10px 12px", color: "var(--muted)", fontWeight: 400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <Fragment key={p.id}>
              <tr style={{ borderBottom: confirmingId === p.id ? "none" : "1px solid var(--border)", opacity: p.archived ? 0.5 : 1 }}>
              <td style={{ padding: "10px 12px" }}>{p.id}</td>
              <td style={{ padding: "10px 12px" }}>{p.name}</td>
              <td style={{ padding: "10px 12px" }}>{p.category}</td>
              <td style={{ padding: "10px 12px" }}>₹{p.price}</td>
              <td style={{ padding: "10px 12px" }}>{p.archived ? "Archived" : p.status}</td>
              <td style={{ padding: "10px 12px" }}>
                <button onClick={() => setEditingId(p.id)} style={{ color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}>
                  Edit
                </button>
              </td>
              <td style={{ padding: "10px 12px" }}>
                <button
                  onClick={() => toggleArchive(p)}
                  disabled={busyId === p.id}
                  style={{ color: p.archived ? "#8FE0A8" : "#FF8A7A", cursor: "pointer", textDecoration: "underline", opacity: busyId === p.id ? 0.5 : 1 }}
                >
                  {p.archived ? "Restore" : "Archive"}
                </button>
              </td>
              <td style={{ padding: "10px 12px" }}>
                <button
                  onClick={() => setConfirmingId(p.id)}
                  disabled={busyId === p.id}
                  style={{ color: "#FF8A7A", cursor: "pointer", textDecoration: "underline", opacity: busyId === p.id ? 0.5 : 1 }}
                >
                  Delete
                </button>
              </td>
              </tr>
              {confirmingId === p.id && (
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td colSpan={8} style={{ padding: "0 12px 14px", background: "rgba(255,138,122,0.06)" }}>
                    <p style={{ fontSize: 12, color: "var(--fg-dim)", margin: "10px 0", lineHeight: 1.5 }}>
                      Permanently delete <strong>"{p.name}"</strong>? This can't be undone. Past orders keep their
                      original price either way, but any order email sent after this will show{" "}
                      <span className="mono">"{p.id}"</span> instead of its name for this item. If you might want it
                      back later, use Archive instead.
                    </p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        onClick={() => confirmDelete(p)}
                        disabled={busyId === p.id}
                        className="btn btn-primary"
                        style={{ padding: "8px 16px", fontSize: 12, background: "#FF8A7A", borderColor: "#FF8A7A", opacity: busyId === p.id ? 0.6 : 1 }}
                      >
                        {busyId === p.id ? "Deleting…" : "Yes, delete permanently"}
                      </button>
                      <button onClick={() => setConfirmingId(null)} disabled={busyId === p.id} className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: 12 }}>
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
