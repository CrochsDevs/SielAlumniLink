import { magicLinkEmail, passwordResetEmail } from './email-templates.js';
import { createAuthEmailSender } from './auth-email-delivery.js';

const sendAuthEmail = createAuthEmailSender();

export const sendOTPEmail = (to, otp) => sendAuthEmail(to, passwordResetEmail(otp));
export const sendMagicLinkEmail = (to, loginUrl) => sendAuthEmail(to, magicLinkEmail(loginUrl));
