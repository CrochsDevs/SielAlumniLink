import nodemailer from 'nodemailer';
import { fileURLToPath } from 'node:url';

const logoPath = fileURLToPath(new URL('../assets/clsu_logo.png', import.meta.url));
export const EMAIL_DELIVERY_TIMEOUT_MS = 12000;
const failure = code => Object.assign(new Error('Email delivery failed'), { code });

// Gmail SMTP with an App Password. The host must permit outbound SMTP traffic.
export function createAuthEmailSender({
  env = process.env,
  createTransport = options => nodemailer.createTransport(options),
  logger = console,
  timeoutMs = EMAIL_DELIVERY_TIMEOUT_MS,
} = {}) {
  return async (to, message) => {
    let timer, transport;
    try {
      const user = env.EMAIL_USER?.trim();
      const pass = env.EMAIL_PASS?.replace(/\s+/g, '');
      if ((env.EMAIL_PROVIDER && env.EMAIL_PROVIDER !== 'smtp') || !user || !pass || /[\r\n]/.test(user)) {
        throw failure('ECONFIG');
      }
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(failure('ETIMEDOUT'));
        }, timeoutMs);
      });
      const delivery = (async () => {
        transport = createTransport({
          service: 'gmail',
          // Google displays App Passwords in groups; pasted spaces are not part
          // of the credential. These settings are for Gmail App Passwords only.
          auth: { user, pass },
          connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
          tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
        });
        await transport.sendMail({
          from: { name: 'SielAlumni', address: user }, to, ...message,
          attachments: [{ filename: 'clsu-logo.png', path: logoPath,
            cid: 'clsu-logo@alumnilink', contentType: 'image/png', contentDisposition: 'inline' }],
        });
      })();
      await Promise.race([delivery, deadline]);
      logger.log('Authentication email accepted for delivery (smtp)');
      return { success: true };
    } catch (error) {
      // Never log a provider response, recipient, link, OTP, or credentials.
      const code = ['ETIMEDOUT', 'EAUTH', 'ECONNECTION', 'ESOCKET', 'EDNS', 'ECONFIG'].includes(error?.code)
        ? error.code : 'EDELIVERY';
      logger.error(`Authentication email delivery failed (${code}; provider=smtp)`);
      return { success: false };
    } finally {
      clearTimeout(timer);
      try { transport?.close?.(); } catch { /* Cleanup must not change the auth response. */ }
    }
  };
}
