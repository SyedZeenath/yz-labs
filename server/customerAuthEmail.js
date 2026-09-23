import { eyebrow, cardHtml, buttonHtml, emailShell, BRAND } from "./emailTemplate.js";

// The customer-facing "sign in" link — see POST /api/customer/request-signin
// and server/customerAuth.js's signMagicLinkToken. No password exists on
// either side; clicking this link (valid 30 minutes) IS the login.
export function buildMagicLinkEmail(email, signInUrl) {
  const text = [
    "Click below to sign in to your YZ Labs account:",
    "",
    `${signInUrl}`,
    "",
    "This link is valid for 30 minutes.",
    "",
    "If you didn't request this, you can ignore this email — nothing happens without clicking it.",
    "",
    "YZ Labs",
  ].join("\n");

  const html = emailShell({
    preheader: "Sign in to YZ Labs — this link is valid for 30 minutes.",
    bodyHtml: `
      <tr><td>
        <h1 style="margin:0 0 10px;font-size:22px;font-weight:600;color:${BRAND.fg};">Sign in to your account</h1>
        <p style="margin:0;font-size:14px;line-height:1.6;color:${BRAND.fgDim};">Click below to sign in — see your order history and tracking.</p>
        ${cardHtml(`
          ${eyebrow("Sign in", { first: true })}
          ${buttonHtml("Sign in to YZ Labs", signInUrl)}
          <p style="margin:16px 0 0;font-size:12px;color:${BRAND.muted};">This link is valid for 30 minutes.</p>
        `)}
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${BRAND.fgDim};">
          If you didn't request this, you can safely ignore this email — nothing happens without clicking it.
        </p>
      </td></tr>`,
  });

  return {
    to: email,
    subject: "Sign in to YZ Labs",
    text,
    html,
  };
}
