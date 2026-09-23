// One-time helper: turns a Google Cloud OAuth client ID/secret into a
// refresh token for sending mail as a specific Gmail account via the Gmail
// API (see server/gmailApi.js and the README's "Email sending" section for
// the full setup, including the Google Cloud Console steps before this).
//
// Usage:
//   1. Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET in .env
//      (from Google Cloud Console -> APIs & Services -> Credentials, a
//      "Desktop app" OAuth client).
//   2. node scripts/gmailOAuthSetup.mjs
//   3. Open the printed URL, sign in with the Gmail account that should
//      send mail, and approve access. This script catches the redirect
//      automatically — no copy-pasting a code.
//   4. It prints a GMAIL_OAUTH_REFRESH_TOKEN — add that to .env (and to
//      Render's environment variables once it works locally).
import "dotenv/config";
import http from "node:http";

const CLIENT_ID = process.env.GMAIL_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET;
const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET in .env first — see the README.");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.send");
// access_type=offline is what makes Google issue a refresh token at all
// (not just a short-lived access token); prompt=consent forces the consent
// screen even if this account already approved it before, which is also
// what guarantees a fresh refresh token comes back this time.
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\nOpen this URL and sign in with the Gmail account that should send mail:\n");
console.log(authUrl.toString());
console.log("\nWaiting for you to approve access…\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) {
    res.end("Access was not granted. Check the terminal and try again.");
    console.error(`\nGoogle returned an error: ${error}`);
    server.close();
    process.exit(1);
  }
  if (!code) {
    res.end("No authorization code received. Check the terminal and try again.");
    return;
  }
  res.end("Success — you can close this tab and go back to the terminal.");
  server.close();

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("\nToken exchange failed:", tokens.error_description || tokens.error || tokens);
      process.exit(1);
    }
    if (!tokens.refresh_token) {
      console.error(
        "\nGoogle didn't return a refresh token. This usually means this account already has one issued " +
          "and consent wasn't forced — try again (this script always sends prompt=consent, so this shouldn't " +
          "normally happen), or revoke the app's access at https://myaccount.google.com/permissions and retry."
      );
      process.exit(1);
    }
    console.log("\nSuccess! Add this to your .env (and later to Render's environment variables):\n");
    console.log(`GMAIL_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
    process.exit(0);
  } catch (err) {
    console.error("\nToken exchange failed:", err.message || err);
    process.exit(1);
  }
});

server.listen(PORT);
