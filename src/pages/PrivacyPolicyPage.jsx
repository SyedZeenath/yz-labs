import LegalLayout from "./LegalLayout.jsx";

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Privacy Policy" updated="11 September 2026">
      <h2>1. What this covers</h2>
      <p>
        This policy explains what information YZ Labs ("we", "us") collects when you visit or order from this
        website, and how it's used. We keep this deliberately minimal: we're a small studio, not an ad or data
        business.
      </p>

      <h2>2. Information we collect</h2>
      <ul>
        <li>
          <strong>Cart contents.</strong> The items you add to your cart are stored only in your own browser
          (local storage) so your cart persists between visits. We don't see this until you check out.
        </li>
        <li>
          <strong>Order & payment details.</strong> When you check out, our payment partner Razorpay collects your
          contact details and payment information directly, within their own secure checkout. We receive the order
          amount, order ID, and payment confirmation, never your card number, UPI PIN, or bank credentials.
        </li>
        <li>
          <strong>Email address.</strong> If you submit your email through a form on this Site (for example, to
          join a restock waitlist, or to contact us), we use it only to respond to you or notify you about the thing
          you signed up for.
        </li>
      </ul>

      <h2>3. Third parties we rely on</h2>
      <ul>
        <li><strong>Razorpay</strong> processes all payments. See <a href="https://razorpay.com/privacy/" target="_blank" rel="noreferrer">Razorpay's Privacy Policy</a>.</li>
        <li><strong>Render</strong> hosts this website and its backend; standard server logs (IP address, request time) may be retained briefly for security and debugging.</li>
        <li><strong>Google Fonts</strong> this Site loads typefaces from Google's font CDN, which may log basic request data under Google's own policies.</li>
      </ul>
      <p>We do not currently use analytics, advertising, or tracking cookies on this Site.</p>

      <h2>4. How we use your information</h2>
      <p>
        Solely to process and fulfil your order, respond to enquiries, and, only if you've opted in, let you know
        about new batches or restocks. We do not sell or rent your information to anyone.
      </p>

      <h2>5. Data retention</h2>
      <p>
        We keep order records for as long as needed for accounting, warranty, and legal purposes. You can ask us to
        delete personal information we hold about you, subject to what we're legally required to retain.
      </p>

      <h2>6. Your rights</h2>
      <p>
        You can ask us what information we hold about you, ask us to correct it, or ask us to delete it, by emailing{" "}
        <a href="mailto:yzlabs.store@gmail.com">yzlabs.store@gmail.com</a>.
      </p>

      <h2>7. Children's privacy</h2>
      <p>This Site is not directed at children under 18, and we do not knowingly collect their information.</p>

      <h2>8. Changes to this policy</h2>
      <p>We may update this policy occasionally; the date at the top reflects the latest revision.</p>

      <h2>9. Contact</h2>
      <p>
        Privacy questions: <a href="mailto:yzlabs.store@gmail.com">yzlabs.store@gmail.com</a> or call{" "}
        <a href="tel:+918660828944">+91 8660 828944</a>.
      </p>
    </LegalLayout>
  );
}
