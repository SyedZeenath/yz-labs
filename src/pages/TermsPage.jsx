import { Link } from "react-router-dom";
import LegalLayout from "./LegalLayout.jsx";

export default function TermsPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Terms & Conditions" updated="11 September 2026">
      <h2>1. About YZ Labs</h2>
      <p>
        YZ Labs ("we", "us", "our") is a small-batch 3D-printing studio operating out of Bengaluru, India. We
        design and print objects, currently a range of propagation planters, to order or in small batches, and
        sell them through this website (the "Site").
      </p>
      <p>
        By placing an order, browsing, or otherwise using this Site, you agree to these Terms & Conditions, along
        with our <Link to="/privacy-policy">Privacy Policy</Link>, <Link to="/refund-policy">Refund & Cancellation
        Policy</Link>, and <Link to="/shipping-policy">Shipping Policy</Link>. If you do not agree, please do not use
        the Site.
      </p>

      <h2>2. Products & pricing</h2>
      <ul>
        <li>All prices on the Site are listed in Indian Rupees (₹) and are inclusive of applicable taxes unless stated otherwise.</li>
        <li>Every item is 3D printed in PLA in small batches or made to order. Minor variation in texture, layer lines, or colour between units of the same product is normal and not a manufacturing defect.</li>
        <li>Product status ("In stock" / "Made to order") is shown on each product's listing and affects dispatch timelines. See our <Link to="/shipping-policy">Shipping Policy</Link>.</li>
        <li>We reserve the right to correct pricing errors, and to limit quantities per order.</li>
      </ul>

      <h2>3. Orders & payment</h2>
      <p>
        Orders are placed and paid for through our checkout, which is processed by Razorpay (UPI, cards,
        netbanking, and wallets). An order is confirmed only once payment is successfully captured and verified. We
        do not store your card, UPI, or bank details; these are handled directly by Razorpay under their own
        security and compliance standards.
      </p>

      <h2>4. Shipping & delivery</h2>
      <p>
        Shipping timelines, coverage, and charges are set out in our <Link to="/shipping-policy">Shipping
        Policy</Link>, which forms part of these Terms.
      </p>

      <h2>5. Returns, refunds & cancellations</h2>
      <p>
        Because most items are made to order or produced in small batches, our approach to cancellations, returns,
        and refunds is set out in our <Link to="/refund-policy">Refund & Cancellation Policy</Link>, which forms
        part of these Terms.
      </p>

      <h2>6. Intellectual property</h2>
      <p>
        All designs, 3D models, photography, text, and branding on this Site belong to YZ Labs unless otherwise
        credited. You may not reproduce, resell, or reverse-engineer our designs or product photography without our
        written permission.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        Our products are decorative household objects. We are not liable for indirect or consequential loss arising
        from their use. Our total liability for any order is limited to the amount actually paid for that order.
      </p>

      <h2>8. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Continued use of the Site after changes are posted means you
        accept the revised Terms.
      </p>

      <h2>9. Governing law</h2>
      <p>
        These Terms are governed by the laws of India. Any disputes will be subject to the exclusive jurisdiction of
        the courts of Bengaluru, Karnataka.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these Terms? Reach us at{" "}
        <a href="mailto:yzlabs.store@gmail.com">yzlabs.store@gmail.com</a> or see our{" "}
        <Link to="/contact">Contact page</Link>.
      </p>
    </LegalLayout>
  );
}
