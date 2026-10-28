import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { calculateReadiness } from '../../Server/modules/development/development.policy.js';
import { reportPeriod, summarizeEngagement } from '../../Server/modules/reports/reports.policy.js';
import { employmentReport } from '../../Server/modules/employment/employment.policy.js';
import { buildAlignmentReport } from '../../Server/modules/tracer/tracer.alignment.js';
import assert from 'node:assert/strict';
import { competencySnapshot } from '../../Server/modules/development/competency.policy.js';

// Every API request is fulfilled locally. No real accounts, sessions or records.
const origin = process.env.RESPONSIVE_ORIGIN || 'http://localhost:5173';
const artifacts = path.join(tmpdir(), 'alumnilink-responsive-check');
await mkdir(artifacts, { recursive: true });
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const paths = [...app.matchAll(/path="([^"]+)"/g)].map(match => match[1]);
const routes = [...new Set(paths)].filter(route => !route.includes(':') && !['/', '/logout', '/inbox', '/alumni/journey'].includes(route));
routes.push('/admin/tracer?view=responses', '/admin/tracer?view=employment', '/admin/jobs/job1', '/alumni/career/job1', '/student/career/job1', '/admin/events/event1/attendance', '/alumni/profile/member1', '/student/profile/member1', '/alumni/surveys/survey1', '/alumni/mentorship/student1/evaluation', '/meetings/event1');
if (process.env.RESPONSIVE_ROUTES) routes.splice(0, routes.length, ...process.env.RESPONSIVE_ROUTES.split(','));
const widths = (process.env.RESPONSIVE_WIDTHS || '320,375,768,1024,1440').split(',').map(Number);
const failures = [];
const errors = [];
let checks = 0;
let role = 'student';
let activeRoute;
const profile = () => ({ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', authId: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Alexandra University Alumni Member', email: 'member@example.test', role, program: 'Bachelor of Science in Information Technology', batch: '2025', academicStatus: 'Graduated', skills: [], passwordSetupRequired: activeRoute === '/setup-password' });
const portfolio = { skills: [], projects: [], research: [], certifications: [], seminars: [], awards: [] };
const development = { portfolio, internships: [], events: [], certificates: [], mentorCount: 0, timeline: [], competencies: competencySnapshot({}), readiness: calculateReadiness({ mentorCount: 0, eventCount: 0, portfolio, internships: [] }) };
const rows = Array.from({ length: 23 }, (_, i) => ({ _id: `row${i}`, name: `University Member ${i + 1}`, email: `member${i}@example.test`, title: `University community activity ${i + 1}`, description: 'Career development and alumni networking opportunities.', body: 'University community update.', program: 'Information Technology', role: 'alumni', batch: '2025', status: 'active', date: '2026-11-15', createdAt: '2026-10-01T00:00:00Z', isActive: true, questions: [], type: 'event' }));
const dataFor = (url) => {
  const route = url.pathname.replace(/^\/api/, '');
  if (['/auth/me', '/users/me'].includes(route)) return ['/login', '/signup', '/forgot-password', '/verify-magic-link'].includes(activeRoute) ? null : profile();
  if (route === '/development/me') return development;
  if (route === '/development/mentees/student1/competencies') return { student: { ...profile(), authId: 'student1', role: 'student' }, competencies: competencySnapshot({}), portfolio };
  if (route === '/meetings/event1') return { event: { ...rows[0], title: 'University career webinar', startAt: '2026-11-15T00:00:00Z', endAt: '2026-11-15T02:00:00Z', activityType: 'training', deliveryMode: 'online' }, meeting: null, registration: { status: 'registered' }, capacity: 50, meetingAccess: { state: 'upcoming', canJoin: false } };
  if (route === '/mentorship/matches') return { profile: { skills: [], program: profile().program }, preferences: { interests: [], careerGoals: '' }, matches: [], candidateCount: 0 };
  if (route === '/tracer/alignment') return buildAlignmentReport([], Object.fromEntries(url.searchParams));
  if (route === '/tracer/access') return { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' };
  if (route === '/tracer/me') return null;
  if (route === '/notifications/unread-count') return { count: 0 };
  if (route === '/feed/status') return { canPost: true, canComment: true, canReact: true };
  if (route === '/feed') return { posts: [], nextCursor: null };
  if (route === '/search') return { people: { items: [], total: 0 }, posts: { items: [], total: 0 } };
  if (route === '/users') return [profile(), ...rows];
  if (route.startsWith('/users/')) return profile();
  if (route.startsWith('/connections/members')) return { items: rows.slice(0, 10), total: rows.length, page: 1, pages: 3 };
  if (route.startsWith('/jobs/job1')) return { ...rows[0], title: 'University Software Engineer', company: 'Campus Technology Partner', location: 'Science City of Munoz', type: 'Full-time', requirements: [], application: null };
  if (route === '/events/event1') return { ...rows[0], title: 'University career development event', startAt: '2026-11-15T00:00:00Z', registrationWindow: { state: 'open', opensAt: '2026-10-01T00:00:00Z', closesAt: '2026-11-14T00:00:00Z' } };
  if (route === '/surveys/survey1') return { ...rows[0], title: 'Alumni career development survey', questions: [{ text: 'How can the university support your career?', type: 'text' }] };
  if (route.startsWith('/surveys/me/answers')) return null;
  if (route === '/reports/dashboard') {
    const date = url.searchParams.get('date') || '2026-10-28';
    return { date, timezone: 'Asia/Manila', generatedAt: new Date().toISOString(), members: { students: 10, alumni: 20, total: 30 }, overview: { jobs: 12, applications: 42, pendingApplications: 8, events: 3, surveys: 4, certificates: 120, pendingCertificates: 6, announcements: 5, posts: 93, blockedPosts: 2, unreadMessages: 3, tracerResponses: 15, upcomingEvents: [], recentAnnouncements: [] }, mentorship: { accepted: 6, pending: 3, rejected: 1, total: 10 }, engagement: summarizeEngagement([], reportPeriod(date)) };
  }
  if (route === '/employment/reports') return employmentReport([], Object.fromEntries(url.searchParams));
  if (['/announcements', '/surveys', '/tracer', '/activity'].includes(route)) return rows;
  return [];
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext();
  await context.addInitScript(() => localStorage.setItem('theme', 'light'));
  await context.route('**/socket.io/**', route => route.abort());
  await context.route('**/api/**', route => {
    const request = route.request();
    // Block mutations even if an interaction or redirect unexpectedly requests one.
    if (!['GET', 'OPTIONS'].includes(request.method())) return route.fulfill({ status: 409, json: { success: false, message: 'Read-only responsive fixture' } });
    return route.fulfill({ json: { success: true, data: dataFor(new URL(request.url())) } });
  });
  const page = await context.newPage();
  page.on('pageerror', error => { errors.push({ route: activeRoute, message: error.message }); console.error('PAGE ERROR', activeRoute, error.message); });
  for (const route of routes) {
    activeRoute = route;
    role = route.startsWith('/admin') ? 'admin' : route.startsWith('/alumni') || route === '/students' ? 'alumni' : 'student';
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(origin + route, { waitUntil: 'networkidle' });
    console.log('Checking', route);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(250);
      const result = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const overflows = [...document.querySelectorAll('body *')].filter(element => {
          const rect = element.getBoundingClientRect();
          if (!rect.width || !rect.height || getComputedStyle(element).visibility === 'hidden') return false;
          if (element.closest('aside#sidebar:not(.translate-x-0), .portfolio-resume, .resume-preview-page')) return false;
          // Local horizontal scroll containers are intentional for data tables and tabs.
          for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
            if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(parent).overflowX)) return false;
          }
          return rect.right > width + 2 || rect.left < -2;
        }).slice(0, 6).map(element => ({ tag: element.tagName, className: String(element.className).slice(0, 160), text: element.textContent.trim().slice(0, 65), right: Math.round(element.getBoundingClientRect().right) }));
        return { width, scrollWidth: document.documentElement.scrollWidth, overflows, hasContent: !!document.querySelector('h1, main, form') };
      });
      checks++;
      if (result.scrollWidth > width + 2 || !result.hasContent || result.overflows.length) {
        failures.push({ route, ...result });
        await page.screenshot({ path: path.join(artifacts, `${route.replaceAll('/', '_').replaceAll('?', '_')}-${width}.png`), fullPage: true });
      }
    }
  }
  if (process.env.RESPONSIVE_INTERACTIONS !== 'false') {
    for (const route of ['/login', '/admin', '/alumni', '/student/certificate']) {
      activeRoute = route;
      role = route.startsWith('/admin') ? 'admin' : route.startsWith('/alumni') ? 'alumni' : 'student';
      await page.goto(origin + route, { waitUntil: 'networkidle' });
      for (const dark of [false, true]) {
        await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
        for (const width of [375, 768, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await page.waitForTimeout(250);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${route}: overflow in ${dark ? 'dark' : 'light'} at ${width}`);
          checks++;
          if (width !== 768) await page.screenshot({ path: path.join(artifacts, `preview${route.replaceAll('/', '_')}-${dark ? 'dark' : 'light'}-${width}.png`), fullPage: true });
        }
        const tokenResult = await page.evaluate(async () => {
          const root = document.documentElement;
          root.style.setProperty('--primary', '220 80% 45%');
          await new Promise(resolve => setTimeout(resolve, 220));
          const reference = document.createElement('div');
          reference.style.backgroundColor = 'hsl(220 80% 45%)';
          document.body.append(reference);
          const expected = getComputedStyle(reference).backgroundColor;
          const activeLink = document.querySelector('#sidebar .is-active');
          const actual = activeLink ? getComputedStyle(activeLink).backgroundColor : expected;
          root.style.removeProperty('--primary');
          reference.remove();
          const sidebar = document.querySelector('#sidebar');
          root.style.setProperty('--sidebar-width', '18rem');
          const sidebarWidth = sidebar?.getBoundingClientRect().width;
          const shell = document.querySelector('.lg\\:pl-64');
          const shellPadding = shell ? parseFloat(getComputedStyle(shell).paddingLeft) : sidebarWidth;
          root.style.removeProperty('--sidebar-width');
          return { expected, actual, sidebarWidth, shellPadding };
        });
        assert.equal(tokenResult.actual, tokenResult.expected, `${route}: active navigation must follow --primary in both themes`);
        if (tokenResult.sidebarWidth) {
          assert.equal(tokenResult.sidebarWidth, 288, `${route}: sidebar width token`);
          assert.equal(tokenResult.shellPadding, 288, `${route}: sidebar and content padding must stay in sync`);
        }
      }
      await page.evaluate(() => document.documentElement.classList.remove('dark'));
      if (route !== '/login') {
        await page.setViewportSize({ width: 375, height: 900 });
        await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
        await page.waitForTimeout(220);
        assert.ok(await page.locator('#sidebar').evaluate(element => Math.abs(element.getBoundingClientRect().left) < 1), `${route}: mobile drawer should open`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(220);
        assert.ok(await page.locator('#sidebar').evaluate(element => element.getBoundingClientRect().right <= 1), `${route}: Escape should close drawer`);
      }
    }
    const touchContext = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    await touchContext.route('**/socket.io/**', route => route.abort());
    activeRoute = '/login';
    await touchContext.route('**/api/**', route => route.fulfill({ json: { success: true, data: dataFor(new URL(route.request().url())) } }));
    const touchPage = await touchContext.newPage();
    await touchPage.goto(origin + '/login', { waitUntil: 'networkidle' });
    assert.ok(await touchPage.locator('input[type="email"]').evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 16), 'Mobile fields should not trigger focus zoom');
    await touchContext.close();
    console.log('PASS: light/dark layouts, live primary and sidebar tokens, mobile drawers, and touch input sizing');
  }
  await writeFile(path.join(artifacts, 'report.json'), JSON.stringify({ checks, routes: routes.length, failures, errors }, null, 2));
  console.log(JSON.stringify({ checks, routes: routes.length, failures, errors, artifacts }, null, 2));
  if (failures.length || errors.length) process.exitCode = 1;
} finally { await browser.close(); }
