import nodemailer from 'nodemailer';
import { fileURLToPath } from 'node:url';

const logoPath = fileURLToPath(new URL('../assets/clsu_logo.png', import.meta.url));
export const EMAIL_DELIVERY_TIMEOUT_MS = 12000;
const failure = code => Object.assign(new Error('Email delivery failed'), { code });

// Brevo uses HTTPS on Render Free. SMTP remains available for local development.
export function createAuthEmailSender({
  env = process.env,
  createTransport = options => nodemailer.createTransport(options),
  fetchImpl = globalThis.fetch,
  logger = console,
  timeoutMs = EMAIL_DELIVERY_TIMEOUT_MS,
} = {}) {
  return async (to, message, { onDelivery } = {}) => {
    let timer, transport, controller, providerStatus;
    const provider = env.EMAIL_PROVIDER?.trim() || 'smtp';
    try {
      const user = env.EMAIL_USER?.trim();
      const pass = env.EMAIL_PASS?.replace(/\s+/g, '');
      const apiKey = env.BREVO_API_KEY?.trim();
      if (!['smtp', 'brevo'].includes(provider) || !user || /[\r\n]/.test(user)
        || (provider === 'smtp' ? !pass : !apiKey || /[\r\n]/.test(apiKey))) {
        throw failure('ECONFIG');
      }
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller?.abort();
          reject(failure('ETIMEDOUT'));
        }, timeoutMs);
      });
      const delivery = (async () => {
        if (provider === 'brevo') {
          controller = new AbortController();
          // Brevo's attachment schema has no caller-controlled CID. Use our
          // public seal instead; keep text branding if no HTTPS origin exists.
          let logo = '';
          try {
            const frontend = new URL(env.FRONTEND_URL);
            if (frontend.protocol === 'https:') logo = new URL('/clsu_favicon.png', frontend.origin).href;
          } catch { /* The message can still render its text branding. */ }
          const htmlContent = message.html.replace(/<img\b[^>]*src="cid:clsu-logo@alumnilink"[^>]*>/g,
            logo ? `<img src="${logo}" width="76" height="76" alt="CLSU seal" style="display:block;margin:0 auto 14px;">` : '');
          const response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
            method: 'POST', redirect: 'error', signal: controller.signal,
            headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ sender: { name: 'SielAlumni', email: user },
              to: [{ email: to, removeTrackingPixel: true }], subject: message.subject, htmlContent }),
          });
          providerStatus = response.status;
          // Never print provider bodies: they can include recipients or secrets.
          if (!response.ok) {
            const code = response.status === 429 ? 'ERATELIMIT'
              : [401, 403].includes(response.status) ? 'EAUTH'
                : response.status >= 500 ? 'EPROVIDER' : 'EREQUEST';
            await response.body?.cancel();
            throw failure(code);
          }
          const result = await response.json();
          if (typeof result.messageId !== 'string' || !result.messageId.trim()) throw failure('EDELIVERY');
          return;
        }
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
      if (onDelivery) {
        try { onDelivery({ emailProvider: provider, emailDelivery: 'accepted',
          ...(Number.isInteger(providerStatus) ? { providerStatus } : {}) }); } catch { /* Diagnostics only. */ }
      } else logger.log(`Authentication email accepted for delivery (${provider})`);
      return { success: true };
    } catch (error) {
      // Never log a provider response, recipient, link, OTP, or credentials.
      const code = ['ETIMEDOUT', 'EAUTH', 'ECONNECTION', 'ESOCKET', 'EDNS', 'ECONFIG', 'ERATELIMIT', 'EPROVIDER', 'EREQUEST'].includes(error?.code)
        ? error.code : 'EDELIVERY';
      const safeProvider = ['smtp', 'brevo'].includes(provider) ? provider : 'unsupported';
      if (onDelivery) {
        try { onDelivery({ emailProvider: safeProvider, emailDelivery: 'failed', deliveryCode: code,
          ...(Number.isInteger(providerStatus) ? { providerStatus } : {}) }); } catch { /* Diagnostics only. */ }
      } else logger.error(`Authentication email delivery failed (${code}; provider=${safeProvider}${Number.isInteger(providerStatus) ? `; status=${providerStatus}` : ''})`);
      return { success: false };
    } finally {
      clearTimeout(timer);
      try { transport?.close?.(); } catch { /* Cleanup must not change the auth response. */ }
    }
  };
}
