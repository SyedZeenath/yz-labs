import { Link } from "react-router-dom";
import LegalLayout from "./LegalLayout.jsx";

export default function RefundPolicyPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Refund & Cancellation Policy" updated="11 September 2026">
      <h2>1. Cancellations</h2>
      <p>
        Because most pieces are printed to order in small batches, we can only cancel and refund an order
        <strong> before it enters production</strong>. Email{" "}
        <a href="mailto:yzlabs.store@gmail.com">yzlabs.store@gmail.com</a> with your order ID as soon as possible;
        we'll confirm whether printing has started. Once a piece has been printed for you, the order can no longer
        be cancelled.
      </p>

      <h2>2. Returns</h2>
      <p>
        As each item is made to order, we're unable to accept returns for change of mind (wrong colour choice,
        sizing expectations, etc.). Minor variation in colour, texture, or layer lines between units, a normal
        characteristic of 3D printing, is not grounds for a return.
      </p>

      <h2>3. Damaged, defective, or incorrect items</h2>
      <p>If what you receive is damaged in transit, defective, or not what you ordered:</p>
      <ul>
        <li>Contact us within <strong>48 hours</strong> of delivery at <a href="mailto:yzlabs.store@gmail.com">yzlabs.store@gmail.com</a>, with your order ID and clear photos of the item (and packaging, if damaged in transit).</li>
        <li>We'll review and offer a free replacement or a full refund, whichever is more appropriate.</li>
        <li>Please don't discard the packaging until the claim is resolved; we may need it for a courier claim.</li>
      </ul>

      <h2>4. Refund method & timeline</h2>
      <p>
        Approved refunds are issued to your original payment method via Razorpay. Once we initiate the refund, it
        typically reflects in <strong>5-7 business days</strong>, depending on your bank or payment provider.
      </p>

      <h2>5. What isn't covered</h2>
      <ul>
        <li>Change of mind on a made-to-order colour or product choice.</li>
        <li>Delivery delays caused by an incorrect address provided at checkout.</li>
        <li>Normal print characteristics (slight texture/colour variation) that don't affect function.</li>
      </ul>

      <h2>6. Questions</h2>
      <p>
        Reach out any time at <a href="mailto:yzlabs.store@gmail.com">yzlabs.store@gmail.com</a> or{" "}
        <a href="tel:+918660828944">+91 8660 828944</a>. See also our{" "}
        <Link to="/shipping-policy">Shipping Policy</Link> and <Link to="/terms">Terms & Conditions</Link>.
      </p>
    </LegalLayout>
  );
}
