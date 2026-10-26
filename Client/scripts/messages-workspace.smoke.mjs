import { chromium } from "../node_modules/.search-validation/node_modules/playwright/index.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Mock messages only. No real conversations are read or changed.
const browser = await chromium.launch({ channel: "msedge", headless: true });
const artifacts = path.join(os.tmpdir(), "SielAlumni-messages-workspace");
await mkdir(artifacts, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const conversations = Array.from({ length: 30 }, (_, index) => ({
    _id: `conversation${index}`,
    authId: `member${index}`,
    name: index ? `Community member ${index}` : "Alex Reyes",
    email: `member${index}@example.test`,
    initial: index ? "C" : "A",
    isGroup: false,
    unread: 0,
    preview: "Let's keep in touch about the next alumni event.",
    time: new Date(Date.now() - index * 60000).toISOString(),
  }));
  const messages = Array.from({ length: 24 }, (_, index) => ({
    _id: `message${index}`,
    from: index % 3 === 0 ? "me" : "them",
    senderEmail: index % 3 === 0 ? "admin@example.test" : "alex@example.test",
    text:
      index === 22
        ? "Hello! We are happy to share the details for our upcoming alumni event. Please confirm your availability and let us know if you have any questions. We look forward to seeing everyone and hearing your stories from life after graduation."
        : index === 23
          ? "Thanks! I'll share the details with the alumni group."
          : index % 3 === 0
            ? "The next alumni meetup is coming up. Can you help coordinate?"
            : "Absolutely, happy to help. Let me know what the group needs.",
    at: new Date(Date.now() - (24 - index) * 60000).toISOString(),
  }));
  let writes = 0;
  await page.route("**/socket.io/**", (route) => route.abort());
  await page.route("**/api/**", (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let data = [];
    if (pathname === "/api/auth/me" || pathname === "/api/users/me")
      data = {
        _id: "admin-profile",
        authId: "self",
        role: "admin",
        name: "Admin Tester",
        email: "admin@example.test",
        passwordSetupRequired: false,
      };
    if (pathname === "/api/conversations")
      data = [...conversations.slice(1), ...conversations.slice(0, 1)];
    if (pathname.endsWith("/messages") && request.method() === "GET")
      data = messages;
    if (pathname.endsWith("/messages") && request.method() === "POST") {
      writes += 1;
      data = { ...request.postDataJSON(), _id: "sent-message" };
    }
    if (pathname === "/api/notifications/unread-count") data = { count: 0 };
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto("http://localhost:5173/admin/message");
  await page.locator(".message-stream-group").first().waitFor();
  assert.equal(
    await page.getByPlaceholder("Message Alex...").isVisible(),
    true,
    "the most recent conversation opens automatically",
  );
  await page.getByRole("button", { name: /Community member 1 / }).click();
  await page.getByPlaceholder("Message Community...").waitFor();
  await page.reload();
  await page.getByPlaceholder("Message Community...").waitFor();
  assert.equal(
    await page.locator('.inbox-conversation-item[aria-pressed="true"]').count(),
    1,
  );
  assert.ok(
    await page
      .locator('.inbox-conversation-item[aria-pressed="true"]')
      .textContent()
      .then((text) => text.includes("Community member 1")),
    "last opened chat is restored after refresh",
  );
  await page.evaluate(() =>
    localStorage.setItem(
      "messages:last-conversation:self",
      "removed-conversation",
    ),
  );
  await page.reload();
  await page.getByPlaceholder("Message Alex...").waitFor();
  const desktop = await page
    .locator("main.messages-page")
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: rect.x,
        right: rect.right,
        bottom: rect.bottom,
        padding: style.padding,
        radius: style.borderRadius,
        shadow: style.boxShadow,
      };
    });
  assert.equal(desktop.x, 256);
  assert.equal(desktop.right, 1440);
  assert.equal(desktop.bottom, 900);
  assert.equal(desktop.padding, "0px");
  assert.equal(desktop.radius, "0px");
  assert.equal(desktop.shadow, "none");
  assert.ok(
    await page
      .locator(".inbox-message-list")
      .evaluate((element) => element.scrollHeight > element.clientHeight),
  );
  const mine = page
    .locator('.message-stream-group[data-align="end"] [data-slot="bubble"]')
    .first();
  await mine.hover();
  assert.notEqual(
    await mine
      .locator('[data-slot="bubble-content"]')
      .evaluate((element) => getComputedStyle(element).backgroundColor),
    "rgba(0, 0, 0, 0)",
  );
  const longMessage = page
    .locator(
      '.message-stream-group[data-align="start"] [data-slot="bubble-content"]',
    )
    .filter({ hasText: "Hello! We are happy to share" });
  assert.ok(
    await longMessage.evaluate(
      (element) => element.getBoundingClientRect().width <= 560,
    ),
    "long messages stay within a readable bubble width",
  );
  assert.equal(
    await page
      .locator('.message-stream-group[data-align="end"]')
      .first()
      .evaluate((element) => getComputedStyle(element).flexDirection),
    "row-reverse",
  );
  const input = page.getByPlaceholder("Message Alex...");
  await input.fill("Testing the full-page message composer.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page
    .locator(".inbox-message-list")
    .getByText("Testing the full-page message composer.", { exact: true })
    .waitFor();
  assert.equal(writes, 1);
  assert.equal(await input.inputValue(), "");
  await page.screenshot({
    path: path.join(artifacts, "desktop-light.png"),
    animations: "disabled",
  });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({
    path: path.join(artifacts, "desktop-dark.png"),
    animations: "disabled",
  });

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 740 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert.ok(
      await page
        .locator(".inbox-composer")
        .evaluate(
          (element) => element.getBoundingClientRect().bottom <= innerHeight,
        ),
    );
    assert.equal(
      await page.locator(".messages-sidebar-slot").isVisible(),
      false,
    );
    await page
      .getByRole("button", { name: "Back to conversations", exact: true })
      .click();
    await page.getByPlaceholder("Search messages...").fill("Alex");
    assert.equal(
      await page.locator(".inbox-conversation-list > li").count(),
      1,
    );
    await page.getByRole("button", { name: /Alex Reyes/ }).click();
    await page.locator(".message-stream-group").first().waitFor();
  }
  await page.screenshot({ path: path.join(artifacts, "mobile-dark.png") });
  await page.reload();
  await page.getByPlaceholder("Message Alex...").waitFor();
  assert.equal(await page.locator(".messages-sidebar-slot").isVisible(), false);
  conversations.length = 0;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.getByText("Your messages", { exact: true }).waitFor();
  assert.equal(
    await page.locator(".inbox-thread").count(),
    0,
    "accounts without conversations keep the empty state",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: latest chat selection, saved conversation restoration, unavailable chat fallback, empty inbox, bounded chat bubbles, send, scrolling, search, mobile navigation, and light/dark views. Screenshots: " +
      artifacts,
  );
} finally {
  await browser.close();
}
