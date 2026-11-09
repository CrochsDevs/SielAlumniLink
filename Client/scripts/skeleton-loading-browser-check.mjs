import assert from "node:assert/strict";
import { chromium } from "../node_modules/.search-validation/node_modules/playwright/index.mjs";

// Delayed API fixtures exercise the real pages without accessing live accounts.
const baseURL = process.env.PREVIEW_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors = [];
const profile = role => ({ _id: "000000000000000000000001", authId: "000000000000000000000002", name: "Skeleton Fixture", email: "skeleton@example.test", role, passwordSetupRequired: false });
const cases = [
  ["admin", "/admin/users", "table"],
  ["admin", "/admin/surveys", "table"],
  ["admin", "/admin/announcements", "list"],
  ["student", "/student/events", "cards"],
  ["student", "/student/career", "cards"],
  ["student", "/student/requests", "list"],
  ["alumni", "/alumni/surveys", "list"],
  ["alumni", "/alumni/events", "calendar"],
  ["student", "/student/profile/000000000000000000000003", "profile"],
  ["alumni", "/alumni/surveys/fixture", "form"],
  ["student", "/student/success", "cards"],
  ["student", "/feed", "feed"],
];

function fixture(endpoint, role) {
  if (["/auth/me", "/users/me"].includes(endpoint)) return profile(role);
  if (endpoint === "/tracer/access") return { updateRequired: false, quarter: "2026-Q4", nextUpdateAt: "2027-01-01T00:00:00Z" };
  if (endpoint === "/notifications/unread-count") return { count: 0 };
  if (endpoint === "/feed/status") return { restricted: false };
  if (["/feed", "/feed/stories"].includes(endpoint)) return { posts: [], nextCursor: null };
  if (endpoint === "/surveys/fixture") return { _id: "fixture", title: "Fixture survey", questions: [] };
  if (endpoint === "/surveys/me/answers/fixture") return null;
  if (/^\/users\/000/.test(endpoint)) return { ...profile("alumni"), _id: "000000000000000000000003" };
  return [];
}

async function contextWithGate(role, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  await context.routeWebSocket("**/socket.io/**", socket => socket.close());
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await context.route("**/api/**", async route => {
    const endpoint = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    if (!["/auth/me", "/users/me", "/tracer/access"].includes(endpoint)) await gate;
    await route.fulfill({ json: { success: true, data: fixture(endpoint, role) } });
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  return { context, page, release };
}

try {
  for (const [role, pathname, variant] of cases) {
    const { context, page, release } = await contextWithGate(role);
    try {
      await page.goto(baseURL + pathname);
      const skeleton = page.locator(`main .siel-loading--${variant}`).first();
      await skeleton.waitFor({ state: "visible" });
      assert.equal(await skeleton.getAttribute("aria-busy"), "true");
      assert.ok(await skeleton.locator(".sr-only").textContent());
      assert.ok(await skeleton.locator(".siel-skeleton").count());
      release();
      await page.locator("main .siel-loading").first().waitFor({ state: "detached" });
      assert.equal(await page.locator("main .siel-loading").count(), 0, pathname);
      console.log(`PASS ${pathname}: ${variant} -> content`);
    } finally { release(); await context.close(); }
  }

  // Empty chat and notification messages must wait for their initial responses.
  for (const kind of ["Messages", "Notifications"]) {
    const { context, page, release } = await contextWithGate("student");
    try {
      await page.goto(baseURL + "/student/accounts");
      await page.getByRole("button", { name: kind === "Messages" ? "Chats" : kind, exact: true }).click();
      const panel = page.locator(kind === "Messages" ? ".chats-panel" : ".notifications-panel");
      await panel.locator(".siel-loading").waitFor();
      assert.equal(await panel.getByText(/No (conversations|notifications) yet/).count(), 0);
      release();
      await panel.locator(".siel-loading").waitFor({ state: "detached" });
      await panel.getByText(kind === "Messages" ? "No conversations yet." : "No notifications yet", { exact: true }).waitFor();
      console.log(`PASS ${kind}: skeleton -> empty state`);
    } finally { release(); await context.close(); }
  }

  const chat = await contextWithGate("student");
  let releaseThread;
  const threadGate = new Promise(resolve => { releaseThread = resolve; });
  try {
    await chat.context.route("**/api/conversations", route => route.fulfill({ json: { success: true, data: [{ _id: "fixture-chat", name: "Fixture contact", email: "contact@example.test", unread: 0 }] } }));
    await chat.context.route("**/api/conversations/*/messages", async route => {
      await threadGate;
      await route.fulfill({ json: { success: true, data: [] } });
    });
    chat.release();
    await chat.page.goto(baseURL + "/student/message");
    await chat.page.locator(".siel-loading--messages").waitFor();
    assert.equal(await chat.page.getByText(/No messages yet/).count(), 0);
    releaseThread();
    await chat.page.locator(".siel-loading--messages").waitFor({ state: "detached" });
    await chat.page.getByText(/No messages yet/).waitFor();
    console.log("PASS message history: skeleton -> empty thread");
  } finally { chat.release(); releaseThread(); await chat.context.close(); }

  const session = await contextWithGate("student");
  let releaseSession;
  const sessionGate = new Promise(resolve => { releaseSession = resolve; });
  try {
    await session.context.route("**/api/auth/me", async route => {
      await sessionGate;
      await route.fulfill({ json: { success: true, data: profile("student") } });
    });
    await session.page.goto(baseURL + "/student/events");
    await session.page.locator(".siel-page-skeleton").waitFor();
    releaseSession();
    await session.page.locator("main .siel-loading--cards").waitFor();
    assert.equal(await session.page.locator(".siel-page-skeleton").count(), 0);
    session.release();
    console.log("PASS session skeleton -> page skeleton");
  } finally { session.release(); releaseSession(); await session.context.close(); }

  const failure = await contextWithGate("student");
  let rejectRequest;
  const errorGate = new Promise(resolve => { rejectRequest = resolve; });
  try {
    await failure.context.route("**/api/events", async route => {
      await errorGate;
      await route.fulfill({ status: 503, json: { success: false, message: "Fixture unavailable. Please retry." } });
    });
    failure.release();
    await failure.page.goto(baseURL + "/student/events");
    await failure.page.locator("main .siel-loading--cards").waitFor();
    rejectRequest();
    await failure.page.locator("main .siel-loading").waitFor({ state: "detached" });
    await failure.page.getByRole("alert").filter({ hasText: "Unable to load activities" }).waitFor();
    console.log("PASS failed request: skeleton -> error state");
  } finally { failure.release(); rejectRequest(); await failure.context.close(); }

  // Narrow screens, dark colors, and reduced motion use the same real page.
  const { context, page, release } = await contextWithGate("student", { viewport: { width: 390, height: 844 }, colorScheme: "dark", reducedMotion: "reduce" });
  try {
    await context.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.goto(baseURL + "/student/events");
    await page.locator("main .siel-loading--cards").waitFor();
    const appearance = await page.locator("main .siel-skeleton").first().evaluate(node => ({
      animation: getComputedStyle(node, "::after").animationName,
      background: getComputedStyle(node).backgroundColor,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    assert.equal(appearance.animation, "none");
    assert.equal(appearance.overflow, false);
    assert.ok(await page.locator("html.dark").count());
    assert.notEqual(appearance.background, "rgb(244, 244, 245)");
    release();
    console.log("PASS mobile, dark mode, reduced motion");
  } finally { release(); await context.close(); }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
