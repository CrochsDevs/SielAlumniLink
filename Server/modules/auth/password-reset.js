import { createHash, randomBytes } from 'node:crypto';

export const isResetToken = value => typeof value === 'string' && value.length === 64 && /^[a-f0-9]{64}$/.test(value);
export const resetTokenHash = token => isResetToken(token) ? createHash('sha256').update(token).digest('hex') : null;

export const createPasswordReset = () => {
    const token = randomBytes(32).toString('hex');
    return { token, tokenHash: resetTokenHash(token), expiresAt: new Date(Date.now() + 10 * 60 * 1000) };
};
