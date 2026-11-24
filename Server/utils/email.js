import { magicLinkEmail, passwordResetEmail, invitationEmail } from './email-templates.js';
import { createAuthEmailSender } from './auth-email-delivery.js';

const sendAuthEmail = createAuthEmailSender();

export const sendOTPEmail = (to, otp, context) => sendAuthEmail(to, passwordResetEmail(otp), context);
export const sendMagicLinkEmail = (to, loginUrl, context) => sendAuthEmail(to, magicLinkEmail(loginUrl), context);
export const sendInvitationEmail = (to, invitationUrl) => sendAuthEmail(to, invitationEmail(invitationUrl));
