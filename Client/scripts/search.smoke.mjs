// Optional browser checks: npm install --prefix node_modules/.search-validation --no-save --package-lock=false playwright
// Start Vite first. Run: node scripts/search.smoke.mjs (uses locally installed Microsoft Edge).
import { chromium } from "../node_modules/.search-validation/node_modules/playwright/index.mjs";
import assert from "node:assert/strict";

const person = {
  _id: "000000000000000000000001",
  authId: "000000000000000000000002",
  name: "Lester Rodriguez",
  role: "alumni",
  program: "Computer Science",
  batch: "2020",
  position: "Engineer",
  company: "Example",
  canConnect: true,
  connectionStatus: "none",
};
const post = {
  _id: "post1",
  authorProfileId: person._id,
  authorName: person.name,
  authorRole: "alumni",
  title: "Career advice",
  body: "A career guide from Lester Rodriguez.\n".repeat(12),
  tags: ["career"],
  createdAt: "2026-10-01T00:00:00Z",
  savesCount: 2,
};
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const role of ["student", "alumni", "admin"]) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const errors = [];
    const requests = [];
    let pending = false;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/socket.io/**", (route) => route.abort());
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      let data = [];
      if (url.pathname === "/api/auth/me")
        data = {
          _id: "000000000000000000000003",
          role,
          name: "Search Tester",
          email: "tester@example.test",
        };
      if (url.pathname.startsWith("/api/search/")) {
        requests.push(url.pathname + url.search);
        const q = url.searchParams.get("q");
        const category = url.searchParams.get("category") || "all";
        const people =
          q === "Nobody" || category === "posts"
            ? []
            : [
                {
                  ...person,
                  canConnect: !pending,
                  connectionStatus: pending ? "pending" : "none",
                },
              ];
        const posts =
          ["all", "posts"].includes(category) && q !== "Nobody" ? [post] : [];
        data = {
          people: {
            items: people,
            total: people.length,
            page: 1,
            pages: people.length ? 1 : 0,
          },
          posts: {
            items: posts,
            total: posts.length,
            page: 1,
            pages: posts.length ? 1 : 0,
          },
        };
      }
      if (
        url.pathname === "/api/connections" &&
        route.request().method() === "POST"
      ) {
        pending = true;
        data = { status: "pending" };
      }
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto("http://localhost:5173/search");
    const input = page.getByRole("combobox", { name: "Search AlumniLink" });
    await input.fill("Lester");
    await page
      .getByRole("option")
      .filter({ hasText: "Lester Rodriguez" })
      .first()
      .waitFor();
    assert.equal(
      requests.filter((url) => url.includes("suggestions")).length,
      1,
    );
    await input.press("Escape");
    assert.equal(await page.getByRole("listbox").count(), 0);
    await input.press("Enter");
    await page.getByRole("heading", { name: "Results for “Lester”" }).waitFor();
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await page.getByText("Pending", { exact: true }).waitFor();
    await page.getByRole("button", { name: "posts", exact: true }).click();
    await page.getByRole("heading", { name: "Career advice" }).waitFor();
    assert.ok(page.url().includes("category=posts"));
    await page.getByRole("button", { name: "View full post" }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Show less" })
        .getAttribute("aria-expanded"),
      "true",
    );
    await page.goBack();
    await page.getByRole("button", { name: "View Profile" }).count();
    for (const width of [320, 375, 768, 1280]) {
      console.log(`Checking ${role} at ${width}px`);
      await page.setViewportSize({ width, height: 900 });
      await input.click();
      await input.fill("Lester Rodriguez");
      await page
        .getByRole("option")
        .filter({ hasText: "Lester Rodriguez" })
        .first()
        .waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      assert.equal(overflow, false, `${role} layout overflows at ${width}px`);
      const box = await page.getByRole("listbox").boundingBox();
      assert.ok(
        box.x >= 0 && box.x + box.width <= width + 1,
        `${role} dropdown leaves viewport at ${width}px`,
      );
      await input.press("Escape");
    }
    await input.fill("Nobody");
    await page
      .getByText("No matching results found", { exact: true })
      .waitFor();
    await page.mouse.click(1100, 800);
    assert.equal(await page.getByRole("listbox").count(), 0);
    await input.fill("Lester");
    await page
      .getByRole("option")
      .filter({ hasText: "Lester Rodriguez" })
      .first()
      .waitFor();
    await input.press("ArrowDown");
    await input.press("Enter");
    await page.waitForURL(`**/alumni/profile/${person._id}`);
    assert.deepEqual(errors, [], `${role} browser errors`);
    console.log(
      `${role}: autocomplete, keyboard, filters, connection, expansion, and 4 viewport widths passed`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
