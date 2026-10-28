import test from 'node:test';
import assert from 'node:assert/strict';
process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/auth_limits_fixture';
process.env.JWT_SECRET ||= 'test-only-auth-limit-secret';
const { createAuthLimiter, ensureAuthSecurityIndexes } = await import('./auth-limits.js');
const { allowedSocketOrigin, frontendOrigins } = await import('../../config/cors.js');

const response = () => ({ code: 200, headers: {}, status(code) { this.code = code; return this; },
    json(body) { this.body = body; }, setHeader(key, value) { this.headers[key] = value; } });
function fixture() {
    const counters = new Map();
    const db = { collection() { return { async findOneAndUpdate(filter, update) {
        const record = counters.get(filter._id) || { _id: filter._id, ...update.$setOnInsert, count: 0 };
        record.count++; counters.set(filter._id, record); return { ...record };
    } }; } };
    return { db, counters };
}
const attempt = async (limiter, email = 'person@example.test', ip = '127.0.0.1') => {
    const res = response(); let allowed = false;
    await limiter({ body: { email }, ip }, res, () => { allowed = true; });
    return { res, allowed };
};

test('two server instances share atomic account limits, including concurrent requests', async () => {
    const { db, counters } = fixture();
    const first = createAuthLimiter('login', db, () => 1000), second = createAuthLimiter('login', db, () => 1000);
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) => attempt(index % 2 ? first : second)));
    assert.equal(results.filter(result => result.allowed).length, 10);
    assert.equal(results.filter(result => result.res.code === 429).length, 10);
    assert.ok(results.find(result => result.res.code === 429).res.headers['Retry-After']);
    assert.equal(JSON.stringify([...counters.values()]).includes('person@example.test'), false);
});

test('email resend limits follow the account across IPs and reset at the next window', async () => {
    const { db } = fixture(); let time = 1000;
    const limiter = createAuthLimiter('send', db, () => time);
    assert.equal((await attempt(limiter, 'PERSON@example.test', '192.0.2.1')).allowed, true);
    assert.equal((await attempt(limiter, 'person@example.test', '192.0.2.2')).res.code, 429);
    time = 61000;
    assert.equal((await attempt(limiter)).allowed, true);
});

test('IP limits apply across different target emails', async () => {
    const { db } = fixture(); const limiter = createAuthLimiter('send', db, () => 1000);
    for (let index = 0; index < 10; index++) assert.equal((await attempt(limiter, `person${index}@example.test`)).allowed, true);
    assert.equal((await attempt(limiter, 'another@example.test')).res.code, 429);
});

test('limiter storage errors fail closed and TTL cleanup is indexed', async () => {
    const broken = { collection() { return { async findOneAndUpdate() { throw new Error('Private database details'); } }; } };
    const result = await attempt(createAuthLimiter('login', broken));
    assert.equal(result.res.code, 503); assert.equal(result.allowed, false);
    assert.equal(JSON.stringify(result.res.body).includes('Private database details'), false);
    let indexed = false;
    await ensureAuthSecurityIndexes({ collection(name) { assert.equal(name, 'auth_rate_limits'); return {
        async createIndex(fields, options) { assert.deepEqual(fields, { expiresAt: 1 }); assert.equal(options.expireAfterSeconds, 0); indexed = true; },
    }; } });
    assert.equal(indexed, true);
});

test('WebSocket Origin policy accepts configured origins and rejects foreign, null and absent origins', () => {
    for (const origin of frontendOrigins) assert.equal(allowedSocketOrigin(origin), true);
    for (const origin of ['https://untrusted.example', frontendOrigins[0] + '.evil.example', 'null', undefined, null, '']) {
        assert.equal(allowedSocketOrigin(origin), false);
    }
});
