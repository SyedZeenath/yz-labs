import { esc, eyebrow, cardHtml, emailShell, BRAND } from "./emailTemplate.js";

// The shop's own "someone messaged us" notification for POST /api/contact —
// there's no customer-facing confirmation email for this form (the browser
// shows an inline "message sent" state instead), so this is the only email
// this form ever sends.
export function buildContactNotificationEmail({ name, email, phone, message }) {
  const text = [`Name: ${name}`, `Email: ${email}`, phone ? `Phone: ${phone}` : null, "", message].filter(Boolean).join("\n");

  const html = emailShell({
    preheader: `New website enquiry from ${name}`,
    bodyHtml: `
      <tr><td>
        <h1 style="margin:0 0 4px;font-size:20px;font-weight:600;color:${BRAND.fg};">New website enquiry</h1>
        ${cardHtml(`
          ${eyebrow("From", { first: true })}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:${BRAND.fgDim};">
            <tr><td style="padding:2px 0;color:${BRAND.muted};width:80px;">Name</td><td style="padding:2px 0;">${esc(name)}</td></tr>
            <tr><td style="padding:2px 0;color:${BRAND.muted};">Email</td><td style="padding:2px 0;">${esc(email)}</td></tr>
            ${phone ? `<tr><td style="padding:2px 0;color:${BRAND.muted};">Phone</td><td style="padding:2px 0;">${esc(phone)}</td></tr>` : ""}
          </table>
          ${eyebrow("Message")}
          <p style="margin:0;font-size:14px;line-height:1.7;color:${BRAND.fg};white-space:pre-wrap;">${esc(message)}</p>
        `)}
      </td></tr>`,
  });

  return {
    subject: `New website enquiry from ${name}`,
    text,
    html,
    replyTo: email,
  };
}
