import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { Collection } from 'mongodb';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authEmail, isOTP } from './auth.validation.js';
import { createPasswordReset, resetTokenHash } from './password-reset.js';
import { signSessionToken, verifySessionToken, sessionMatches } from './session-token.js';

process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/auth_security_fixture';
process.env.JWT_SECRET = 'test-only-auth-security-key';
process.env.DOTENV_CONFIG_QUIET = 'true';

// Stub transport creation before loading controllers: no SMTP or database connections.
let deliver = async () => {};
mock.method(nodemailer, 'createTransport', () => ({ sendMail: message => deliver(message) }));
const { forgotPassword, verifyOTP, resetPassword, signup, login, setupPassword, changePassword, logout } = await import('./auth.controllers.js');
const { sendMagicLink, verifyMagicLink } = await import('../magic/magic.controllers.js');
const { default: AuthModel } = await import('./auth.models.js');
const { default: MagicLinkModel } = await import('../magic/magic.models.js');
const { default: UserModel } = await import('../users/users.models.js');
const { default: ActivityModel } = await import('../activity/activity.models.js');
const { protect, optionalProtect } = await import('../../middlewares/auth.middleware.js');
const { deleteUser, getUsers, getUserById, syncUsers } = await import('../users/users.controllers.js');
const { visibleProfile } = await import('../users/profile-visibility.js');

const account = { _id: 'fixture', email: 'member@example.test', password: 'fixture-hash', passwordSetupRequired: false };
const response = () => ({ statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(name, value, options) { this.cookies ||= {}; this.cookies[name] = { value, options }; return this; },
    clearCookie(name) { this.clearedCookie = name; return this; },
});
const badEmails = [undefined, null, {}, { $ne: null }, ['member@example.test'], 123456, true, '', 'invalid', 'a@b', 'a b@example.test', 'a'.repeat(255) + '@example.test'];
const badOTPs = [undefined, null, {}, { $ne: null }, { $regex: '.*' }, ['123456'], 123456, true, '', '12345', '1234567', '12345a', '123456\n', ' 123456', '１２３４５６'];
const captureLogs = t => {
    const logs = [];
    t.mock.method(console, 'log', (...args) => logs.push(args.join(' ')));
    t.mock.method(console, 'error', (...args) => logs.push(args.join(' ')));
    return logs;
};

test('login failures have the same response and bcrypt work for unknown, disabled and passwordless accounts', async t => {
    let current, comparisons = 0;
    t.mock.method(AuthModel, 'findByEmail', async () => current);
    t.mock.method(bcrypt, 'compare', async (_password, hash) => {
        comparisons++;
        assert.equal(typeof hash, 'string');
        assert.ok(hash.length > 0);
        return false;
    });
    for (current of [null, account, { ...account, disabledAt: new Date() },
        { ...account, password: undefined, passwordSetupRequired: true }]) {
        const res = response();
        await login({ body: { email: account.email, password: 'Wrong-password' } }, res);
        assert.equal(res.statusCode, 401);
        assert.deepEqual(res.body, { success: false, message: 'Invalid credentials' });
        assert.equal(res.cookies, undefined);
    }
    assert.equal(comparisons, 4);
});

test('recovery responses conceal account eligibility and mail delivery status', async t => {
    captureLogs(t);
    let current;
    t.mock.method(AuthModel, 'findByEmail', async () => current);
    t.mock.method(AuthModel, 'updateOTP', async () => {});
    t.mock.method(AuthModel, 'clearOTP', async () => {});
    const responses = [];
    for (current of [null, { ...account, disabledAt: new Date() },
        { ...account, password: undefined, passwordSetupRequired: true }, account, account]) {
        deliver = responses.length === 4 ? async () => { throw new Error('Simulated mail failure'); } : async () => {};
        const res = response(); await forgotPassword({ body: { email: account.email } }, res);
        assert.equal(res.statusCode, 200);
        responses.push(res.body);
    }
    for (const body of responses) assert.deepEqual(body, responses[0]);
});

