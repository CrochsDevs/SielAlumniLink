import test from 'node:test';
import assert from 'node:assert/strict';
import { frontendOrigin } from './frontend-origin.js';

const deployed = 'https://sielalumnilink.onrender.com';
test('local development uses localhost even with a production URL in .env', () => {
  assert.equal(frontendOrigin({ FRONTEND_URL: deployed }), 'http://localhost:5173');
  assert.equal(frontendOrigin({ NODE_ENV: 'development', FRONTEND_URL: deployed }, 'http://localhost:5174'), 'http://localhost:5174');
  assert.equal(frontendOrigin({ LOCAL_FRONTEND_URL: 'http://127.0.0.1:5175', FRONTEND_URL: deployed }), 'http://127.0.0.1:5175');
});

test('Render and production always use the configured production URL', () => {
  for (const env of [{ NODE_ENV: 'production' }, { RENDER: 'true' }]) {
    assert.equal(frontendOrigin({ ...env, FRONTEND_URL: deployed }, 'http://localhost:5173'), deployed);
    assert.equal(frontendOrigin({ ...env, FRONTEND_URL: deployed }, 'https://attacker.example'), deployed);
    for (const FRONTEND_URL of [undefined, 'http://localhost:5173', 'https://localhost', 'https://user:password@example.test', `${deployed}/login`]) {
      assert.throws(() => frontendOrigin({ ...env, FRONTEND_URL }));
    }
  }
});

test('untrusted request origins cannot receive links containing sign-in tokens', () => {
  for (const origin of ['https://attacker.example', 'http://localhost.attacker.example:5173', 'http://localhost:9999', 'null', undefined]) {
    assert.equal(frontendOrigin({ FRONTEND_URL: deployed }, origin), 'http://localhost:5173');
  }
});
