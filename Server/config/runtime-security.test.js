import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionSecurity } from './runtime-security.js';

test('production cannot boot with a short signing key or unsafe frontend origin', () => {
  const valid = { NODE_ENV: 'production', JWT_SECRET: 'fixture-only-long-signing-key-12345678', FRONTEND_URL: 'https://frontend.example.test' };
  assert.doesNotThrow(() => validateProductionSecurity(valid));
  for (const JWT_SECRET of [undefined, '', 'short']) assert.throws(() => validateProductionSecurity({ ...valid, JWT_SECRET }), /JWT_SECRET/);
  for (const FRONTEND_URL of [undefined, 'invalid', 'http://frontend.example.test', 'https://user:password@frontend.example.test',
    'https://frontend.example.test/login', 'https://frontend.example.test?token=secret', 'https://frontend.example.test#token']) {
    assert.throws(() => validateProductionSecurity({ ...valid, FRONTEND_URL }), /FRONTEND_URL/);
  }
  assert.doesNotThrow(() => validateProductionSecurity({ NODE_ENV: 'development' }));
});
