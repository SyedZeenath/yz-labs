import LegalLayout from "./LegalLayout.jsx";

export default function ContactPage() {
  return (
    <LegalLayout eyebrow="Get in touch" title="Contact Us">
      <h2>YZ Labs</h2>
      <p>
        Small-batch 3D-printed objects, studio-run and printed layer by layer. For order questions, custom
        requests, or anything else, reach out any of these ways:
      </p>
      <ul>
        <li><strong>Email:</strong> <a href="mailto:yzlabs.store@gmail.com">yzlabs.store@gmail.com</a></li>
        <li><strong>Phone:</strong> <a href="tel:+918660828944">+91 8660 828944</a></li>
        <li><strong>Instagram:</strong> <a href="https://www.instagram.com/yzlabs.store/" target="_blank" rel="noreferrer">@yzlabs.store</a></li>
        <li><strong>Studio:</strong> Bengaluru, India</li>
      </ul>
      <p>We typically reply within 1-2 business days.</p>
    </LegalLayout>
  );
}
