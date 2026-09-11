import { Link } from "react-router-dom";
import LegalLayout from "./LegalLayout.jsx";

export default function ShippingPolicyPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Shipping Policy" updated="11 September 2026">
      <h2>1. Where we ship</h2>
      <p>We currently ship within India only.</p>

      <h2>2. Processing time</h2>
      <ul>
        <li><strong>In stock</strong> items are packed and dispatched within <strong>3-5 business days</strong> of the order being confirmed.</li>
        <li><strong>Made to order</strong> items are printed for you after ordering; dispatch typically takes <strong>7-10 business days</strong>, depending on the size and print time of the specific piece.</li>
      </ul>
      <p>Each product listing shows its current status so you know what to expect before you order.</p>

      <h2>3. Delivery time & courier</h2>
      <p>
        Once dispatched, orders are shipped via Shiprocket's courier network and typically arrive within{" "}
        <strong>3-7 business days</strong>, depending on your location. We'll share tracking details once your
        order ships.
      </p>

      <h2>4. Shipping charges</h2>
      <p>
        Shipping is currently included in the listed product price. You won't see a separate shipping line at
        checkout.
      </p>

      <h2>5. Delays</h2>
      <p>
        Occasionally, weather, courier disruptions, or high order volume around a new batch drop can extend these
        estimates. We'll let you know if your order is going to take noticeably longer than expected.
      </p>

      <h2>6. Incorrect address</h2>
      <p>
        Please double-check your shipping address at checkout. We can't be responsible for delays or non-delivery
        caused by an incorrect address supplied by the buyer.
      </p>

      <h2>7. Questions</h2>
      <p>
        Shipping questions: <a href="mailto:yzlabs.store@gmail.com">yzlabs.store@gmail.com</a> or{" "}
        <a href="tel:+918660828944">+91 8660 828944</a>. See also our{" "}
        <Link to="/refund-policy">Refund & Cancellation Policy</Link>.
      </p>
    </LegalLayout>
  );
}
