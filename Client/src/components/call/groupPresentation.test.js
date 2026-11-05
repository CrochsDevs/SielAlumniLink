import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPresentation } from './groupPresentation.js';

const base = { self: { id: 'me' }, peers: [], sharing: false, camera: false, mic: true, stream: { id: 'local' } };

test('a voice-call screen share is a presentation even with the camera off', () => {
  const layout = groupPresentation({ ...base, sharing: true }, { name: 'Lester' }, new Map());
  assert.equal(layout.presenter.id, 'me');
  assert.equal(layout.presenter.camera, false);
  assert.equal(layout.presenter.stream, base.stream);
  assert.equal(layout.presenter.local, true);
});

test('remote presentations use received streams and preserve participant identities', () => {
  const received = { id: 'screen-stream' };
  const layout = groupPresentation({ ...base, peers: [{ id: 'peer', name: 'Leanne', sharing: true }] }, {}, new Map([['peer', { stream: received }]]));
  assert.equal(layout.presenter.id, 'peer');
  assert.equal(layout.presenter.stream, received);
  assert.equal(layout.participants.length, 2);
});

test('the view follows the new presenter when the previous share is replaced', () => {
  const peers = [{ id: 'first', sharing: false }, { id: 'second', sharing: true }];
  const next = groupPresentation({ ...base, peers }, {}, new Map());
  assert.equal(next.presenter.id, 'second');
  assert.equal(next.presenters.length, 1);
});

test('stopping presentation returns to the normal participant layout', () => {
  const layout = groupPresentation(base, {}, new Map(), 'me');
  assert.equal(layout.presenter, null);
  assert.deepEqual(layout.presenters, []);
  assert.equal(layout.participants[0].mic, true);
});
