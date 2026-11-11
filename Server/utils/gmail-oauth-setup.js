import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { GMAIL_SEND_SCOPE, GOOGLE_TOKEN_URL } from './gmail-api.js';

const setupError = message => Object.assign(new Error(message), { code: 'EGMAIL_SETUP' });

async function saveEnvironment(filename, values) {
  let original = '';
  try { original = await readFile(filename, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const remaining = new Set(Object.keys(values));
  const lines = original.split(/\r?\n/).flatMap(line => {
    const key = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
    if (!Object.hasOwn(values, key)) return [line];
    if (!remaining.delete(key)) return [];
    return [`${key}=${JSON.stringify(values[key])}`];
  });
  for (const key of remaining) lines.push(`${key}=${JSON.stringify(values[key])}`);
  // The .local suffix is ignored by Git, including after an interrupted write.
  const temporary = `${filename}.gmail-setup-${randomBytes(8).toString('hex')}.local`;
  try {
    await writeFile(temporary, lines.join('\n').replace(/\n*$/, '\n'), { mode: 0o600, flag: 'wx' });
    await rename(temporary, filename);
  } finally { await unlink(temporary).catch(() => {}); }
}

// One-time loopback-only setup. No public callback route, email send, or token output.
export async function startGmailOAuthSetup({ clientId, clientSecret, sender, envFile,
  port = 53682, timeoutMs = 600000, fetchImpl = (...args) => fetch(...args) }) {
  if (!clientId?.endsWith('.apps.googleusercontent.com') || !clientSecret ||
      !sender || [clientId, clientSecret, sender].some(value => /[\r\n]/.test(value))) {
    throw setupError('Configure a Google Web application OAuth client and EMAIL_USER first.');
  }
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const controller = new AbortController();
  let resolveDone, rejectDone, timer, redirectUri, busy = false, settled = false;
  const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
  const finish = error => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    controller.abort();
    server.close();
    if (error) rejectDone(error); else resolveDone({ success: true });
  };
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (!redirectUri || req.headers.host !== new URL(redirectUri).host || req.method !== 'GET') {
      res.writeHead(400).end('Invalid local callback.'); return;
    }
    const url = new URL(req.url, redirectUri);
    if (url.pathname !== '/oauth2/callback') { res.writeHead(404).end('Not found.'); return; }
    const returnedState = Buffer.from(url.searchParams.get('state') || '');
    const expectedState = Buffer.from(state);
    if (returnedState.length !== expectedState.length || !timingSafeEqual(returnedState, expectedState)) {
      res.writeHead(400).end('Authorization state did not match. Use the original consent link.'); return;
    }
    if (busy || settled) { res.writeHead(409).end('This setup request is already being processed.'); return; }
    busy = true;
    try {
      if (url.searchParams.has('error')) throw setupError('Google authorization was declined. Run setup again when ready.');
      const code = url.searchParams.get('code');
      if (!code) throw setupError('Google did not return an authorization code. Run setup again.');
      const response = await fetchImpl(GOOGLE_TOKEN_URL, {
        method: 'POST', redirect: 'error',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret,
          code, code_verifier: verifier, redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString(),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw setupError('Google rejected authorization. Check the client and exact redirect URI, then run setup again.');
      }
      const tokens = await response.json();
      if (typeof tokens.refresh_token !== 'string' || !tokens.refresh_token ||
          !String(tokens.scope || '').split(' ').includes(GMAIL_SEND_SCOPE)) {
        throw setupError('Google did not grant offline Gmail sending. Run setup again and allow the sending permission.');
      }
      if (controller.signal.aborted) throw setupError('Setup expired. Run setup again.');
      await saveEnvironment(envFile, { EMAIL_PROVIDER: 'gmail_api', EMAIL_USER: sender,
        GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, GOOGLE_REFRESH_TOKEN: tokens.refresh_token });
      res.end('Google authorization saved locally. You can close this tab and return to your terminal.');
      finish();
    } catch (error) {
      res.writeHead(400).end('Setup could not be completed. Return to the terminal for the next step.');
      // Only our fixed messages are allowed to reach the CLI; never echo Google responses.
      finish(setupError(error.code === 'EGMAIL_SETUP'
        ? error.message : 'Could not complete Google setup. Check connectivity and local file permissions, then retry.'));
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  redirectUri = `http://127.0.0.1:${server.address().port}/oauth2/callback`;
  timer = setTimeout(() => finish(setupError('Setup expired after ten minutes. Run setup again.')), timeoutMs);
  const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorization.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri,
    response_type: 'code', scope: GMAIL_SEND_SCOPE, access_type: 'offline', prompt: 'consent',
    state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
  return { authorizationUrl: authorization.toString(), redirectUri, done,
    close: () => finish(setupError('Setup cancelled.')) };
}