test('setup signs the version of its own write instead of adopting a later revocation', async t => {
    const user = { ...account, password: undefined, passwordSetupRequired: true, sessionVersion: 7 };
    t.mock.method(AuthModel, 'updatePasswordById', async (_id, _hash, expected) => {
        assert.equal(expected, user);
        return { modifiedCount: 1 };
    });
    const reread = t.mock.method(AuthModel, 'findById', async () => ({ ...user, sessionVersion: 9 }));
    t.mock.method(UserModel, 'findByAuthId', async () => null);
    const res = response();
    await setupPassword({ user, body: { newPassword: 'First-password', confirmPassword: 'First-password' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(verifySessionToken(res.cookies.token.value).sv, 8);
    assert.equal(reread.mock.callCount(), 0);
});

test('conditional password writes check both credential state and the authorized session version', async t => {
    t.mock.method(Collection.prototype, 'updateOne', async (filter, update) => {
        assert.equal(filter.password, account.password);
        assert.equal(filter.passwordSetupRequired, false);
        assert.equal(update.$inc.sessionVersion, 1);
        if (filter.sessionVersion === 4) return { modifiedCount: 0 };
        assert.deepEqual(filter.$or, [{ sessionVersion: 0 }, { sessionVersion: { $exists: false } }]);
        return { modifiedCount: 1 };
    });
    assert.equal((await AuthModel.updatePasswordById(account._id, 'new-hash', { ...account, sessionVersion: 4 })).modifiedCount, 0);
    assert.equal((await AuthModel.updatePasswordById(account._id, 'new-hash', account)).modifiedCount, 1);
});

test('an in-flight password change rejected by the conditional write cannot claim success', async t => {
    t.mock.method(AuthModel, 'findByEmail', async () => account);
    t.mock.method(bcrypt, 'compare', async () => true);
    t.mock.method(AuthModel, 'updatePasswordById', async (_id, _hash, expected) => {
        assert.equal(expected, account); return { modifiedCount: 0 };
    });
    const res = response();
    await changePassword({ user: account, body: { currentPassword: 'Current-password', newPassword: 'New-password', confirmPassword: 'New-password' } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.clearedCookie, undefined);
});

test('logout reports storage/revocation failure without clearing the retry credential or leaking details', async t => {
    const token = signSessionToken(account);
    const lookup = t.mock.method(AuthModel, 'findById', async () => account);
    const revoke = t.mock.method(AuthModel, 'revokeSessionsById', async () => { throw new Error('PRIVATE_STORAGE_DETAIL'); });
    for (const failure of ['write', 'read', 'no-update']) {
        if (failure === 'read') lookup.mock.mockImplementation(async () => { throw new Error('PRIVATE_STORAGE_DETAIL'); });
        if (failure === 'no-update') {
            lookup.mock.mockImplementation(async () => account);
            revoke.mock.mockImplementation(async () => ({ modifiedCount: 0 }));
        }
        const res = response(); await logout({ cookies: { token } }, res);
        assert.equal(res.statusCode, 503);
        assert.equal(res.body.success, false);
        assert.equal(res.clearedCookie, undefined);
        assert.equal(JSON.stringify(res.body).includes('PRIVATE_STORAGE_DETAIL'), false);
    }
});

test('successful logout still clears invalid cookies and tolerates optional audit failure', async t => {
    t.mock.method(AuthModel, 'findById', async () => account);
    const revoke = t.mock.method(AuthModel, 'revokeSessionsById', async () => ({ modifiedCount: 1 }));
    t.mock.method(ActivityModel, 'log', async () => { throw new Error('Audit unavailable'); });
    for (const token of [undefined, 'invalid-cookie', signSessionToken(account)]) {
        const res = response(); await logout({ cookies: { token } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.clearedCookie, 'token');
    }
    assert.equal(revoke.mock.callCount(), 1);
});

test('authentication scalar validation rejects objects, arrays and malformed codes', () => {
    for (const email of badEmails) assert.equal(authEmail(email), null);
    for (const otp of badOTPs) assert.equal(isOTP(otp), false);
    assert.equal(authEmail(' member@example.test '), account.email);
    assert.equal(isOTP('000001'), true);
});

test('OTP verification rejects operator injection and malformed requests before querying', async t => {
    const lookup = t.mock.method(AuthModel, 'exchangeOTPForResetToken', async () => { throw new Error('Unexpected query'); });
    for (const body of [undefined, null, ...badEmails.map(email => ({ email, otp: '123456' })), ...badOTPs.map(otp => ({ email: account.email, otp }))]) {
        const res = response();
        await verifyOTP({ body }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.equal(res.body.data, undefined);
    }
    assert.equal(lookup.mock.callCount(), 0);
});

test('recovery model rejects query objects even when called without a controller', async t => {
    const read = t.mock.method(Collection.prototype, 'findOne', async () => { throw new Error('Unexpected query'); });
    const write = t.mock.method(Collection.prototype, 'updateOne', async () => { throw new Error('Unexpected update'); });
    for (const [email, otp] of [...badEmails.map(email => [email, '123456']), ...badOTPs.map(otp => [account.email, otp])]) {
        assert.equal(await AuthModel.findByOTP(email, otp), null);
        await assert.rejects(AuthModel.updateOTP(email, otp, new Date()), TypeError);
        await assert.rejects(AuthModel.clearOTP(email, otp), TypeError);
    }
    assert.equal(read.mock.callCount(), 0);
    assert.equal(write.mock.callCount(), 0);
});

test('valid OTP lookup uses exact scalar comparisons and an expiry check', async t => {
    t.mock.method(Collection.prototype, 'findOne', async query => {
        assert.equal(query.email, account.email);
        assert.equal(query.resetOTP, '000001');
        assert.ok(query.resetOTPExpires.$gt instanceof Date);
        return account;
    });
    assert.equal(await AuthModel.findByOTP(' member@example.test ', '000001'), account);
});

test('valid verification still returns a recovery token; wrong codes stay rejected', async t => {
    let savedHash;
    t.mock.method(AuthModel, 'exchangeOTPForResetToken', async (email, otp, hash, expiry) => {
        assert.ok(expiry > new Date());
        if (email !== account.email || otp !== '123456') return null;
        savedHash = hash; return account;
    });
    const valid = response();
    await verifyOTP({ body: { email: ' member@example.test ', otp: '123456' } }, valid);
    assert.equal(valid.statusCode, 200);
    assert.equal(resetTokenHash(valid.body.data.resetToken), savedHash);
    assert.notEqual(valid.body.data.resetToken, savedHash);
    const invalid = response();
    await verifyOTP({ body: { email: account.email, otp: '000000' } }, invalid);
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.body.data, undefined);
});

test('password and magic-link requests reject invalid emails before querying', async t => {
    const lookup = t.mock.method(AuthModel, 'findByEmail', async () => { throw new Error('Unexpected query'); });
    for (const handler of [forgotPassword, sendMagicLink]) {
        for (const email of badEmails) {
            const res = response();
            await handler({ body: { email } }, res);
            assert.equal(res.statusCode, 400);
        }
    }
    assert.equal(lookup.mock.callCount(), 0);
});

test('successful delivery sends a six-digit code only through email', async t => {
    captureLogs(t);
    let code, expiresAt, sent;
    t.mock.method(AuthModel, 'findByEmail', async () => account);
    t.mock.method(AuthModel, 'updateOTP', async (_email, otp, expiry) => { code = otp; expiresAt = expiry; });
    const clear = t.mock.method(AuthModel, 'clearOTP', async () => {});
    deliver = async message => { sent = message; };
    const res = response();
    await forgotPassword({ body: { email: ' member@example.test ' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(isOTP(code));
    assert.ok(expiresAt > new Date() && expiresAt <= new Date(Date.now() + 600000));
    assert.equal(sent.to, account.email);
    assert.ok(sent.text.includes(code));
    assert.equal(JSON.stringify(res.body).includes(code), false);
    assert.equal(Object.hasOwn(res.body, 'devOTP'), false);
    assert.equal(clear.mock.callCount(), 0);
});

for (const environment of ['production', 'development']) {
    test(`${environment}: failed mail never returns or logs the code and clears the failed challenge`, async t => {
        const previousEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = environment;
        t.after(() => { if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv; });
        const logs = captureLogs(t);
        let code;
        t.mock.method(AuthModel, 'findByEmail', async () => account);
        t.mock.method(AuthModel, 'updateOTP', async (_email, otp) => { code = otp; });
        const clear = t.mock.method(AuthModel, 'clearOTP', async (email, otp) => {
            assert.equal(email, account.email); assert.equal(otp, code);
        });
        // Simulate a provider exception containing the secret-bearing message body.
        deliver = async message => { throw new Error(`SMTP rejected ${message.text}`); };
        const res = response();
        await forgotPassword({ body: { email: account.email } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(Object.hasOwn(res.body, 'devOTP'), false);
        assert.equal(JSON.stringify(res.body).includes(code), false);
        assert.equal(logs.join('\n').includes(code), false);
        assert.equal(clear.mock.callCount(), 1);
    });
}

test('failed OTP cleanup cannot invalidate a newer concurrently issued code', async t => {
    let currentCode = '222222';
    t.mock.method(Collection.prototype, 'updateOne', async (filter, update) => {
        assert.deepEqual(filter, { email: account.email, resetOTP: '111111' });
        assert.equal(update.$set.resetOTP, null);
        assert.equal(update.$set.resetOTPExpires, null);
        if (filter.resetOTP === currentCode) currentCode = update.$set.resetOTP;
        return { matchedCount: 0, modifiedCount: 0 };
    });
    await AuthModel.clearOTP(account.email, '111111');
    assert.equal(currentCode, '222222');
});

test('recovery errors redact provider/database details', async t => {
    const logs = captureLogs(t);
    t.mock.method(AuthModel, 'findByEmail', async () => { throw new Error('PRIVATE_DATABASE_DETAIL'); });
    t.mock.method(AuthModel, 'exchangeOTPForResetToken', async () => { throw new Error('PRIVATE_DATABASE_DETAIL'); });
    for (const handler of [forgotPassword, verifyOTP]) {
        const res = response();
        await handler({ body: { email: account.email, otp: '123456' } }, res);
        assert.equal(res.statusCode, 500);
        assert.equal(JSON.stringify(res.body).includes('PRIVATE_DATABASE_DETAIL'), false);
    }
    assert.equal(logs.join('\n').includes('PRIVATE_DATABASE_DETAIL'), false);
});

test('magic-link email failure removes only its token and never logs the link', async t => {
    const logs = captureLogs(t);
    let token;
    t.mock.method(AuthModel, 'findByEmail', async () => account);
    t.mock.method(MagicLinkModel, 'deleteByEmail', async () => {});
    t.mock.method(MagicLinkModel, 'create', async data => { token = data.token; });
    const discard = t.mock.method(MagicLinkModel, 'deleteToken', async value => assert.equal(value, token));
    deliver = async message => { throw new Error(`SMTP rejected ${message.text}`); };
    const res = response();
    await sendMagicLink({ body: { email: account.email } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(discard.mock.callCount(), 1);
    assert.equal(JSON.stringify(res.body).includes(token), false);
    assert.equal(logs.join('\n').includes(token), false);
});

test('magic-link verification errors do not expose the requested token', async t => {
    const logs = captureLogs(t);
    const token = 'a'.repeat(64);
    t.mock.method(MagicLinkModel, 'claimToken', async () => { throw new Error(`Database error for token ${token}`); });
    const res = response();
    await verifyMagicLink({ query: { token } }, res);
    assert.equal(res.statusCode, 500);
    assert.equal(JSON.stringify(res.body).includes(token), false);
    assert.equal(logs.join('\n').includes(token), false);
});

// Exercise the actual recovery model using an atomic in-memory Collection stub.
// No MongoDB connection is opened. Read snapshots are detached like real driver results.
function recoveryFixture(t) {
    const state = { ...account, password: bcrypt.hashSync('Previous-password', 4),
        resetOTP: '123456', resetOTPExpires: new Date(Date.now() + 600000) };
    const matches = filter => Object.entries(filter).every(([key, expected]) => {
        if (key === '$or') return expected.some(matches);
        if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
            return Object.entries(expected).every(([op, value]) => {
                if (op === '$gt') return state[key] > value;
                if (op === '$ne') return state[key] !== value;
                if (op === '$type') return typeof state[key] === value;
                if (op === '$exists') return (state[key] !== undefined) === value;
                if (op === '$lt') return state[key] < value;
                throw new Error(`Unsupported fixture operator: ${op}`);
            });
        }
        return expected === null ? state[key] == null : state[key] === expected;
    });
    const apply = update => {
        Object.assign(state, update.$set || {});
        for (const [key, value] of Object.entries(update.$inc || {})) state[key] = (state[key] || 0) + value;
        for (const key of Object.keys(update.$unset || {})) delete state[key];
    };
    t.mock.method(Collection.prototype, 'findOne', async filter => matches(filter) ? { ...state } : null);
    t.mock.method(Collection.prototype, 'findOneAndUpdate', async (filter, update) => {
        if (!matches(filter)) return null;
        apply(update); return { ...state };
    });
    t.mock.method(Collection.prototype, 'updateOne', async (filter, update) => {
        if (!matches(filter)) return { matchedCount: 0, modifiedCount: 0 };
        apply(update); return { matchedCount: 1, modifiedCount: 1 };
    });
    return state;
}
const verifyCode = async (otp = '123456') => {
    const res = response(); await verifyOTP({ body: { email: account.email, otp } }, res); return res;
};
const resetWith = async (token, newPassword = 'Updated-password') => {
    const res = response(); await resetPassword({ body: { token, newPassword } }, res); return res;
};

test('reset credentials are random, hashed at rest and expire after ten minutes', () => {
    const first = createPasswordReset(), second = createPasswordReset();
    assert.match(first.token, /^[a-f0-9]{64}$/);
    assert.notEqual(first.token, second.token);
    assert.equal(first.tokenHash, resetTokenHash(first.token));
    assert.notEqual(first.tokenHash, first.token);
    assert.ok(first.expiresAt > new Date(Date.now() + 599000));
    assert.ok(first.expiresAt <= new Date(Date.now() + 600000));
});

test('recovery tokens and legacy JWTs cannot authenticate through either HTTP guard', async t => {
    const lookup = t.mock.method(AuthModel, 'findById', async () => account);
    const claims = verifySessionToken(signSessionToken(account));
    assert.equal(claims.sub, account._id);
    assert.equal(claims.purpose, 'session');
    const invalidTokens = [createPasswordReset().token,
        jwt.sign({ email: account.email }, process.env.JWT_SECRET, { expiresIn: '10m' }),
        jwt.sign({ id: account._id, email: account.email }, process.env.JWT_SECRET, { expiresIn: '7d' }),
        jwt.sign({ purpose: 'reset' }, process.env.JWT_SECRET, { subject: account._id, issuer: 'alumnilink', audience: 'alumnilink-session' }),
        jwt.sign({ purpose: 'session' }, process.env.JWT_SECRET, { subject: account._id, issuer: 'other', audience: 'alumnilink-session' }),
        jwt.sign({ purpose: 'session' }, process.env.JWT_SECRET, { subject: account._id, issuer: 'alumnilink', audience: 'other' }),
    ];
    for (const token of invalidTokens) {
        let allowed = false;
        const res = response();
        await protect({ cookies: { token } }, res, () => { allowed = true; });
        assert.equal(res.statusCode, 401);
        assert.equal(allowed, false);
        const req = { cookies: { token } };
        await optionalProtect(req, response(), () => {});
        assert.equal(req.user, null);
    }
    assert.equal(lookup.mock.callCount(), 0);
    let allowed = false;
    const req = { cookies: { token: signSessionToken(account) } };
    await protect(req, response(), () => { allowed = true; });
    assert.equal(allowed, true);
    assert.equal(req.user._id, account._id);
});

test('session JWTs, old reset JWTs and malformed reset tokens never query recovery records', async t => {
    const lookup = t.mock.method(AuthModel, 'findByResetToken', async () => { throw new Error('Unexpected query'); });
    for (const token of [signSessionToken(account), jwt.sign({ email: account.email }, process.env.JWT_SECRET),
        null, {}, { $ne: null }, ['a'.repeat(64)], 123456, 'short', 'g'.repeat(64), 'a'.repeat(64) + '\n']) {
        assert.equal((await resetWith(token)).statusCode, 401);
    }
    assert.equal(lookup.mock.callCount(), 0);
});

test('OTP exchange and password reset are each single-use and store only a token hash', async t => {
    const state = recoveryFixture(t);
    const verified = await verifyCode();
    assert.equal(verified.statusCode, 200);
    const token = verified.body.data.resetToken;
    assert.equal(state.passwordResetTokenHash, resetTokenHash(token));
    assert.equal(JSON.stringify(state).includes(token), false);
    assert.equal(state.resetOTP, undefined);
    assert.equal((await verifyCode()).statusCode, 400);
    assert.equal((await resetWith(token)).statusCode, 200);
    assert.ok(await bcrypt.compare('Updated-password', state.password));
    assert.equal(state.passwordResetTokenHash, undefined);
    assert.equal(state.passwordResetTokenExpires, undefined);
    assert.equal((await resetWith(token, 'Replayed-password')).statusCode, 401);
    assert.ok(await bcrypt.compare('Updated-password', state.password));
});

test('concurrent OTP verifications issue only one reset credential', async t => {
    recoveryFixture(t);
    const responses = await Promise.all([verifyCode(), verifyCode()]);
    assert.deepEqual(responses.map(res => res.statusCode).sort(), [200, 400]);
});

test('concurrent password resets consume the token and update the password once', async t => {
    const state = recoveryFixture(t);
    const verified = await verifyCode();
    const token = verified.body.data.resetToken;
    const passwords = ['Concurrent-password-one', 'Concurrent-password-two'];
    const responses = await Promise.all(passwords.map(password => resetWith(token, password)));
    assert.deepEqual(responses.map(res => res.statusCode).sort(), [200, 401]);
    const winningPassword = passwords[responses.findIndex(res => res.statusCode === 200)];
    assert.ok(await bcrypt.compare(winningPassword, state.password));
});

test('expired tokens and expiration during password hashing cannot change the password', async t => {
    const state = recoveryFixture(t);
    const verified = await verifyCode();
    const token = verified.body.data.resetToken;
    const previousPassword = state.password;
    state.passwordResetTokenExpires = new Date(Date.now() - 1);
    assert.equal((await resetWith(token)).statusCode, 401);
    state.passwordResetTokenExpires = new Date(Date.now() + 600000);
    t.mock.method(bcrypt, 'hash', async () => {
        state.passwordResetTokenExpires = new Date(Date.now() - 1); return 'unused-hash';
    });
    assert.equal((await resetWith(token)).statusCode, 401);
    assert.equal(state.password, previousPassword);
});

test('a new OTP request and normal password changes invalidate outstanding reset tokens', async t => {
    const state = recoveryFixture(t);
    const first = (await verifyCode()).body.data.resetToken;
    await AuthModel.updateOTP(account.email, '654321', new Date(Date.now() + 600000));
    assert.equal((await resetWith(first)).statusCode, 401);
    const second = (await verifyCode('654321')).body.data.resetToken;
    await AuthModel.updatePasswordById(account._id, 'changed-through-account-settings');
    assert.equal((await resetWith(second)).statusCode, 401);
    assert.equal(state.password, 'changed-through-account-settings');
});

test('completed recovery still permits normal password login with a session-purpose JWT', async t => {
    const state = recoveryFixture(t);
    const token = (await verifyCode()).body.data.resetToken;
    assert.equal((await resetWith(token)).statusCode, 200);
    t.mock.method(UserModel, 'findByAuthId', async () => ({ name: 'Fixture', email: account.email }));
    t.mock.method(ActivityModel, 'log', async () => {});
    const res = response();
    await login({ body: { email: state.email, password: 'Updated-password' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(verifySessionToken(res.cookies.token.value).sub, state._id);
});

test('magic-link login and first-time password setup issue accepted session tokens', async t => {
    const user = { ...account, password: undefined, passwordSetupRequired: true };
    t.mock.method(AuthModel, 'findByEmail', async () => user);
    t.mock.method(UserModel, 'findByAuthId', async () => ({ name: 'Fixture', email: account.email }));
    t.mock.method(ActivityModel, 'log', async () => {});
    t.mock.method(MagicLinkModel, 'claimToken', async () => ({ email: account.email, authId: account._id, sessionVersion: 0, expiresAt: new Date(Date.now() + 600000) }));
    const magic = response();
    await verifyMagicLink({ query: { token: 'a'.repeat(64) } }, magic);
    assert.equal(magic.body.data.user.passwordSetupRequired, true);
    assert.equal(verifySessionToken(magic.cookies.token.value).sub, account._id);
    t.mock.method(AuthModel, 'updatePasswordById', async () => ({ modifiedCount: 1 }));
    t.mock.method(AuthModel, 'findById', async () => ({ ...user, sessionVersion: 1 }));
    const setup = response();
    await setupPassword({ user, body: { newPassword: 'First-password', confirmPassword: 'First-password' } }, setup);
    assert.equal(setup.body.data.user.passwordSetupRequired, false);
    assert.equal(verifySessionToken(setup.cookies.token.value).sub, account._id);
});

test('public signup cannot query/create accounts, set a cookie or accept a requested role', async t => {
    const lookup = t.mock.method(AuthModel, 'findByEmail', async () => { throw new Error('Unexpected query'); });
    const create = t.mock.method(AuthModel, 'createUser', async () => { throw new Error('Unexpected write'); });
    const profile = t.mock.method(UserModel, 'createUserProfile', async () => { throw new Error('Unexpected write'); });
    for (const body of [undefined, {}, ...['student', 'alumni', 'admin'].map(role => ({ name: 'Outsider', email: 'outsider@example.test', password: 'Unverified-password', role }))]) {
        const res = response(); await signup({ body }, res);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.success, false);
        assert.equal(res.cookies, undefined);
    }
    for (const method of [lookup, create, profile]) assert.equal(method.mock.callCount(), 0);
});

test('five wrong OTP attempts lock the challenge even when the next code is correct', async t => {
    const state = recoveryFixture(t);
    for (let count = 0; count < 5; count++) assert.equal((await verifyCode('000000')).statusCode, 400);
    assert.equal(state.resetOTPAttempts, 5);
    assert.equal((await verifyCode('123456')).statusCode, 400);
    assert.equal(state.passwordResetTokenHash, undefined);
    await AuthModel.updateOTP(account.email, '654321', new Date(Date.now() + 600000));
    assert.equal((await verifyCode('654321')).statusCode, 200);
});

test('password recovery invalidates the old session version and permits a fresh session', async t => {
    const state = recoveryFixture(t);
    const oldClaims = verifySessionToken(signSessionToken(state));
    const token = (await verifyCode()).body.data.resetToken;
    assert.equal((await resetWith(token)).statusCode, 200);
    assert.equal(state.sessionVersion, 1);
    assert.equal(sessionMatches(oldClaims, state), false);
    assert.equal(sessionMatches(verifySessionToken(signSessionToken(state)), state), true);
    const res = response(); let allowed = false;
    t.mock.method(AuthModel, 'findById', async () => ({ ...state }));
    // A token signed against the pre-reset version remains cryptographically valid,
    // but is rejected against the current database account.
    const stale = signSessionToken({ ...state, sessionVersion: 0 });
    await protect({ cookies: { token: stale } }, res, () => { allowed = true; });
    assert.equal(res.statusCode, 401); assert.equal(allowed, false);
});

test('first activation preserves student/alumni roles and rejects missing/admin imported roles', async t => {
    captureLogs(t); deliver = async () => {};
    t.mock.method(AuthModel, 'findByEmail', async () => null);
    const create = t.mock.method(AuthModel, 'createSyncedUser', async data => ({ _id: 'new-member', ...data }));
    t.mock.method(UserModel, 'updateById', async () => true);
    t.mock.method(MagicLinkModel, 'deleteByEmail', async () => {});
    t.mock.method(MagicLinkModel, 'create', async () => {});
    let currentRole;
    t.mock.method(UserModel, 'findByEmail', async () => ({ _id: 'profile', role: currentRole }));
    for (const role of ['student', 'alumni']) {
        currentRole = role;
        const res = response(); await sendMagicLink({ body: { email: account.email, role: 'admin' } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(create.mock.calls.at(-1).arguments[0].role, role);
    }
    const before = create.mock.callCount();
    for (const role of [undefined, '', 'admin', 'unknown']) {
        currentRole = role;
        await sendMagicLink({ body: { email: account.email } }, response());
    }
    assert.equal(create.mock.callCount(), before);
});

test('deletion disables login before profile cleanup and rejects old sessions and magic links', async t => {
    const state = recoveryFixture(t);
    const stale = signSessionToken(state);
    t.mock.method(UserModel, 'findById', async () => ({ _id: 'profile', authId: state._id, email: state.email }));
    t.mock.method(AuthModel, 'findById', async () => ({ ...state }));
    t.mock.method(MagicLinkModel, 'deleteByEmail', async () => assert.ok(state.disabledAt));
    t.mock.method(UserModel, 'deleteByAuthId', async () => assert.ok(state.disabledAt));
    t.mock.method(UserModel, 'deleteById', async () => assert.ok(state.disabledAt));
    const res = response();
    await deleteUser({ params: { id: 'profile' }, user: { _id: 'administrator', role: 'admin' } }, res);
    assert.equal(res.statusCode, 200); assert.ok(state.disabledAt);
    assert.equal(state.password, undefined);
    const loginRes = response(); await login({ body: { email: state.email, password: 'Previous-password' } }, loginRes);
    assert.equal(loginRes.statusCode, 401);
    const guarded = response(); await protect({ cookies: { token: stale } }, guarded, () => assert.fail('Deleted account allowed'));
    assert.equal(guarded.statusCode, 401);
    const create = t.mock.method(MagicLinkModel, 'create', async () => assert.fail('Deleted account emailed'));
    await sendMagicLink({ body: { email: state.email } }, response());
    assert.equal(create.mock.callCount(), 0);
});

test('profile cleanup failure leaves the identity disabled', async t => {
    const state = recoveryFixture(t);
    t.mock.method(UserModel, 'findById', async () => ({ _id: 'profile', authId: state._id }));
    t.mock.method(AuthModel, 'findById', async () => ({ ...state }));
    t.mock.method(MagicLinkModel, 'deleteByEmail', async () => {});
    t.mock.method(UserModel, 'deleteByAuthId', async () => { throw new Error('Cleanup failed'); });
    const res = response(); await deleteUser({ params: { id: 'profile' }, user: { _id: 'administrator' } }, res);
    assert.equal(res.statusCode, 500); assert.ok(state.disabledAt);
    assert.equal(sessionMatches(verifySessionToken(signSessionToken(state)), state), false);
});

test('member directory and profile APIs omit login identity and internal metadata', async t => {
    const profile = { _id: 'profile', authId: account._id, name: 'Member', role: 'alumni', email: account.email,
        studentId: 'PRIVATE-STUDENT-ID', contactNumber: 'PRIVATE-PHONE', internalOnly: 'PRIVATE', searchNameGrams: ['PRIVATE'],
        profilePicturePublicId: 'PRIVATE-ASSET', passwordResetTokenHash: 'PRIVATE-SECRET',
        contactEmail: 'public-contact@example.test', skills: ['JavaScript'],
        education: [{ school: 'CLSU', privateNote: 'PRIVATE' }], projects: [{ title: 'Public project', desc: 'Public', privateNote: 'PRIVATE' }] };
    const viewer = { _id: 'someone-else', role: 'student' };
    t.mock.method(UserModel, 'findAll', async () => [profile]);
    t.mock.method(UserModel, 'findById', async () => profile);
    t.mock.method(AuthModel, 'findById', async () => account);
    for (const handler of [getUsers, getUserById]) {
        const res = response(); await handler({ user: viewer, query: {}, params: { id: 'profile' } }, res);
        assert.equal(res.statusCode, 200);
        const value = Array.isArray(res.body.data) ? res.body.data[0] : res.body.data;
        for (const field of ['email', 'studentId', 'contactNumber', 'internalOnly', 'searchNameGrams', 'profilePicturePublicId', 'passwordResetTokenHash']) {
            assert.equal(Object.hasOwn(value, field), false);
        }
    }
    const owner = visibleProfile(profile, { _id: account._id }, { detail: true });
    assert.equal(owner.email, account.email);
    assert.equal(owner.internalOnly, undefined);
    assert.equal(owner.education[0].privateNote, undefined);
    assert.equal(visibleProfile(profile, viewer, { detail: true }).projects[0].privateNote, undefined);
    assert.equal(visibleProfile(profile, viewer, { detail: true }).contactEmail, profile.contactEmail);
});

test('an administrator cannot delete their own account', async t => {
    const state = recoveryFixture(t);
    t.mock.method(UserModel, 'findById', async () => ({ _id: 'profile', authId: state._id }));
    t.mock.method(AuthModel, 'findById', async () => ({ ...state }));
    const res = response(); await deleteUser({ params: { id: 'profile' }, user: { _id: state._id, role: 'admin' } }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(state.disabledAt, undefined);
});

test('later imports cannot recreate a disabled account profile', async t => {
    t.mock.method(AuthModel, 'findByEmail', async () => ({ ...account, disabledAt: new Date() }));
    const create = t.mock.method(UserModel, 'createUserProfile', async () => assert.fail('Disabled identity restored'));
    const update = t.mock.method(UserModel, 'updateById', async () => assert.fail('Disabled identity updated'));
    const res = response();
    await syncUsers({ body: { users: [{ name: 'Member', email: account.email, role: 'student' }] } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.skipped[0].reason, 'Account is disabled');
    assert.equal(create.mock.callCount(), 0); assert.equal(update.mock.callCount(), 0);
});
