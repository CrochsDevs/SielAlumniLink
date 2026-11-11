import test from 'node:test';
import assert from 'node:assert/strict';
import { protectApiResponses } from './api-response-security.js';

test('all API server failures remove internal messages and data, preserving expected validation responses', () => {
  for (const statusCode of [200, 400, 401, 403, 429, 500, 502, 503]) {
    const res = { statusCode, setHeader(name, value) { this.cache = value; }, json(value) { this.body = value; return this; } };
    let next = false;
    protectApiResponses({}, res, () => { next = true; });
    const body = { success: false, message: 'PRIVATE_PROVIDER_ERROR', data: { token: 'PRIVATE_TOKEN' } };
    res.json(body);
    assert.equal(next, true);
    assert.equal(res.cache, 'private, no-store');
    if (statusCode >= 500) assert.doesNotMatch(JSON.stringify(res.body), /PRIVATE_/);
    else assert.deepEqual(res.body, body);
  }
});
