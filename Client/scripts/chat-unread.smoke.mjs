import { chromium } from "../node_modules/.search-validation/node_modules/playwright/index.mjs";
import assert from "node:assert/strict";

const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const role of ["admin", "alumni", "student"]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let conversations = [
      {
        _id: "existing",
        name: "Existing Sender",
        email: "existing@example.test",
        unread: "2",
      },
      { _id: "empty", name: "No Unread Field", email: "empty@example.test" },
    ];
    await page.route("**/socket.io/**", (route) => route.abort());
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      let data = [];
      if (path === "/api/auth/me")
        data = { _id: "profile", authId: "self", role, name: "Badge Tester" };
      if (path === "/api/conversations") data = conversations;
      const thread = path.match(/^\/api\/conversations\/([^/]+)\/messages$/);
      if (thread) {
        conversations = conversations.map((convo) =>
          convo._id === thread[1] ? { ...convo, unread: 0 } : convo,
        );
        data = [
          {
            _id: "read-message",
            from: "them",
            text: "Hello",
            at: new Date().toISOString(),
          },
        ];
      }
      return route.fulfill({ json: { success: true, data } });
    });
    const badge = page.locator('[aria-label$=" unread messages"]');
    const expectBadge = async (count) => {
      if (!count) await badge.waitFor({ state: "detached" });
      else {
        await page.locator(`[aria-label="${count} unread messages"]`).waitFor();
        assert.equal(
          await badge.innerText(),
          count > 99 ? "99+" : String(count),
        );
      }
    };
    const emit = (event, payload) =>
      page.evaluate(
        async ({ event, payload }) => {
          const { getSocket } = await import("/src/realtime/socket.js");
          getSocket().emitEvent([event, payload]);
        },
        { event, payload },
      );
    const message = (id, senderAuthId = "other") => ({
      _id: id,
      senderAuthId,
      text: "New message",
      at: new Date().toISOString(),
    });
    await page.goto("http://localhost:5173/search");
    await expectBadge(2);
    conversations[0].unread = 3;
    await emit("message:new", {
      conversationId: "existing",
      message: message("incoming"),
    });
    await expectBadge(3);
    await emit("message:new", {
      conversationId: "existing",
      message: message("own", "self"),
    });
    await expectBadge(3);
    conversations.push({
      _id: "new",
      name: "First Chat Sender",
      email: "new@example.test",
      unread: 1,
    });
    await emit("message:new", {
      conversationId: "new",
      message: message("first-chat"),
    });
    await expectBadge(4);

    if (role === "admin") {
      await page.getByRole("link", { name: "Messages", exact: true }).click();
      await page
        .getByRole("button")
        .filter({ hasText: "Existing Sender" })
        .click();
      await expectBadge(1);
      await page
        .getByRole("button")
        .filter({ hasText: "First Chat Sender" })
        .click();
    } else {
      await page.getByRole("button", { name: "Chats", exact: true }).click();
      await page
        .getByRole("button")
        .filter({ hasText: "Existing Sender" })
        .click();
      await expectBadge(1);
      await page.getByRole("button", { name: "Chats", exact: true }).click();
      await page
        .getByRole("button")
        .filter({ hasText: "First Chat Sender" })
        .click();
    }
    await expectBadge(0);
    conversations[0].unread = 105;
    await emit("connect");
    await expectBadge(105);
    // Prevent restored dock windows from marking these messages read on reload.
    await page.evaluate(() => localStorage.removeItem("chatdock:self"));
    await page.goto("http://localhost:5173/search");
    await expectBadge(105);
    assert.deepEqual(errors, []);
    console.log(
      `Passed ${role}: numeric total, live messages, own-message exclusion, first chat, read clearing, reconnect, 99+ cap and reload.`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
