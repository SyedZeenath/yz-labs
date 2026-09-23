// Shared building blocks for every HTML email this app sends (order
// confirmation/notification, waitlist) — one place for the brand's colors,
// the logo header, and the rounded "card" surface, so a look-and-feel change
// never has to be made twice. Every email is still sent multipart/
// alternative (see gmailApi.js): this HTML is always alongside a plain-text
// part, never instead of it.
//
// Table layout with inline styles throughout on purpose: the only markup
// that renders consistently across Gmail/Outlook/Apple Mail without a CSS
// engine. Matches the site's own dark brand (src/index.css's --bg/--fg/
// --accent) rather than a generic white email template.
export const BRAND = {
  bg: "#000000",
  fg: "#f4f3ee",
  fgDim: "#c7c6c0",
  muted: "#8f8f97",
  border: "rgba(244,243,238,0.14)",
  accent: "#5b82ff", // a shade lighter than the site's #3d6bff — reads better as text on black
  warn: "#ff5a3c",
  font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
};

// The production URL — email clients render outside the site's own origin,
// so image src/links in mail must always be absolute, never "/logo-....png".
export const SITE_URL = "https://yz-labs.onrender.com";

// User-entered text (name, address, ...) is never character-restricted
// beyond length (see src/lib/address.js) — escape everything interpolated
// into HTML so a stray "&"/"<" can't break the layout or inject markup.
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function eyebrow(text, { first = false } = {}) {
  return `<div style="font-size:11px;letter-spacing:0.12em;color:${BRAND.muted};text-transform:uppercase;margin:${first ? 0 : 28}px 0 10px;">${esc(text)}</div>`;
}

// The rounded "banner" card that groups an email's core content into one
// surface — a warning banner or a name/greeting stays outside it.
export function cardHtml(innerHtml) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(244,243,238,0.04);border:1px solid ${BRAND.border};border-radius:16px;margin:24px 0;">
    <tr><td style="padding:22px 24px;">${innerHtml}</td></tr>
  </table>`;
}

// A solid accent "button" — an actual table-cell background, not a styled
// <a>, since that's what survives Outlook's Word rendering engine.
export function buttonHtml(label, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;">
    <tr><td style="background:${BRAND.accent};border-radius:8px;">
      <a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-size:13px;font-weight:600;color:#0a0a0a;text-decoration:none;">${esc(label)}</a>
    </td></tr>
  </table>`;
}

// The outer shell every email shares: logo header, body, footer.
// `preheader` is the hidden preview text shown next to the subject in an
// inbox list — kept short and specific rather than defaulting to whatever
// text happens to start the body.
export function emailShell({ preheader, bodyHtml }) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>YZ Labs</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
      <tr>
        <td align="center" style="padding:36px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${BRAND.font};">
            <tr>
              <td style="padding-bottom:28px;">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td style="padding-right:10px;"><img src="${SITE_URL}/logo-circle.png" width="32" height="32" alt="" style="display:block;border-radius:50%;" /></td>
                  <td><img src="${SITE_URL}/logo-wordmark.png" height="16" alt="YZ Labs" style="display:block;width:auto;" /></td>
                </tr></table>
              </td>
            </tr>
            ${bodyHtml}
            <tr>
              <td style="padding-top:32px;margin-top:12px;border-top:1px solid ${BRAND.border};">
                <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:${BRAND.muted};">
                  YZ Labs — Small-batch 3D-printed objects, Bengaluru
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
