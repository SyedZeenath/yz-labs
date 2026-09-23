import { esc, eyebrow, cardHtml, buttonHtml, emailShell, BRAND } from "./emailTemplate.js";

// Sent by POST /api/admin/request-reset — the reset link itself IS the
// proof of identity for POST /api/admin/reset-password (see
// server/adminAuth.js), so this email is the one place that link exists.
// Valid 30 minutes (RESET_TOKEN_MS in adminAuth.js).
export function buildAdminResetEmail(email, resetUrl) {
  const text = [
    "A password reset was requested for your YZ Labs admin account.",
    "",
    `Reset it here (valid for 30 minutes): ${resetUrl}`,
    "",
    "If you didn't request this, you can ignore this email — your password stays unchanged.",
    "",
    "YZ Labs",
  ].join("\n");

  const html = emailShell({
    preheader: "Reset your YZ Labs admin password — this link is valid for 30 minutes.",
    bodyHtml: `
      <tr><td>
        <h1 style="margin:0 0 10px;font-size:22px;font-weight:600;color:${BRAND.fg};">Reset your admin password</h1>
        <p style="margin:0;font-size:14px;line-height:1.6;color:${BRAND.fgDim};">A password reset was requested for this account.</p>
        ${cardHtml(`
          ${eyebrow("Account", { first: true })}
          <p style="margin:0;font-size:14px;color:${BRAND.fg};">${esc(email)}</p>
          ${buttonHtml("Reset password", resetUrl)}
          <p style="margin:16px 0 0;font-size:12px;color:${BRAND.muted};">This link is valid for 30 minutes.</p>
        `)}
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${BRAND.fgDim};">
          If you didn't request this, you can safely ignore this email — your password stays unchanged.
        </p>
      </td></tr>`,
  });

  return {
    to: email,
    subject: "Reset your YZ Labs admin password",
    text,
    html,
  };
}
