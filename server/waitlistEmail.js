import { esc, eyebrow, cardHtml, buttonHtml, emailShell, BRAND, SITE_URL } from "./emailTemplate.js";

// The confirmation sent to the person who joined the waitlist — separate
// from the shop's own "someone signed up" notification (buildWaitlistNotificationEmail
// below; see POST /api/waitlist in server/index.js, which sends both).
export function buildWaitlistConfirmationEmail(email, { shopEmail } = {}) {
  const text = [
    "Hi,",
    "",
    "You're on the YZ Labs waitlist — we'll email you the moment the next batch drops.",
    "",
    `Take a look at the current catalog in the meantime: ${SITE_URL}/catalog`,
    "",
    "YZ Labs",
    "Small-batch 3D-printed objects, Bengaluru",
    ...(shopEmail ? [shopEmail] : []),
  ].join("\n");

  const html = emailShell({
    preheader: "You're on the list — we'll email you the moment the next batch drops.",
    bodyHtml: `
      <tr><td>
        <div style="display:inline-block;padding:3px 10px;border:1px solid ${BRAND.accent};border-radius:20px;font-size:11px;letter-spacing:0.06em;color:${BRAND.accent};text-transform:uppercase;margin-bottom:14px;">You're on the list</div>
        <h1 style="margin:0 0 10px;font-size:22px;font-weight:600;color:${BRAND.fg};">You're on the YZ Labs waitlist.</h1>
        <p style="margin:0;font-size:14px;line-height:1.6;color:${BRAND.fgDim};">We'll email you the moment the next batch drops — no spam in the meantime.</p>
        ${cardHtml(`
          ${eyebrow("While you wait", { first: true })}
          <p style="margin:0;font-size:13px;line-height:1.7;color:${BRAND.fgDim};">Take a look at the current catalog — small-batch, 3D-printed objects, each one made to order.</p>
          ${buttonHtml("Browse the catalog", `${SITE_URL}/catalog`)}
        `)}
      </td></tr>`,
  });

  return {
    to: email,
    subject: "You're on the YZ Labs waitlist",
    text,
    html,
    replyTo: shopEmail || undefined,
  };
}

// The shop's own "someone signed up" notification — deliberately plain and
// functional (an internal ops email, not customer-facing), but still on the
// same brand shell as everything else rather than a bare line of text.
export function buildWaitlistNotificationEmail(email) {
  const text = `${email} joined the "next batch" waitlist.`;

  const html = emailShell({
    preheader: text,
    bodyHtml: `
      <tr><td>
        <h1 style="margin:0 0 4px;font-size:20px;font-weight:600;color:${BRAND.fg};">New waitlist signup</h1>
        ${cardHtml(`
          ${eyebrow("Email", { first: true })}
          <p style="margin:0;font-size:15px;color:${BRAND.fg};">${esc(email)}</p>
        `)}
      </td></tr>`,
  });

  return {
    subject: `Waitlist signup: ${email}`,
    text,
    html,
    replyTo: email,
  };
}
