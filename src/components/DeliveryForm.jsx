import { useState } from "react";
import { EMPTY_SHIPPING, INDIAN_STATES, validateShipping } from "../lib/address.js";

const STORAGE_KEY = "yzlabs-delivery-v1";
// Matches the on-screen field order, so a failed submit focuses the first
// invalid field the customer would actually reach.
const FOCUS_ORDER = ["name", "email", "phone", "line1", "line2", "city", "pincode", "state"];

function readSaved() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return saved && typeof saved === "object" ? { ...EMPTY_SHIPPING, ...saved } : EMPTY_SHIPPING;
  } catch {
    return EMPTY_SHIPPING;
  }
}

function writeSaved(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage full or blocked — remembering the address is a convenience,
    // never a reason to stop the order.
  }
}

const labelStyle = {
  display: "block",
  fontSize: 11,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

const baseInput = {
  width: "100%",
  background: "transparent",
  border: "1px solid var(--border-strong)",
  padding: "10px 12px",
  color: "var(--fg)",
  fontSize: 14,
  fontFamily: "inherit",
  borderRadius: 0,
};

const ERROR_COLOR = "#FF8A7A";

// The delivery step of checkout. Collects and validates the shipping
// address (India only, per the shipping policy) before any Razorpay order
// exists — `onSubmit` is only ever called with a fully valid, normalized
// value. The submit button lives in the cart drawer's footer and targets
// this form via the `form` attribute, so the fields can scroll while the
// total and pay button stay put.
export default function DeliveryForm({ id, disabled, onSubmit }) {
  const [fields, setFields] = useState(readSaved);
  const [errors, setErrors] = useState({});

  const setField = (name) => (e) => {
    const next = e.target.value;
    setFields((f) => ({ ...f, [name]: next }));
    // Clear a shown error as soon as the customer starts fixing it; it's
    // re-checked on blur and on submit.
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const checkField = (name) => () => {
    const { errors: found } = validateShipping(fields);
    setErrors((prev) => ({ ...prev, [name]: found[name] }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled) return;
    const result = validateShipping(fields);
    if (!result.ok) {
      setErrors(result.errors);
      const first = FOCUS_ORDER.find((k) => result.errors[k]);
      if (first) document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    setErrors({});
    // Show the cleaned-up values (e.g. phone as 10 digits) if they come
    // back to this step after a failed payment.
    setFields(result.value);
    writeSaved(result.value);
    onSubmit(result.value);
  };

  const controlProps = (name, extra = {}) => ({
    id: `${id}-${name}`,
    name,
    value: fields[name],
    onChange: setField(name),
    onBlur: checkField(name),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
    style: { ...baseInput, borderColor: errors[name] ? ERROR_COLOR : "var(--border-strong)", ...extra.style },
    ...extra.attrs,
  });

  const error = (name) =>
    errors[name] ? (
      <span
        id={`${id}-${name}-error`}
        role="alert"
        className="mono"
        style={{ display: "block", fontSize: 11, color: ERROR_COLOR, marginTop: 5, lineHeight: 1.4 }}
      >
        {errors[name]}
      </span>
    ) : null;

  const field = (name, label, control) => (
    <div>
      <label htmlFor={`${id}-${name}`} className="mono" style={labelStyle}>
        {label}
      </label>
      {control}
      {error(name)}
    </div>
  );

  return (
    <form id={id} onSubmit={handleSubmit} noValidate>
      <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "grid", gap: 14 }}>
        <p style={{ fontSize: 13, color: "var(--fg-dim)", lineHeight: 1.5, margin: "4px 0 2px" }}>
          Where should we send your order? We ship within India only.
        </p>

        {field("name", "Full name", <input type="text" maxLength={100} autoComplete="name" placeholder="Recipient's name" {...controlProps("name")} />)}

        {field(
          "email",
          "Email",
          <input type="email" maxLength={200} autoComplete="email" placeholder="you@email.com" {...controlProps("email")} />
        )}

        {field(
          "phone",
          "Mobile number",
          <div style={{ display: "flex" }}>
            <span
              className="mono"
              aria-hidden
              style={{
                ...baseInput,
                width: "auto",
                borderRight: 0,
                borderColor: errors.phone ? ERROR_COLOR : "var(--border-strong)",
                color: "var(--muted)",
                display: "flex",
                alignItems: "center",
              }}
            >
              +91
            </span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={16}
              autoComplete="tel-national"
              placeholder="98765 43210"
              {...controlProps("phone")}
            />
          </div>
        )}

        {field(
          "line1",
          "Address line 1",
          <input type="text" maxLength={120} autoComplete="address-line1" placeholder="House / flat no., street" {...controlProps("line1")} />
        )}

        {field(
          "line2",
          "Address line 2 (optional)",
          <input type="text" maxLength={120} autoComplete="address-line2" placeholder="Area, landmark" {...controlProps("line2")} />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 128px", gap: 12, alignItems: "start" }}>
          {field("city", "City", <input type="text" maxLength={60} autoComplete="address-level2" placeholder="City / town" {...controlProps("city")} />)}
          {field(
            "pincode",
            "PIN code",
            <input type="text" inputMode="numeric" maxLength={6} autoComplete="postal-code" placeholder="560001" {...controlProps("pincode")} />
          )}
        </div>

        {field(
          "state",
          "State",
          <select autoComplete="address-level1" {...controlProps("state", { style: { colorScheme: "dark", cursor: "pointer" } })}>
            <option value="" style={{ background: "#0b0b0d" }}>
              Select state
            </option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s} style={{ background: "#0b0b0d" }}>
                {s}
              </option>
            ))}
          </select>
        )}

        <p className="mono" style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 4px" }}>
          Country: India
        </p>
      </fieldset>
    </form>
  );
}
