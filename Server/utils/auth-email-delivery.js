import nodemailer from 'nodemailer';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const logoPath = fileURLToPath(new URL('../assets/clsu_logo.png', import.meta.url));
export const EMAIL_DELIVERY_TIMEOUT_MS = 12000;
const failure = code => Object.assign(new Error('Email delivery failed'), { code });

// HTTPS delivery works on hosts that block SMTP. All credentials stay server-side.
export function createAuthEmailSender({
  env = process.env,
  fetchImpl = (...args) => fetch(...args),
  createTransport = options => nodemailer.createTransport(options),
  readLogo = () => readFile(logoPath),
  logger = console,
  timeoutMs = EMAIL_DELIVERY_TIMEOUT_MS,
} = {}) {
  return async (to, message) => {
    const provider = env.EMAIL_PROVIDER || (env.RESEND_API_KEY ? 'resend' : 'smtp');
    const controller = new AbortController();
    let timer, transport;
    try {
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(failure('ETIMEDOUT'));
        }, timeoutMs);
      });
      const delivery = (async () => {
        if (provider === 'resend') {
          if (!env.RESEND_API_KEY || !env.EMAIL_FROM || /[\r\n]/.test(env.EMAIL_FROM)) throw failure('ECONFIG');
          const logo = await readLogo();
          const response = await fetchImpl('https://api.resend.com/emails', {
            method: 'POST',
            redirect: 'error',
            signal: controller.signal,
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: env.EMAIL_FROM, to: [to], subject: message.subject,
              text: message.text, html: message.html,
              attachments: [{ filename: 'clsu-logo.png', content: logo.toString('base64'),
                content_type: 'image/png', content_id: 'clsu-logo@alumnilink' }],
            }),
          });
          if (!response.ok) {
            await response.body?.cancel();
            throw failure('EPROVIDER');
          }
          const accepted = await response.json();
          if (typeof accepted?.id !== 'string' || !accepted.id) throw failure('EPROVIDER');
          return;
        }
        if (provider !== 'smtp') throw failure('ECONFIG');
        transport = createTransport({
          service: 'gmail',
          // Google displays App Passwords in groups; pasted spaces are not part
          // of the credential. These settings are for Gmail App Passwords only.
          auth: { user: env.EMAIL_USER?.trim(), pass: env.EMAIL_PASS?.replace(/\s+/g, '') },
          connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
          tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
        });
        await transport.sendMail({
          from: `"SielAlumni" <${env.EMAIL_USER}>`, to, ...message,
          attachments: [{ filename: 'clsu-logo.png', path: logoPath,
            cid: 'clsu-logo@alumnilink', contentType: 'image/png', contentDisposition: 'inline' }],
        });
      })();
      await Promise.race([delivery, deadline]);
      logger.log('Authentication email accepted for delivery');
      return { success: true };
    } catch (error) {
      // Never log a provider response, recipient, link, OTP, or credentials.
      const code = ['ETIMEDOUT', 'EAUTH', 'ECONNECTION', 'ESOCKET', 'EDNS', 'ECONFIG', 'EPROVIDER'].includes(error?.code)
        ? error.code : 'EDELIVERY';
      logger.error(`Authentication email delivery failed (${code})`);
      return { success: false };
    } finally {
      clearTimeout(timer);
      controller.abort();
      transport?.close?.();
    }
  };
}
