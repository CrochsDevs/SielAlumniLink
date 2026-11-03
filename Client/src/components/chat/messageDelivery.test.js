import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeMessageHistory, messageDeliveryLabel } from './messageDelivery.js';

test('delivery labels follow acknowledgement and actual recipient reads', () => {
  assert.equal(messageDeliveryLabel({ pendingId: 'pending' }), 'Sending…');
  assert.equal(messageDeliveryLabel({ _id: 'saved', read: false }), 'Sent');
  assert.equal(messageDeliveryLabel({ _id: 'saved', read: true }), 'Read');
});
test('late history cannot erase receipts, pending sends, or newer socket messages', () => {
  const current = [{ _id: 'one', read: true }, { pendingId: 'pending', text: 'sending' },
    { _id: 'new', at: '2026-10-29T02:00:00Z' }];
  const merged = mergeMessageHistory(current, [{ _id: 'one', read: false, at: '2026-10-29T01:00:00Z' }]);
  assert.equal(merged[0].read, true);
  assert.equal(merged[1].pendingId, 'pending');
  assert.equal(merged[2]._id, 'new');
});
test('server correlation removes only the matching optimistic send', () => {
  const current = [{ pendingId: 'first', text: 'same' }, { pendingId: 'second', text: 'same' }];
  const merged = mergeMessageHistory(current, [{ _id: 'saved', clientMessageId: 'first', text: 'same' }]);
  assert.equal(merged.length, 2);
  assert.equal(merged[1].pendingId, 'second');
});
