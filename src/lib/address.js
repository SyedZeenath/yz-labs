// Delivery-details validation shared by the checkout form (client) and
// /api/create-order (server). One implementation on purpose: the form gives
// instant feedback, but the server must never trust it — it re-runs this
// same function on whatever arrives, so the two can't drift apart.

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export const EMPTY_SHIPPING = {
  name: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_RE = /^[1-9]\d{5}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

// Address fields are single-line inputs; collapsing whitespace also strips
// any pasted newlines/control characters so they can't end up inside a
// Razorpay note or the order record.
const clean = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

// "+91 98765 43210", "098765-43210", "9876543210" → "9876543210".
export function normalizePhone(v) {
  let digits = (typeof v === "string" ? v : "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

// Returns { ok, value, errors }. `value` is the trimmed/normalized copy
// (only meaningful when ok); `errors` maps field name → message.
export function validateShipping(input) {
  const src = input && typeof input === "object" ? input : {};
  const value = {
    name: clean(src.name),
    email: clean(src.email),
    phone: normalizePhone(src.phone),
    line1: clean(src.line1),
    line2: clean(src.line2),
    city: clean(src.city),
    state: clean(src.state),
    pincode: clean(src.pincode),
  };

  const errors = {};
  if (!value.name) errors.name = "Enter the recipient's full name.";
  else if (value.name.length > 100) errors.name = "Name is too long.";

  if (!value.email) errors.email = "Enter an email for the order receipt.";
  else if (!EMAIL_RE.test(value.email) || value.email.length > 200) errors.email = "That email doesn't look valid.";

  if (!value.phone) errors.phone = "Enter a mobile number for the courier.";
  else if (!MOBILE_RE.test(value.phone)) errors.phone = "Enter a valid 10-digit Indian mobile number.";

  if (!value.line1) errors.line1 = "Enter the street address.";
  else if (value.line1.length > 120) errors.line1 = "Address line is too long.";

  if (value.line2.length > 120) errors.line2 = "Address line is too long.";

  if (!value.city) errors.city = "Enter the city or town.";
  else if (value.city.length > 60) errors.city = "City name is too long.";

  if (!value.state) errors.state = "Select a state.";
  else if (!INDIAN_STATES.includes(value.state)) errors.state = "Select a state from the list.";

  if (!value.pincode) errors.pincode = "Enter the PIN code.";
  else if (!PIN_RE.test(value.pincode)) errors.pincode = "PIN code must be 6 digits.";

  return { ok: Object.keys(errors).length === 0, value, errors };
}
