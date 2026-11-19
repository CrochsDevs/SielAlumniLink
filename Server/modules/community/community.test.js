import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, ruleSignals, restrictionError, validateSettings, blockedFeatures } from './community.policy.js';
import { createModerationProvider } from './community.provider.js';

test('rules preserve ordinary, joking and educational conversations; multiple signals or activity are required', () => {
  for (const text of ['Welcome to our alumni homecoming!', 'That joke killed me 😂', 'Our seminar discusses violence prevention and phishing awareness.', 'I hate how slow my laptop is.']) {
    assert.deepEqual(ruleSignals(text, 1, 1, DEFAULT_SETTINGS), []);
  }
  assert.deepEqual(ruleSignals('Thanks!', 10, 10, DEFAULT_SETTINGS), []);
  assert.equal(ruleSignals('Read https://example.test/events', 3, 3, DEFAULT_SETTINGS)[0].category, 'spam');
  assert.equal(ruleSignals('Verify your password at https://user@192.0.2.1/login', 1, 1, DEFAULT_SETTINGS)[0].category, 'phishing');
  assert.equal(ruleSignals('Guaranteed profit, send a deposit https://example.test/invest', 1, 1, DEFAULT_SETTINGS)[0].severity, 'medium');
  assert.equal(ruleSignals('I will shoot you tomorrow at your house', 1, 1, DEFAULT_SETTINGS)[0].severity, 'medium');
  const configured = { ...DEFAULT_SETTINGS, maliciousHosts: ['malicious.example'] };
  assert.equal(ruleSignals('https://login.malicious.example', 1, 1, configured)[0].severity, 'high');
  assert.equal(ruleSignals('https://notmalicious.example', 1, 1, configured).length, 0);
});
test('restriction features distinguish warnings, posting, messaging, incoming delivery, and suspension', () => {
  assert.deepEqual(blockedFeatures(1), []);
  assert.equal(blockedFeatures(2).includes('messaging'), false);
  assert.equal(blockedFeatures(3).includes('receiving_messages'), false);
  assert.equal(blockedFeatures(4).includes('receiving_messages'), true);
  assert.equal(blockedFeatures(5).includes('social'), true);
  const restriction = { _id: 'one', caseId: 'two', level: 3, reason: 'Repeated spam', startsAt: new Date(), expiresAt: new Date('2030-01-01') };
  const error = restrictionError([restriction], 'messaging');
  assert.equal(error.status, 403); assert.equal(error.code, 'COMMUNITY_RESTRICTED'); assert.equal(error.appealUrl, '/community-status');
  assert.equal(restrictionError([restriction], 'receiving_messages'), null);
});
test('settings reject malformed thresholds, infinite durations, unsupported categories, and client-controlled identity', () => {
  for (const patch of [{ reviewThreshold: NaN }, { enabledCategories: ['made_up'] }, { maliciousHosts: ['http://example.test'] }, { durations: [1, 3, 7, 14, Infinity] }, { strikeLevels: [1, 2, 3, 4, 5] }, { automaticBlocking: 'true' }, { role: 'admin' }]) assert.throws(() => validateSettings(patch), { status: 400 });
  assert.deepEqual(validateSettings({ appealsEnabled: true }), { appealsEnabled: true });
});
test('provider sends authenticated text/image requests, maps scores, caches briefly, and discloses missing credentials', async () => {
  let requests = 0;
  const provider = createModerationProvider({ key: 'test-key', fetcher: async (url, options) => {
    requests++; assert.equal(url, 'https://api.openai.com/v1/moderations'); assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body); assert.equal(body.model, 'omni-moderation-latest'); assert.equal(body.input.length, 2);
    return { ok: true, json: async () => ({ model: 'tested-model', results: [{ categories: { 'harassment/threatening': true, violence: false }, category_scores: { 'harassment/threatening': 0.999, violence: 0.9 } }] }) };
  } });
  const input = { text: 'Provider protocol fixture', images: ['data:image/png;base64,aGVsbG8='], hash: 'fixture' };
  const result = await provider.analyze(input); assert.equal(result.signals[0].category, 'violence'); assert.equal(result.signals.length, 1);
  await provider.analyze(input); assert.equal(requests, 1); assert.ok(provider.status().lastSuccessAt);
  const absent = createModerationProvider({ key: '' }); assert.equal((await absent.analyze(input)).reason, 'not_configured');
});
test('provider outages, timeouts, malformed responses, and authorization errors never invent AI violations', async () => {
  for (const fetcher of [async () => { throw new Error('Timed out'); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => ({}) })]) {
    const provider = createModerationProvider({ key: 'fixture', fetcher });
    const result = await provider.analyze({ text: 'Ordinary announcement', hash: 'key' });
    assert.equal(result.available, false); assert.deepEqual(result.signals, []); assert.ok(provider.status().lastFailureAt);
  }
});
