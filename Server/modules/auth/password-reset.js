import { createHash, createHmac, randomBytes } from 'node:crypto';

export const isResetToken = value => typeof value === 'string' && value.length === 64 && /^[a-f0-9]{64}$/.test(value);
export const resetTokenHash = token => isResetToken(token) ? createHash('sha256').update(token).digest('hex') : null;

// A six-digit code is too small for an unkeyed hash: bind it to the account
// and a server-side secret so a database-only leak cannot enumerate every code.
export const otpHash = (email, otp) => createHmac('sha256', process.env.JWT_SECRET)
    .update(JSON.stringify(['password-reset-otp', email, otp])).digest('hex');

export const createPasswordReset = () => {
    const token = randomBytes(32).toString('hex');
    return { token, tokenHash: resetTokenHash(token), expiresAt: new Date(Date.now() + 10 * 60 * 1000) };
};
