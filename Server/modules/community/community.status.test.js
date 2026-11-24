import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommunityService } from './community.service.js';

test('account status reads independent collections concurrently and keeps private fields out', async () => {
  const started = [];
  const release = [];
  const records = {
    community_restrictions: [{ _id: 'restriction', level: 2 }],
    feed_post_reports: [{ _id: 'report', reason: 'Spam' }],
    community_cases: [{ _id: 'case', category: 'spam', reporterId: 'private', history: [{ action: 'confirmed', by: 'private' }] }],
    community_appeals: [{ _id: 'appeal', status: 'pending' }],
    community_settings: { value: { appealsEnabled: false } },
  };
  const read = name => {
    started.push(name);
    return new Promise(resolve => release.push(() => resolve(records[name])));
  };
  const cursor = name => ({ sort() { return this; }, limit() { return this; }, toArray() { return read(name); } });
  const service = createCommunityService({ collection(name) {
    return { aggregate: () => cursor(name), find: () => cursor(name), findOne: () => read(name) };
  } }, { provider: { status: () => ({}) } });
  const pending = service.ownStatus({ _id: 'member' });
  assert.equal(started.length, 5, 'all reads start before any response is released');
  release.forEach(done => done());
  const result = await pending;
  assert.equal(result.appealsEnabled, false);
  assert.equal(result.restrictions[0].level, 2);
  assert.equal(result.reports[0]._id, 'report');
  assert.equal(result.appeals[0]._id, 'appeal');
  assert.equal(result.cases[0].reporterId, undefined);
  assert.equal(result.cases[0].history[0].by, undefined);
});
