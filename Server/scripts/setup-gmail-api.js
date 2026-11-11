import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { startGmailOAuthSetup } from '../utils/gmail-oauth-setup.js';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
try {
  let local = {};
  try { local = dotenv.parse(await readFile(envFile)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let credentials = {};
  try {
    const document = JSON.parse(await readFile(new URL('../google-oauth.credentials.local.json', import.meta.url), 'utf8'));
    credentials = document.web || {};
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Could not read the local Google OAuth client JSON. Download a Web application client JSON and retry.');
  }
  const clientId = process.env.GOOGLE_CLIENT_ID || local.GOOGLE_CLIENT_ID || credentials.client_id;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || local.GOOGLE_CLIENT_SECRET || credentials.client_secret;
  const sender = process.env.EMAIL_USER || local.EMAIL_USER;
  if (!clientId || !clientSecret || !sender) {
    console.error('Google setup is not configured yet. Follow Server/GMAIL_SETUP.md first.');
    console.error('Provide the downloaded Web application client JSON as Server/google-oauth.credentials.local.json and set EMAIL_USER in Server/.env.');
    process.exitCode = 1;
  } else {
    const setup = await startGmailOAuthSetup({ clientId, clientSecret, sender: sender.trim(), envFile });
    console.log('Open this Google consent URL in your browser and sign in with the sender configured in EMAIL_USER:');
    console.log(setup.authorizationUrl);
    console.log('This setup requests send-only Gmail access and does not send any email.');
    await setup.done;
    console.log('Saved Gmail API settings in ignored Server/.env. No refresh token was printed.');
    console.log('Restart your local backend. For Render, privately copy EMAIL_PROVIDER, EMAIL_USER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN from Server/.env into the backend Environment settings, then redeploy.');
  }
} catch {
  // Do not print caught errors: they could contain OAuth responses or local secrets.
  console.error('Google setup could not finish. Check the client type, exact redirect URI, granted send permission, connectivity, and local file access. See Server/GMAIL_SETUP.md.');
  process.exitCode = 1;
}
