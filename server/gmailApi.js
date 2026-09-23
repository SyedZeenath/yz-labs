// Sends mail through Gmail's own HTTPS API instead of SMTP. Built to fix a
// real production problem: nodemailer's SMTP connection to Gmail hangs
// indefinitely on Render (very likely outbound SMTP is blocked/throttled
// there), while everything else on this site — including this — works fine
// over plain HTTPS. This also means mail genuinely comes from the real
// Gmail account (best possible authenticity/deliverability), with no new
// email-provider account, approval wait, or domain purchase needed.
//
// Needs a one-time OAuth setup per sending account — see
// scripts/gmailOAuthSetup.mjs — which yields a refresh token that never
// expires (as long as that Google Cloud project's OAuth consent screen
// lists the sending address as a "test user"; see the script's own
// comments) and is exchanged here for short-lived access tokens.
//
// Exposes the exact same shape nodemailer's transport did —
// `{ sendMail({ from, to, replyTo, subject, text }) }` — so nothing at any
// call site (contact form, waitlist, order emails) needed to change.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
// Google's access tokens last ~1 hour; refresh a little early rather than
// racing a request against the exact expiry moment.
const REFRESH_MARGIN_MS = 60_000;

// RFC 2822-ish message, base64url-encoded the way the Gmail API requires
// (`raw`). Headers with non-ASCII characters would need MIME encoding, but
// every subject/name in this app is plain ASCII. Plain-text-only when no
// `html` is given (waitlist/contact mail); `multipart/alternative` with
// both parts when it is (order emails) — every mail client picks whichever
// part it can render, so this never drops the plain-text fallback.
function buildRawMessage({ from, to, replyTo, subject, text, html }) {
  const headers = [`From: ${from}`, `To: ${to}`, replyTo ? `Reply-To: ${replyTo}` : null, `Subject: ${subject}`, "MIME-Version: 1.0"];

  if (!html) {
    const message = `${[...headers, "Content-Type: text/plain; charset=utf-8"].join("\r\n")}\r\n\r\n${text}`;
    return Buffer.from(message, "utf8").toString("base64url");
  }

  const boundary = `yzlabs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const message = [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
    "",
    `--${boundary}--`,
  ].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64url");
}

export function createGmailMailer({ clientId, clientSecret, refreshToken, now = Date.now }) {
  let accessToken = null;
  let expiresAt = 0;

  async function getAccessToken() {
    if (accessToken && now() < expiresAt - REFRESH_MARGIN_MS) return accessToken;
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Gmail token refresh failed: ${body.error_description || body.error || res.status}`);
    }
    accessToken = body.access_token;
    expiresAt = now() + body.expires_in * 1000;
    return accessToken;
  }

  async function sendMail({ from, to, replyTo, subject, text, html }) {
    const token = await getAccessToken();
    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: buildRawMessage({ from, to, replyTo, subject, text, html }) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`Gmail send failed: ${body.error?.message || res.status}`);
    }
    return res.json();
  }

  return { sendMail };
}
