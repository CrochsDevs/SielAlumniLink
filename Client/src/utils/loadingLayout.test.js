import test from 'node:test';
import assert from 'node:assert/strict';
import { loadingLayout } from './loadingLayout.js';

test('all role dashboards use dashboard placeholders', () => {
  for (const role of ['admin', 'student', 'alumni']) assert.equal(loadingLayout(`/${role}/`), 'dashboard');
});

test('page placeholders match the destination across roles', () => {
  for (const role of ['admin', 'student', 'alumni']) {
    assert.equal(loadingLayout(`/${role}/events`), 'calendar');
    assert.equal(loadingLayout(`/${role}/message`), 'messages');
    assert.equal(loadingLayout(`/${role}/settings`), 'form');
  }
  assert.equal(loadingLayout('/admin/users'), 'table');
  assert.equal(loadingLayout('/student/portfolio'), 'form');
  assert.equal(loadingLayout('/alumni/profile'), 'profile');
  assert.equal(loadingLayout('/community-status'), 'list');
  assert.equal(loadingLayout('/feed'), 'feed');
});
