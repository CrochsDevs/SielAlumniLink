import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeetingJoinSound } from './meetingJoinSound.js';

function fixture() {
  const voices = [];
  const contexts = [];
  const chime = createMeetingJoinSound({ createContext: () => {
    const context = {
      state: 'suspended', currentTime: 10, destination: {},
      async resume() { this.state = 'running'; },
      async close() { this.state = 'closed'; },
      createOscillator() {
        const voice = { frequency: {}, connect() {}, disconnect() { this.disconnected = true; }, start(time) { this.startAt = time; }, stop(time) { this.stopAt = time; } };
        voices.push(voice);
        return voice;
      },
      createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; },
    };
    contexts.push(context);
    return context;
  } });
  return { chime, voices, contexts };
}

test('joining unlocks audio silently; arrivals play a short two-note chime', () => {
  const { chime, voices, contexts } = fixture();
  chime.play();
  assert.equal(contexts.length, 0);
  chime.unlock();
  assert.equal(voices.length, 0);
  chime.play();
  assert.deepEqual(voices.map(voice => voice.frequency.value), [660, 880]);
  assert.equal(voices[0].startAt, 10);
  assert.equal(voices[1].startAt, 10.16);
  assert.ok(voices.every(voice => voice.stopAt - voice.startAt < 0.22));
  voices.forEach(voice => voice.onended());
  assert.ok(voices.every(voice => voice.disconnected));
  chime.destroy();
});

test('leaving stops pending tones and disposal allows a fresh join later', () => {
  const { chime, voices, contexts } = fixture();
  chime.unlock(); chime.play(); chime.destroy();
  assert.equal(contexts[0].state, 'closed');
  assert.ok(voices.every(voice => voice.disconnected && voice.onended === null));
  chime.play();
  assert.equal(voices.length, 2);
  chime.unlock(); chime.play();
  assert.equal(contexts.length, 2);
  assert.equal(voices.length, 4);
  chime.destroy();
});

test('blocked browser audio never breaks meeting actions or replays delayed notifications', async () => {
  const chime = createMeetingJoinSound({ createContext: () => { throw new Error('Audio unavailable'); } });
  assert.doesNotThrow(() => { chime.unlock(); chime.play(); chime.destroy(); });
  let resolveResume;
  let tones = 0;
  const delayed = createMeetingJoinSound({ createContext: () => ({ state: 'suspended', resume: () => new Promise(resolve => { resolveResume = resolve; }), close: async () => {}, createOscillator: () => { tones++; } }) });
  delayed.unlock(); delayed.play(); delayed.destroy(); resolveResume();
  await Promise.resolve();
  assert.equal(tones, 0);
});
