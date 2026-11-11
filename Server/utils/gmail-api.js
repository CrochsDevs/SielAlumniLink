export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const fail = (code) => {
  throw Object.assign(new Error("Gmail API delivery failed"), { code });
};

export function gmailApiConfiguration(env) {
  const sender = env.EMAIL_USER?.trim();
  if (
    !sender ||
    /[\r\n]/.test(sender) ||
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    !env.GOOGLE_REFRESH_TOKEN
  )
    fail("ECONFIG");
  return {
    sender,
    clientId: env.GOOGLE_CLIENT_ID.trim(),
    clientSecret: env.GOOGLE_CLIENT_SECRET.trim(),
    refreshToken: env.GOOGLE_REFRESH_TOKEN.trim(),
  };
}

// Refresh the access token for each send. No tokens are persisted, logged, or
// put in URLs, and an uncertain send is never retried automatically.
export async function sendGmailApiEmail({ config, raw, fetchImpl, signal }) {
  const tokenResponse = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    redirect: "error",
    signal,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!tokenResponse.ok) {
    await tokenResponse.body?.cancel();
    fail([400, 401].includes(tokenResponse.status) ? "EAUTH" : "EPROVIDER");
  }
  const token = await tokenResponse.json();
  if (
    typeof token?.access_token !== "string" ||
    !token.access_token ||
    token.token_type?.toLowerCase() !== "bearer"
  )
    fail("EAUTH");
  const response = await fetchImpl(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      redirect: "error",
      signal,
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: raw.toString("base64url") }),
    },
  );
  if (!response.ok) {
    await response.body?.cancel();
    fail(
      response.status === 401
        ? "EAUTH"
        : response.status === 403
          ? "EPERMISSION"
          : response.status === 429
            ? "EQUOTA"
            : "EPROVIDER",
    );
  }
  const accepted = await response.json();
  if (typeof accepted?.id !== "string" || !accepted.id) fail("EPROVIDER");
}
