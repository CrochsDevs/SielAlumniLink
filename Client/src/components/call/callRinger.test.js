import test from 'node:test';
import assert from 'node:assert/strict';
import { createCallRinger } from './callRinger.js';

function fixture(state = 'running') {
  const oscillators = [];
  const callbacks = [];
  const cancelled = [];
  const context = {
    state, currentTime: 0, destination: {},
    createOscillator() {
      const oscillator = { frequency: {}, connect() {}, start() {},
        stop() { this.stopped = true; }, disconnect() { this.disconnected = true; } };
      oscillators.push(oscillator);
      return oscillator;
    },
    createGain: () => ({ gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }),
    async resume() { context.state = 'running'; },
    async close() { context.state = 'closed'; },
  };
  const ringer = createCallRinger({ createContext: () => context,
    repeat: callback => { callbacks.push(callback); return callbacks.length; },
    cancelRepeat: id => cancelled.push(id) });
  return { ringer, context, oscillators, callbacks, cancelled };
}

test('incoming calls play a repeating two-part ringtone', () => {
  const f = fixture();
  f.ringer.start('incoming');
  assert.deepEqual(f.oscillators.map(voice => voice.frequency.value), [660, 880, 660, 880]);
  f.context.currentTime = 3;
  f.callbacks[0]();
  assert.equal(f.oscillators.length, 8);
  f.ringer.destroy();
});

test('outgoing ringback stops immediately and cannot restart from a stale interval', () => {
  const f = fixture();
  f.ringer.start('outgoing');
  assert.deepEqual(f.oscillators.map(voice => voice.frequency.value), [440, 480]);
  f.ringer.stop();
  assert.ok(f.oscillators.every(voice => voice.stopped && voice.disconnected));
  assert.deepEqual(f.cancelled, [1]);
  f.context.currentTime = 3;
  f.callbacks[0]();
  assert.equal(f.oscillators.length, 2);
});

test('unlocking while idle stays silent, and disposal closes the audio context', () => {
  const f = fixture();
  f.ringer.unlock();
  assert.equal(f.oscillators.length, 0);
  f.ringer.destroy();
  assert.equal(f.context.state, 'closed');
  f.ringer.start('incoming');
  assert.equal(f.oscillators.length, 0);
});

test('a delayed browser audio resume cannot play after a call ends', async () => {
  const f = fixture('suspended');
  f.ringer.start('incoming');
  f.ringer.stop();
  await Promise.resolve();
  assert.equal(f.oscillators.length, 0);
  f.ringer.destroy();
});
