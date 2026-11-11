import test from 'node:test';
import assert from 'node:assert/strict';
import { Collection } from 'mongodb';
import MagicLinkModel from './magic.models.js';
import { resetTokenHash } from '../auth/password-reset.js';

test('magic-link storage contains only a hash; expired, reused, and legacy raw tokens cannot authenticate', async t => {
  const token = 'a'.repeat(64), hash = resetTokenHash(token);
  let state;
  t.mock.method(Collection.prototype, 'insertOne', async doc => {
    state = { ...doc, _id: 'fixture' }; return { insertedId: state._id };
  });
  t.mock.method(Collection.prototype, 'findOneAndUpdate', async (filter, update) => {
    assert.equal(filter.tokenHash, hash);
    assert.equal(filter.token, undefined);
    if (state.tokenHash !== filter.tokenHash || state.usedAt != null || state.expiresAt <= filter.expiresAt.$gt) return null;
    Object.assign(state, update.$set); return { ...state };
  });
  await MagicLinkModel.create({ email: 'fixture@example.test', token, expiresAt: new Date(Date.now() + 60000), usedAt: null });
  assert.equal(state.token, undefined);
  assert.equal(state.tokenHash, hash);
  assert.ok(await MagicLinkModel.claimToken(token));
  assert.equal(await MagicLinkModel.claimToken(token), null);
  state.usedAt = null; state.expiresAt = new Date(Date.now() - 1);
  assert.equal(await MagicLinkModel.claimToken(token), null);
  state = { token, usedAt: null, expiresAt: new Date(Date.now() + 60000) };
  assert.equal(await MagicLinkModel.claimToken(token), null);
  assert.equal(await MagicLinkModel.claimToken({ $ne: null }), null);
  await assert.rejects(MagicLinkModel.create({ token: { $ne: null } }), /Invalid login credential/);
});
