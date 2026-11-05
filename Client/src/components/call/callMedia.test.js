import test from 'node:test';
import assert from 'node:assert/strict';
import { attachCallMedia, setCallTrackEnabled, stopCallStream, callMediaError } from './callMedia.js';

test('local and remote media attach even when the element mounts after the stream', () => {
  const stream = {};
  const element = { playCount: 0, play() { this.playCount++; return Promise.resolve(); } };
  attachCallMedia(null, stream);
  attachCallMedia(element, stream);
  assert.equal(element.srcObject, stream);
  assert.equal(element.playCount, 1);
  attachCallMedia(element, null);
  assert.equal(element.srcObject, null);
});

test('microphone and camera controls operate independently on live tracks', () => {
  const audio = { enabled: true, readyState: 'live' };
  const video = { enabled: true, readyState: 'live' };
  const ended = { enabled: true, readyState: 'ended' };
  const stream = { getAudioTracks: () => [audio], getVideoTracks: () => [video, ended] };
  setCallTrackEnabled(stream, 'audio', false);
  assert.equal(audio.enabled, false);
  assert.equal(video.enabled, true);
  setCallTrackEnabled(stream, 'video', false);
  assert.equal(video.enabled, false);
  assert.equal(ended.enabled, true);
  setCallTrackEnabled(stream, 'audio', true);
  setCallTrackEnabled(stream, 'video', true);
  assert.equal(audio.enabled, true);
  assert.equal(video.enabled, true);
  setCallTrackEnabled(null, 'audio', false);
});

test('ending a call stops all microphone and camera tracks', () => {
  const tracks = [0, 1].map(() => ({ stopped: false, stop() { this.stopped = true; } }));
  stopCallStream({ getTracks: () => tracks });
  assert.ok(tracks.every(track => track.stopped));
  stopCallStream(null);
});

test('autoplay restrictions do not crash the call and media errors explain recovery', async () => {
  attachCallMedia({ play: () => Promise.reject(new Error('Autoplay blocked')) }, {});
  await Promise.resolve();
  assert.match(callMediaError({ name: 'NotAllowedError' }), /Allow microphone/);
  assert.match(callMediaError({ name: 'NotFoundError' }), /No microphone/);
  assert.match(callMediaError({ name: 'NotReadableError' }), /another app/);
  assert.match(callMediaError({}), /try again/);
});
