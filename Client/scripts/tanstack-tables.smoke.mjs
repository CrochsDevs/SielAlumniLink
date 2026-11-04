import { chromium } from "../node_modules/.search-validation/node_modules/playwright/index.mjs";
import assert from "node:assert/strict";
import { employmentReport } from "../../Server/modules/employment/employment.policy.js";
import {
  reportPeriod,
  summarizeEngagement,
} from "../../Server/modules/reports/reports.policy.js";

// Isolated API fixtures: no real accounts or records are accessed.
const browser = await chromium.launch({ channel: "msedge", headless: true });
const author = {
  _id: "admin",
  authId: "admin",
  role: "admin",
  name: "Admin Tester",
  passwordSetupRequired: false,
};
const records = (prefix) =>
  Array.from({ length: 23 }, (_, index) => ({
    _id: `${prefix}${index}`,
    authId: `${prefix}${index}`,
    profileId: `${prefix}${index}`,
    role: "student",
    name: `Member ${index + 1}`,
    email: `member${index + 1}@example.test`,
    title: `${prefix} ${index + 1}`,
    body: "Table fixture",
    description: "Table fixture",
    audience: "all",
    isActive: true,
    questions: [],
    createdAt: "2026-10-22T00:00:00Z",
    startAt: new Date(Date.now() + index * 86400000).toISOString(),
    endAt: new Date(Date.now() + index * 86400000 + 3600000).toISOString(),
    action: "login",
    program: "Engineering",
    studentId: `2026-${index}`,
    location: "Campus",
    connectionsCount: 23,
  }));
const datasets = {
  announcements: records("Announcement"),
  surveys: records("Survey"),
  events: records("Event"),
  users: records("User"),
  activity: records("Log"),
};
datasets.tracer = records("Tracer").map((row) => ({
  ...row,
  status: "Employed",
  company: "Campus Co",
  position: "Engineer",
  batch: "2025",
  employmentDate: "2025-01",
  respondedAt: row.createdAt,
}));
const profiles = records("Alumni").map((row) => ({
  ...row,
  batch: "2025",
  employmentStatus: "Employed",
  employmentHistory: [
    {
      company: "Campus Co",
      position: "Engineer",
      industry: "Engineering",
      startDate: "2025-01",
      current: true,
    },
  ],
}));

