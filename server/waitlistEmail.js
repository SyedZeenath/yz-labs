// The confirmation sent to the person who joined the waitlist — separate
// from the shop's own "someone signed up" notification (see
// POST /api/waitlist in server/index.js, which sends both).
export function buildWaitlistConfirmationEmail(email, { shopEmail } = {}) {
  const text = [
    "Hi,",
    "",
    "You're on the YZ Labs waitlist — we'll email you the moment the next batch drops.",
    "",
    "Take a look at the current catalog in the meantime: https://yz-labs.onrender.com/catalog",
    "",
    "YZ Labs",
    "Small-batch 3D-printed objects, Bengaluru",
    ...(shopEmail ? [shopEmail] : []),
  ].join("\n");

  return {
    to: email,
    subject: "You're on the YZ Labs waitlist",
    text,
    replyTo: shopEmail || undefined,
  };
}
