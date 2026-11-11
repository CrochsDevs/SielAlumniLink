import { createHmac } from 'node:crypto';
import { client } from '../../config/db.js';
import { authEmail } from './auth.validation.js';

export const AUTH_LIMITS = {
    login: { ip: 60, account: 10, windowMs: 15 * 60 * 1000 },
    send: { ip: 10, account: 1, windowMs: 60 * 1000 },
    verify: { ip: 60, account: 20, windowMs: 15 * 60 * 1000 },
    reset: { ip: 20, windowMs: 15 * 60 * 1000 },
    change: { ip: 60, account: 10, windowMs: 15 * 60 * 1000 },
};

export async function ensureAuthSecurityIndexes(db) {
    await db.collection('auth_rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

export function createAuthLimiter(kind, db = client.db('SielAlumni'), now = () => Date.now()) {
    const policy = AUTH_LIMITS[kind];
    return async (req, res, next) => {
        try {
            const time = now(), window = Math.floor(time / policy.windowMs);
            const expiresAt = new Date((window + 1) * policy.windowMs);
            const email = authEmail(req.user?.email || req.body?.email)?.toLowerCase();
            const buckets = [['ip', String(req.ip || req.socket?.remoteAddress || 'unknown'), policy.ip],
                ...(email && policy.account ? [['account', email, policy.account]] : [])];
            for (const [scope, identity, limit] of buckets) {
                // Keys do not expose emails/IPs in the limiter collection.
                const _id = createHmac('sha256', process.env.JWT_SECRET).update(JSON.stringify([kind, scope, identity, window])).digest('hex');
                let record;
                const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt } };
                try {
                    record = await db.collection('auth_rate_limits').findOneAndUpdate({ _id }, update, { upsert: true, returnDocument: 'after' });
                } catch (error) {
                    if (error.code !== 11000) throw error;
                    record = await db.collection('auth_rate_limits').findOneAndUpdate({ _id }, update, { returnDocument: 'after' });
                }
                if (!record || record.count > limit) {
                    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((expiresAt.getTime() - time) / 1000))));
                    return res.status(429).json({ success: false, message: 'Too many attempts. Please wait before trying again.' });
                }
            }
            next();
        } catch {
            res.status(503).json({ success: false, message: 'Authentication is temporarily unavailable. Please try again later.' });
        }
    };
}
