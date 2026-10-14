import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9234.
const artifacts = path.join(os.tmpdir(), 'SielAlumni-student-dashboard-check');
await mkdir(artifacts, { recursive: true });
const target = await (await fetch('http://localhost:9234/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const waiting = new Map();
const listeners = new Map();
const runtimeErrors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timeout = setTimeout(() => { waiting.delete(id); reject(new Error(`Timeout: ${method}`)); }, 15000);
  waiting.set(id, { resolve, reject, timeout });
  socket.send(JSON.stringify({ id, method, params }));
});
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const request = waiting.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout); waiting.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  } else listeners.get(message.method)?.(message.params);
};
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const until = async expression => {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`UI wait failed: ${expression}`);
};

const student = { _id: '111111111111111111111111', authId: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Alex Santos', email: 'student@example.test', role: 'student', program: 'BS IT', passwordSetupRequired: false };
const author = { _id: '222222222222222222222222', authId: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Jamie Reyes', email: 'mentor@example.test', role: 'alumni' };
const job = { _id: '333333333333333333333333', title: 'Junior software engineer', company: 'Campus Labs', description: 'Build useful software.', type: 'Full-time', location: 'Manila', isActive: true, createdAt: new Date().toISOString() };
const referral = { _id: '444444444444444444444444', title: 'Research assistant referral', organization: 'Research Labs', type: 'internship', description: 'Learn data analysis.', authorAuthId: author.authId, isActive: true, createdAt: new Date().toISOString() };
let activity = { _id: '555555555555555555555555', title: 'University career webinar', description: 'Meet alumni and plan your career.', deliveryMode: 'online', location: 'Online', startAt: new Date(Date.now() + 86400000).toISOString(), registrationWindow: { state: 'open' }, isActive: true, createdAt: new Date().toISOString() };
let posts = ['update', 'hiring', 'referral', 'event', 'story'].map((type, index) => ({
  _id: String(index + 6).padStart(24, '0'), type, title: ['Campus update', 'Alumni hiring opportunity', 'Alumni referral post', 'Alumni networking event', 'My career success story'][index], body: type === 'story' ? 'Career journey\nI learned through practice.\n\nAdvice for students\nBuild projects.' : 'Community news and opportunities.',
  author, createdAt: new Date().toISOString(), audience: 'public', likesCount: 0, commentsCount: 0, sharesCount: 0, attendingCount: 0, likedByMe: false, attendingByMe: false,
  details: type === 'hiring' ? { organization: 'Alumni Labs', link: 'https://example.test/apply' } : type === 'event' ? { startAt: activity.startAt, location: 'Campus Hall' } : {}, images: [],
}));
let jobApplications = [], referralApplications = [], comments = [], failJobs = true, failLike = true, failComment = true, failMore = true;
let jobSaves = 0, referralSaves = 0, registrations = 0, sends = 0;
const queries = [];
listeners.set('Runtime.exceptionThrown', ({ exceptionDetails }) => runtimeErrors.push(exceptionDetails.exception?.description || exceptionDetails.text));
listeners.set('Fetch.requestPaused', async ({ requestId, request }) => {
  try {
    const url = new URL(request.url), route = url.pathname.replace('/api', '');
    let data = [], responseCode = 200, message = '';
    const input = request.postData && request.headers['Content-Type']?.includes('application/json') ? JSON.parse(request.postData) : {};
    const id = route.split('/')[2], post = posts.find(item => item._id === id);
    if (request.method !== 'OPTIONS') {
      if (route === '/auth/me' || route === '/users/me') data = student;
      else if (route === '/development/me') data = { portfolio: { skills: ['JavaScript'], projects: ['Project'] }, internships: [{ hoursCompleted: '80', requiredHours: '300' }], mentorCount: 1 };
      else if (route === '/notifications/unread-count') data = { count: 0 };
      else if (route === '/jobs') { if (failJobs) { responseCode = 503; message = 'Jobs unavailable'; } else data = [job]; }
      else if (route === `/jobs/${job._id}`) data = job;
      else if (route === '/jobs/applications/me') data = jobApplications;
      else if (route === `/jobs/${job._id}/apply`) { jobSaves++; data = { _id: 'job-application', jobId: job._id, status: 'pending', createdAt: new Date().toISOString() }; jobApplications = [data]; }
      else if (route === '/referrals') data = [referral];
      else if (route === '/referrals/applications/me') data = referralApplications;
      else if (route === `/referrals/${referral._id}/apply`) { await new Promise(resolve => setTimeout(resolve, 120)); referralSaves++; data = { _id: 'referral-application', referralId: referral._id, status: 'pending', createdAt: new Date().toISOString() }; referralApplications = [data]; }
      else if (route === '/events') data = [activity];
      else if (route === `/events/${activity._id}/register`) { registrations++; activity = { ...activity, registration: { _id: 'registration-reference', name: student.name }, meetingAccess: { state: 'open' } }; data = activity.registration; }
      else if (route === `/events/${activity._id}`) data = activity;
      else if (route === '/feed/status') data = { restricted: false };
      else if (route === '/feed/stories') data = { posts: posts.filter(item => item.type === 'story'), nextCursor: null };
      else if (route === '/conversations' && request.method === 'POST') data = { _id: 'conversation-id', authId: author.authId, name: author.name, email: author.email, role: 'alumni', unread: 0 };
      else if (route === '/feed') {
        const type = url.searchParams.get('type') || 'all', q = url.searchParams.get('q') || '', before = url.searchParams.get('before');
        queries.push({ type, q, before });
        if (before && failMore) { failMore = false; responseCode = 503; }
        else {
          const rows = posts.filter(item => (type === 'all' || item.type === type) && `${item.title} ${item.body}`.toLowerCase().includes(q.toLowerCase()));
          const start = before ? Number(before) : 0;
          data = { posts: rows.slice(start, start + 2), nextCursor: rows.length > start + 2 ? String(start + 2) : null };
        }
      } else if (route.endsWith('/like')) {
        if (failLike) { failLike = false; responseCode = 503; message = 'Like interrupted'; }
        else { Object.assign(post, { likedByMe: input.liked, likesCount: input.liked ? 1 : 0 }); data = post; }
      } else if (route.endsWith('/rsvp')) { Object.assign(post, { attendingByMe: input.attending, attendingCount: input.attending ? 1 : 0 }); data = post; }
      else if (route.endsWith('/comments') && request.method === 'POST') {
        if (failComment) { failComment = false; responseCode = 503; message = 'Comment interrupted'; }
        else { const comment = { _id: 'comment-id', body: input.body, author: student, isMine: true, createdAt: new Date().toISOString() }; comments = [comment]; post.commentsCount = 1; data = comment; }
      } else if (route.endsWith('/comments')) data = { comments, nextCursor: null };
      else if (route.includes('/comments/') && request.method === 'DELETE') { comments = []; post.commentsCount = 0; }
      else if (route.endsWith('/recipients')) data = [author];
      else if (route.endsWith('/send')) { sends++; data = { recipientEmail: author.email, conversationId: 'conversation-id' }; }
      else if (route.startsWith('/feed/')) {
        if (post) data = post;
        else { responseCode = 404; message = 'Post not available to you'; }
      }
    }
    await send('Fetch.fulfillRequest', { requestId, responseCode, responseHeaders: [
      { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://localhost:5173' }, { name: 'Access-Control-Allow-Credentials', value: 'true' },
      { name: 'Access-Control-Allow-Methods', value: 'GET,PUT,POST,DELETE,OPTIONS' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type' },
    ], body: Buffer.from(JSON.stringify({ success: responseCode === 200, data, message })).toString('base64') });
  } catch (error) { runtimeErrors.push(error.message); await send('Fetch.failRequest', { requestId, errorReason: 'Failed' }); }
});
const click = (text, scope = 'document') => evaluate(`Array.from(${scope}.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(text)}).click()`);
const fill = (selector, value) => evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const close = () => evaluate(`document.querySelector('dialog button[aria-label="Close dialog"]').click()`);
const photo = async (name, width, dark) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
  await evaluate(`document.documentElement.classList.toggle('dark', ${dark})`);
  await evaluate('window.scrollTo(0, 0)');
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= ${width + 1}`), true, name + ' overflow');
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(path.join(artifacts, name + '.png'), Buffer.from(shot.data, 'base64'));
};
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3002/api/*' }] });
  await send('Page.navigate', { url: 'http://localhost:5173/student' });
  await until(`document.querySelectorAll('article[id^="post-"]').length === 2`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-dashboard-listing]').length`), 0);
  assert.equal(await evaluate(`document.body.textContent.includes('Latest opportunities & activities')`), false);
  assert.ok(await evaluate(`document.body.textContent.includes('80 / 300')`));
  await photo('dashboard-all-desktop', 1440, false);
  await click('Load more posts'); await until(`document.body.textContent.includes('Unable to load more posts')`); await click('Load more posts');
  await until(`document.querySelectorAll('article[id^="post-"]').length === 4`); await click('Load more posts');
  await until(`document.querySelectorAll('article[id^="post-"]').length === 5`);
  await click('Hiring'); await until(`document.querySelectorAll('article[id^="post-"]').length === 1 && document.body.textContent.includes('Unable to load jobs')`);
  failJobs = false; await click('Retry listings'); await until(`document.querySelector('[data-dashboard-listing="jobs"]')`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-dashboard-listing="referrals"], [data-dashboard-listing="events"]').length`), 0);
  assert.equal(await evaluate(`document.querySelector('a[href="https://example.test/apply"]').target`), '_blank');
  await click('View details & apply'); await until(`document.body.textContent.includes('Ready to apply?')`); await click('Apply now');
  await evaluate(`(() => { const input = document.querySelector('[aria-label="Choose PDF resume"]'); const transfer = new DataTransfer(); transfer.items.add(new File(['%PDF-1.4', String.fromCharCode(10), '%%EOF'], 'resume.pdf', {type:'application/pdf'})); input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  await click('Submit application'); await until(`document.body.textContent.includes('You have taken the next step.')`); assert.equal(jobSaves, 1);
  await click('Back to opportunities'); await until(`document.body.textContent.includes('Application: pending')`);
  await click('Referrals'); await until(`document.querySelector('article[data-dashboard-listing="referrals"]') && document.querySelectorAll('article[id^="post-"]').length === 1`);
  await click('View details & apply'); await click('Apply directly'); await fill('[aria-label="Application note"]', 'Interested in research.');
  await evaluate(`(() => { const button = document.querySelector('dialog button[type="submit"]'); button.click(); button.click(); })()`);
  await until(`document.body.textContent.includes('Your next step is underway.')`); assert.equal(referralSaves, 1); await click('Done');
  await click('Events'); await until(`document.querySelector('[data-dashboard-listing="events"]') && document.querySelectorAll('article[id^="post-"]').length === 1`);
  await click('Register'); await until(`document.querySelector('a[href="/meetings/${activity._id}"]')`); assert.equal(registrations, 1);
  await click('Attend event'); await until(`document.body.textContent.includes('Cancel RSVP')`); await click('Cancel RSVP'); await until(`document.body.textContent.includes('Attend event')`);
  await click('Success stories'); await until(`document.body.textContent.includes('My career success story')`);
  assert.ok(await evaluate(`Boolean(document.querySelector('a[href="/stories?story=${posts[4]._id}"]'))`));
  await evaluate(`document.querySelector('a[href="/stories?story=${posts[4]._id}"]').click()`);
  await until(`document.querySelector('dialog')?.textContent.includes('Advice for students')`);
  await send('Page.navigate', { url: 'http://localhost:5173/student?tab=story' });
  await until(`document.body.textContent.includes('My career success story')`);
  await fill('input[type="search"][placeholder^="Search updates"]', 'nonexistent'); await until(`document.body.textContent.includes('No posts match your search')`);
  await click('Clear search'); await until(`document.body.textContent.includes('My career success story')`);
  await click('All updates'); await until(`document.querySelectorAll('article[id^="post-"]').length === 2`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-dashboard-listing]').length`), 0);
  const postScope = `document.querySelector('#post-${posts[0]._id}')`;
  await click('Like', postScope); await until(`document.body.textContent.includes('Like interrupted')`); await click('Like', postScope); await until(`${postScope}.textContent.includes('Liked')`);
  await click('Comment', postScope); await fill('[aria-label="Write a comment"]', 'Thanks for sharing!'); await click('Post', postScope); await until(`document.body.textContent.includes('Comment interrupted')`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Write a comment"]').value`), 'Thanks for sharing!');
  await click('Post', postScope); await until(`document.querySelector('[aria-label="Delete comment"]')`); await evaluate(`document.querySelector('[aria-label="Delete comment"]').click()`); await until(`!document.querySelector('[aria-label="Delete comment"]')`);
  await click('Share', postScope); await until(`document.querySelector('[aria-label="Post link"]')`); await click('Copy link'); await until(`document.body.textContent.includes('Link copied.') || document.body.textContent.includes('copy it manually')`);
  await evaluate(`document.querySelector('dialog button[aria-label]').click()`);
  await click('Send', postScope); await until(`document.querySelector('dialog')?.textContent.includes('Jamie Reyes')`);
  await click('Send', 'document.querySelector("dialog")'); await until(`!document.querySelector('dialog')`); assert.equal(sends, 1);
  await until(`document.querySelector('[aria-label="Close chat"]')`); await evaluate(`document.querySelector('[aria-label="Close chat"]').click()`);
  await photo('dashboard-mobile-dark', 390, true); await photo('dashboard-small-mobile', 320, false);
  await click('Hiring'); await until(`document.querySelectorAll('article[id^="post-"]').length === 1`); await send('Page.reload'); await until(`document.querySelector('button[aria-pressed="true"]')?.textContent === 'Hiring'`);
  await until(`document.body.textContent.includes('View application')`);
  await send('Page.navigate', { url: 'http://localhost:5173/student?post=ffffffffffffffffffffffff' }); await until(`document.body.textContent.includes('Post not available to you')`);
  assert.equal(await evaluate(`document.querySelectorAll('article[id^="post-"]').length`), 0);
  assert.deepEqual(runtimeErrors, []);
  console.log('Passed: five tabs, independent module recovery, real application dialogs, duplicate guard, registration and RSVP, feed search/pagination, likes/comments error recovery, delete comment, sharing, persisted tabs/applications, private deep-link denial, progress totals, and desktop/mobile layouts. API fixtures only. Screenshots: ' + artifacts);
} catch (error) { console.error(await evaluate('document.body.innerText'), runtimeErrors); throw error; }
finally { await send('Browser.close').catch(() => {}); socket.close(); }

