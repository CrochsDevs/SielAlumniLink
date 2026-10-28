import nodemailer from 'nodemailer';
import { fileURLToPath } from 'node:url';
import { magicLinkEmail, passwordResetEmail } from './email-templates.js';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Embed a server-owned asset so the logo works without a public frontend URL.
const logoPath = fileURLToPath(new URL('../assets/clsu_logo.png', import.meta.url));

const sendAuthEmail = async (to, message) => {
    try {
        await transporter.sendMail({
            from: `"SielAlumni" <${process.env.EMAIL_USER}>`,
            to,
            ...message,
            attachments: [{
                filename: 'clsu-logo.png',
                path: logoPath,
                cid: 'clsu-logo@alumnilink',
                contentType: 'image/png',
                contentDisposition: 'inline'
            }]
        });
        console.log('Authentication email sent successfully');
        return { success: true };
    } catch {
        // Provider errors may contain the message body or authentication secrets.
        console.error('Authentication email delivery failed');
        return { success: false };
    }
};

export const sendOTPEmail = (to, otp) => sendAuthEmail(to, passwordResetEmail(otp));
export const sendMagicLinkEmail = (to, loginUrl) => sendAuthEmail(to, magicLinkEmail(loginUrl));