try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/socket.io/**", (route) => route.abort());
  await page.route("**/api/**", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace("/api/", "");
    const [resource, id] = pathname.split("/");
    if (id && datasets[resource] && request.method() === "PUT") {
      Object.assign(
        datasets[resource].find((row) => row._id === id),
        request.postDataJSON(),
      );
    }
    let data =
      pathname === "auth/me" || pathname === "users/me"
        ? author
        : pathname === "notifications/unread-count"
          ? { count: 0 }
          : datasets[resource] || [];
    if (pathname === "employment/reports")
      data = employmentReport(profiles, Object.fromEntries(url.searchParams));
    if (resource === "connections") {
      const query = (url.searchParams.get("q") || "").toLowerCase();
      const members = datasets.users.filter((row) =>
        `${row.name} ${row.email}`.toLowerCase().includes(query),
      );
      const current = Number(url.searchParams.get("page") || 1);
      const limit = Number(url.searchParams.get("limit") || 10);
      data = {
        items: members.slice((current - 1) * limit, current * limit),
        total: members.length,
        page: current,
        pages: Math.max(1, Math.ceil(members.length / limit)),
      };
    }
    if (pathname === "reports/dashboard") {
      const date = url.searchParams.get("date");
      data = {
        date,
        timezone: "Asia/Manila",
        generatedAt: new Date().toISOString(),
        members: { students: 10, alumni: 20, total: 30 },
        overview: {
          jobs: 12,
          applications: 42,
          pendingApplications: 8,
          events: 3,
          surveys: 4,
          certificates: 120,
          pendingCertificates: 6,
          announcements: 5,
          posts: 93,
          blockedPosts: 2,
          unreadMessages: 3,
          tracerResponses: 15,
          upcomingEvents: [],
          recentAnnouncements: [],
        },
        mentorship: { accepted: 6, pending: 3, rejected: 1, total: 10 },
        engagement: summarizeEngagement(
          [{ source: "logins", hour: date + "T08", count: 9, actors: ["one"] }],
          reportPeriod(date),
        ),
      };
    }
    return route.fulfill({ json: { success: true, data } });
  });

  for (const [route, search, lastTitle] of [
    ["announcements", "Search announcements...", "Announcement 23"],
    ["surveys", "Search surveys...", "Survey 23"],
  ]) {
    await page.goto(`http://localhost:5173/admin/${route}`);
    await page.locator("tbody tr").nth(9).waitFor();
    assert.equal(await page.locator("tbody tr").count(), 10);
    await page.getByRole("button", { name: "Next page" }).click();
    await page
      .locator("tbody tr")
      .filter({
        hasText: route === "surveys" ? "Survey 11" : "Announcement 11",
      })
      .waitFor();
    await page.getByPlaceholder(search).fill(lastTitle);
    await page.locator("tbody tr").filter({ hasText: lastTitle }).waitFor();
    assert.equal(await page.locator("tbody tr").count(), 1);
    if (route === "announcements") {
      await page.getByTitle("Unpublish", { exact: true }).click();
      await page.getByTitle("Publish", { exact: true }).waitFor();
    }
    await page.getByPlaceholder(search).fill("");
    await page.locator("tbody tr").nth(9).waitFor();
    await page.locator(".data-pagination [role=combobox]").click();
    await page.getByRole("option", { name: "5 / page", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelectorAll("tbody tr").length === 5,
    );
    await page.getByRole("button", { name: "Next page" }).click();
    await page
      .locator("tbody tr")
      .filter({ hasText: route === "surveys" ? "Survey 6" : "Announcement 6" })
      .waitFor();
  }

  await page.goto("http://localhost:5173/admin/events");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.locator("tbody tr").nth(9).waitFor();
  assert.equal(await page.locator("thead th").count(), 4);
  await page.goto("http://localhost:5173/admin/users");
  await page.locator("tbody tr").nth(9).waitFor();
  assert.equal(await page.locator("thead th").count(), 10);
  await page.goto("http://localhost:5173/admin/audit-logs");
  await page.locator("tbody tr").nth(9).waitFor();
  assert.equal(await page.locator("thead th").count(), 4);

  await page.goto("http://localhost:5173/admin/tracer?view=employment");
  await page.locator("tbody tr").nth(9).waitFor();
  await page
    .getByRole("button", { name: /View employment history for/ })
    .first()
    .click();
  await page.getByRole("dialog", { name: /employment history/ }).waitFor();
  await page.keyboard.press("Escape");
  await page
    .getByLabel("Search alumni employment", { exact: true })
    .fill("member23");
  await page.locator("tbody tr").filter({ hasText: "Member 23" }).waitFor();
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.goto("http://localhost:5173/admin/tracer?view=responses");
  await page.locator("tbody tr").nth(9).waitFor();
  assert.equal(await page.locator("thead th").count(), 12);
  await page
    .getByLabel("Search tracer responses", { exact: true })
    .fill("no-match");
  await page.getByText("No responses found", { exact: true }).waitFor();
  await page
    .getByLabel("Search tracer responses", { exact: true })
    .fill("member23");
  await page
    .locator("tbody tr")
    .filter({ hasText: "member23@example.test" })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 900 });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= 391),
  );
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("http://localhost:5173/admin/connections");
  await page.locator("tbody tr").nth(9).waitFor();
  await page.getByRole("button", { name: "Next page" }).click();
  await page
    .locator("tbody tr")
    .filter({ hasText: "member11@example.test" })
    .waitFor();
  await page.getByRole("button", { name: "Next page" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll("tbody tr").length === 3,
  );
  await page.getByLabel("Search connections", { exact: true }).fill("member23");
  await page
    .locator("tbody tr")
    .filter({ hasText: "member23@example.test" })
    .waitFor();
  assert.equal(
    await page.locator("tbody tr").count(),
    1,
    "server rows are not paginated twice",
  );

  await page.goto("http://localhost:5173/admin");
  await page.getByText("View chart data", { exact: true }).click();
  await page.locator("tbody tr").nth(11).waitFor();
  assert.equal(await page.locator("thead th").count(), 3);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: TanStack headers, client/server pagination, page-size reset, filters, publish/refresh, career history, empty states, dashboard data, and mobile overflow.",
  );
} finally {
  await browser.close();
}
