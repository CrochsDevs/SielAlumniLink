import { magicLinkEmail, passwordResetEmail } from './email-templates.js';
import { createAuthEmailSender } from './auth-email-delivery.js';

const sendAuthEmail = createAuthEmailSender();

export const sendOTPEmail = (to, otp, context) => sendAuthEmail(to, passwordResetEmail(otp), context);
export const sendMagicLinkEmail = (to, loginUrl, context) => sendAuthEmail(to, magicLinkEmail(loginUrl), context);
