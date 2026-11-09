import assert from "node:assert/strict";
import { chromium } from "../node_modules/.search-validation/node_modules/playwright/index.mjs";

// Local API fixtures only; no real accounts, CAIS sync, or certificates change.
const browser = await chromium.launch({ channel: "msedge", headless: true });
const baseURL = process.env.PREVIEW_URL || "http://127.0.0.1:5173";
const errors = [];
const person = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", authId: "bbbbbbbbbbbbbbbbbbbbbbbb", role: "admin", name: "Loader Fixture", email: "loader@example.test" };
const attendance = { _id: "attendance-fixture", authId: person.authId, studentName: "Student Fixture", title: "Fixture seminar", date: "2026-01-01" };
const certificate = { _id: "certificate-fixture", recipientName: "Student Fixture", title: attendance.title, activityType: "seminar", participationDate: attendance.date, organizer: "Fixture", certificateNumber: "SL-FIXTURE" };

async function setup(options = {}) {
  const context = await browser.newContext(options);
  await context.routeWebSocket("**/socket.io/**", socket => socket.close());
  const gates = new Map();
  const defer = endpoint => {
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    gates.set(endpoint, ready);
    return release;
  };
  let failConfirmation = false;
  await context.route("**/api/**", async route => {
    const endpoint = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    await gates.get(endpoint);
    let data = [], status = 200;
    if (["/auth/me", "/users/me"].includes(endpoint)) data = person;
    if (endpoint === "/notifications/unread-count") data = { count: 0 };
    if (endpoint === "/users/sync") data = { total: 1, created: 1, updated: 0, skipped: [] };
    if (endpoint === "/auth/verify-otp") data = { resetToken: "fixture-token" };
    if (endpoint === "/certificates/participants") data = [person];
    if (endpoint === "/certificates/attendance") data = [attendance];
    if (endpoint === "/certificates/issued") data = [];
    if (endpoint.endsWith("/confirm")) { data = certificate; status = failConfirmation ? 503 : 200; }
    if (endpoint.endsWith("/download")) {
      await route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="white"/></svg>' });
      return;
    }
    await route.fulfill({ status, json: { success: status === 200, data, message: status === 503 ? "Fixture issuance failed. Please retry." : undefined } });
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(10000);
  return { context, page, defer, failConfirmation: () => { failConfirmation = true; } };
}

async function checkLoader(page, label, fullScreen = false) {
  const loader = page.getByRole("status").filter({ hasText: label });
  await loader.waitFor();
  assert.equal(await loader.getAttribute("aria-busy"), "true");
  assert.equal(await loader.locator("svg").count(), 1);
  assert.equal(await loader.evaluate(node => node.classList.contains("graduation-cap-loader--fullscreen")), fullScreen);
  return loader;
}

try {
  const recovery = await setup({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const releases = [];
  try {
    await recovery.page.goto(baseURL + "/forgot-password");
    await recovery.page.locator("#recovery-email").fill("loader@example.test");
    let release = recovery.defer("/auth/forgot-password"); releases.push(release);
    await recovery.page.getByRole("button", { name: "Send reset code", exact: true }).click();
    let loader = await checkLoader(recovery.page, "Sending reset code");
    assert.equal(await recovery.page.locator("#recovery-email").isDisabled(), true);
    assert.equal(await loader.locator(".graduation-cap-loader__dots").evaluate(node => getComputedStyle(node, "::after").animationName), "none");
    release();
    await recovery.page.locator("#recovery-otp").fill("123456");
    release = recovery.defer("/auth/verify-otp"); releases.push(release);
    await recovery.page.getByRole("button", { name: "Verify code", exact: true }).click();
    await checkLoader(recovery.page, "Verifying your code");
    release();
    await recovery.page.locator("#recovery-password").fill("FixturePassword123!");
    await recovery.page.locator("#recovery-confirm").fill("FixturePassword123!");
    release = recovery.defer("/auth/reset-password"); releases.push(release);
    await recovery.page.getByRole("button", { name: "Reset password", exact: true }).click();
    loader = await checkLoader(recovery.page, "Resetting your password");
    assert.equal(await recovery.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    release();
    await loader.waitFor({ state: "detached" });
    await recovery.page.getByRole("heading", { name: "You're all set!" }).waitFor();
    console.log("PASS password recovery: send, verify, reset, mobile, reduced motion");
  } finally { releases.forEach(release => release()); await recovery.context.close(); }

  const sync = await setup({ colorScheme: "dark" });
  const releaseSync = sync.defer("/users/sync");
  try {
    await sync.context.addInitScript(() => localStorage.setItem("theme", "dark"));
    await sync.page.goto(baseURL + "/admin/users");
    await sync.page.getByRole("button", { name: "Sync CAIS" }).click();
    await sync.page.getByRole("button", { name: "Sync Now" }).click();
    const loader = await checkLoader(sync.page, "Syncing records from CAIS");
    assert.equal(await loader.getAttribute("data-theme"), "dark");
    releaseSync();
    await loader.waitFor({ state: "detached" });
    await sync.page.getByText("Create", { exact: true }).waitFor();
    console.log("PASS CAIS sync: compact dark loader -> result");
  } finally { releaseSync(); await sync.context.close(); }

  for (const fail of [false, true]) {
    const issue = await setup();
    const releaseIssue = issue.defer("/certificates/attendance/attendance-fixture/confirm");
    const releasePreview = issue.defer("/certificates/certificate-fixture/download");
    try {
      if (fail) issue.failConfirmation();
      await issue.page.goto(baseURL + "/admin/certificates");
      await issue.page.getByRole("button", { name: "Confirm participation", exact: true }).click();
      await issue.page.getByRole("checkbox").check();
      await issue.page.getByRole("button", { name: "Confirm & issue certificate" }).click();
      const loader = await checkLoader(issue.page, "Issuing certificate");
      assert.equal(await issue.page.getByRole("button", { name: "Confirming...", exact: true }).isDisabled(), true);
      releaseIssue();
      await loader.waitFor({ state: "detached" });
      if (fail) {
        await issue.page.getByRole("alert").filter({ hasText: "Fixture issuance failed" }).waitFor();
        assert.equal(await issue.page.getByRole("button", { name: "Confirm & issue certificate" }).isEnabled(), true);
        console.log("PASS certificate issuance failure: loader -> retryable form");
      } else {
        const preview = await checkLoader(issue.page, "Preparing your certificate");
        releasePreview();
        await preview.waitFor({ state: "detached" });
        await issue.page.locator(".certificate-preview-image:not(.is-loading)").waitFor();
        console.log("PASS certificate issuance and preview: compact loaders -> certificate");
      }
    } finally { releaseIssue(); releasePreview(); await issue.context.close(); }
  }

  const logout = await setup();
  const releaseLogout = logout.defer("/auth/logout");
  try {
    await logout.page.goto(baseURL + "/logout");
    assert.equal(await logout.page.locator(".graduation-cap-loader").count(), 0);
    await logout.page.getByRole("button", { name: "Yes, log out" }).click();
    const loader = await checkLoader(logout.page, "Signing you out", true);
    releaseLogout();
    await loader.waitFor({ state: "detached" });
    console.log("PASS logout: confirmation -> fullscreen loader -> login");
  } finally { releaseLogout(); await logout.context.close(); }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
