import jwt from 'jsonwebtoken';

const issuer = 'alumnilink';
const audience = 'alumnilink-session';
export const sessionVersion = user => Number.isSafeInteger(user?.sessionVersion) ? user.sessionVersion : 0;
export const activeAccount = user => !!user && !user.disabledAt;
export const sessionMatches = (claims, user) => activeAccount(user) && claims.sv === sessionVersion(user);

export const signSessionToken = user => jwt.sign(
    { purpose: 'session', sv: sessionVersion(user) },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', issuer, audience, subject: String(user._id), expiresIn: '7d' }
);

export const verifySessionToken = token => {
    const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer, audience });
    if (claims.purpose !== 'session' || typeof claims.sub !== 'string' || !claims.sub ||
        !Number.isSafeInteger(claims.sv) || claims.sv < 0 || !Number.isFinite(claims.exp)) {
        throw new Error('Invalid session token');
    }
    return claims;
};
