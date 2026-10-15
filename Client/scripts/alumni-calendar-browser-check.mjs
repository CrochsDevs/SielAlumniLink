// Isolated Edge on port 9237; all API requests use fixtures and never modify real records.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  addDays,
  calendarDate,
  dateKey,
  dateLabel,
  eventsOnDate,
  monthDates,
  shiftMonth,
} from "../src/utils/eventCalendar.js";

assert.equal(dateKey(calendarDate("2026-10-13T16:30:00Z")), "2026-10-14");
assert.equal(
  dateKey(shiftMonth(new Date("2026-01-31T00:00:00Z"), 1)),
  "2026-02-28",
);
assert.equal(
  dateKey(shiftMonth(new Date("2024-01-31T00:00:00Z"), 1)),
  "2024-02-29",
);
assert.equal(monthDates(new Date("2026-10-13T00:00:00Z")).length, 42);
assert.equal(monthDates(new Date("2026-10-13T00:00:00Z"))[0].getUTCDay(), 0);
const boundary = {
  startAt: "2026-10-13T15:00:00Z",
  endAt: "2026-10-13T16:00:00Z",
};
assert.equal(
  eventsOnDate([boundary], new Date("2026-10-14T00:00:00Z")).length,
  0,
  "Midnight end must not spill into next day",
);
assert.equal(
  eventsOnDate(
    [{ ...boundary, endAt: "2026-10-13T17:00:00Z" }],
    new Date("2026-10-14T00:00:00Z"),
  ).length,
  1,
);

const artifacts = path.join(os.tmpdir(), "SielAlumni-calendar-check");
await mkdir(artifacts, { recursive: true });
const target = await (
  await fetch("http://localhost:9237/json/new?about:blank", { method: "PUT" })
).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let sequence = 0;
const waiting = new Map(),
  listeners = new Map(),
  runtimeErrors = [],
  requests = [];
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence,
      timeout = setTimeout(() => {
        waiting.delete(id);
        reject(new Error("Timeout: " + method));
      }, 15000);
    waiting.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const request = waiting.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout);
    waiting.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  } else listeners.get(message.method)?.(message.params);
};
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text,
    );
  return result.result.value;
};
const until = async (expression) => {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("UI wait failed: " + expression);
};
const click = async (label, scope = "document") =>
  evaluate(
    `Array.from(${scope}.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`,
  );
const setValue = (selector, value, type = "HTMLSelectElement") =>
  evaluate(
    `(()=>{const field=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${type}.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('${type === "HTMLSelectElement" ? "change" : "input"}',{bubbles:true}));})()`,
  );
const photo = async (name, width, dark) => {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(
    await evaluate(`document.documentElement.scrollWidth<=${width + 1}`),
    true,
    "Page overflow: " + name,
  );
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(artifacts, name + ".png"),
    Buffer.from(shot.data, "base64"),
  );
};
const today = calendarDate(Date.now());
const at = (day, hour) =>
  new Date(day.getTime() + (hour - 8) * 3600000).toISOString();
const account = {
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  authId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Alex Alumni",
  email: "alex@example.test",
  role: "alumni",
  passwordSetupRequired: false,
};
const base = {
  description: "Learn and connect with the university community.",
  organizer: "University Alumni Office",
  isActive: true,
  registrationWindow: { state: "open" },
  meetingAccess: {
    state: "upcoming",
    opensAt: at(today, 9.75),
    earlyAccessMinutes: 15,
  },
};
let events = [
  {
    ...base,
    _id: "eeeeeeeeeeeeeeeeeeeeeeee",
    title: "Web Accessibility Workshop",
    activityType: "training",
    deliveryMode: "online",
    startAt: at(today, 10),
    endAt: at(today, 11),
  },
  {
    ...base,
    _id: "dddddddddddddddddddddddd",
    title: "Leadership Seminar",
    activityType: "seminar",
    deliveryMode: "onsite",
    startAt: at(today, 14),
    endAt: at(today, 15),
  },
  {
    ...base,
    _id: "cccccccccccccccccccccccc",
    title: "University Homecoming",
    activityType: "event",
    deliveryMode: "onsite",
    startAt: at(today, 16),
    endAt: at(today, 18),
    registrationWindow: { state: "closed" },
  },
  {
    ...base,
    _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
    title: "Registration Opens Later",
    activityType: "event",
    deliveryMode: "online",
    startAt: at(addDays(today, 1), 10),
    endAt: at(addDays(today, 1), 11),
    registrationWindow: {
      state: "upcoming",
      opensAt: at(addDays(today, 1), 9),
    },
  },
  {
    ...base,
    _id: "ffffffffffffffffffffffff",
    title: "Private Draft",
    activityType: "event",
    deliveryMode: "online",
    startAt: at(today, 10),
    isActive: false,
  },
];
let failLoad = true,
  failRegister = true,
  registrationRequests = 0;
listeners.set("Runtime.exceptionThrown", ({ exceptionDetails }) =>
  runtimeErrors.push(
    exceptionDetails.exception?.description || exceptionDetails.text,
  ),
);
listeners.set("Fetch.requestPaused", async ({ requestId, request }) => {
  const route = new URL(request.url).pathname.replace("/api", "");
  requests.push(route);
  let data = [],
    responseCode = 200,
    message;
  if (route === "/auth/me" || route === "/users/me") data = account;
  else if (route === "/feed/status") data = { restricted: false };
  else if (route === "/feed") data = { posts: [], nextCursor: null };
  else if (route === "/feed/notification-event")
    data = {
      _id: "notification-event",
      type: "event",
      title: "Alumni reunion update",
      body: "Community event announcement.",
      author: account,
      audience: "public",
      createdAt: new Date().toISOString(),
      details: {},
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
    };
  else if (route === "/events") {
    if (failLoad) {
      failLoad = false;
      responseCode = 503;
      message = "Calendar temporarily unavailable.";
    } else data = events;
  } else if (route.startsWith("/events/")) {
    const id = route.split("/")[2];
    let event = events.find((item) => item._id === id);
    if (request.method === "POST") {
      registrationRequests++;
      if (failRegister) {
        failRegister = false;
        responseCode = 503;
        message = "Registration failed. Please retry.";
      } else {
        event = {
          ...event,
          registration: { _id: id + "registration", name: account.name },
          location:
            event.deliveryMode === "onsite"
              ? "University Auditorium"
              : undefined,
        };
        events = events.map((item) => (item._id === id ? event : item));
      }
    }
    data = event;
  }
  await send("Fetch.fulfillRequest", {
    requestId,
    responseCode,
    responseHeaders: [
      { name: "Content-Type", value: "application/json" },
      { name: "Access-Control-Allow-Origin", value: "http://localhost:5173" },
      { name: "Access-Control-Allow-Credentials", value: "true" },
      {
        name: "Access-Control-Allow-Methods",
        value: "GET,POST,PUT,DELETE,OPTIONS",
      },
      { name: "Access-Control-Allow-Headers", value: "Content-Type" },
    ],
    body: Buffer.from(
      JSON.stringify({ success: responseCode === 200, data, message }),
    ).toString("base64"),
  });
});
const open = async (id) => {
  await evaluate(
    `document.querySelector('[data-calendar-event="${id}"]').click()`,
  );
  await until(`document.querySelector('dialog[open]')`);
};
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setTimezoneOverride", {
    timezoneId: "America/Los_Angeles",
  });
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/*" }] });
  await send("Page.navigate", { url: "http://localhost:5173/alumni/events" });
  await until(
    `document.querySelector('main [role=alert]')?.textContent.includes('Calendar temporarily unavailable')`,
  );
  await click("Retry");
  await until(`document.querySelectorAll('[data-calendar-date]').length===42`);
  assert.equal(
    await evaluate(
      `document.querySelector('[data-calendar-title]').textContent`,
    ),
    dateLabel(today, { month: "long", year: "numeric" }),
  );
  assert.equal(
    await evaluate(
      `document.querySelector('[data-calendar-event="ffffffffffffffffffffffff"]')===null`,
    ),
    true,
  );
  assert.equal(
    await evaluate(
      `document.querySelector('main').textContent.includes('Create event')`,
    ),
    false,
  );
  assert.ok(
    await evaluate(
      `document.querySelector('[data-calendar-date="${dateKey(today)}"]').textContent.includes('10:00 AM')`,
    ),
    "Times must be Manila even on a US device",
  );
  await photo("calendar-desktop", 1440, false);
  await evaluate(
    `document.querySelector('[aria-label="Next period"]').click()`,
  );
  await until(
    `document.querySelector('[data-calendar-title]').textContent===${JSON.stringify(dateLabel(shiftMonth(today, 1), { month: "long", year: "numeric" }))}`,
  );
  await click("Today");
  await evaluate(
    `document.querySelector('[data-calendar-date="${dateKey(today)}"] button[aria-pressed]').click()`,
  );
  await click("Day");
  await until(`document.querySelector('[data-calendar-agenda]')`);
  assert.equal(
    await evaluate(
      `document.querySelectorAll('[data-calendar-agenda] [data-calendar-event]').length`,
    ),
    3,
  );
  await click("Week");
  await until(`document.querySelector('[data-calendar-week]')`);
  await photo("calendar-week-desktop", 1440, false);
  await click("List");
  await setValue('[aria-label="Activity type"]', "seminar");
  assert.equal(
    await evaluate(
      `document.querySelectorAll('[data-calendar-agenda] [data-calendar-event]').length`,
    ),
    1,
  );
  await setValue('[aria-label="Delivery mode"]', "online");
  await until(
    `document.querySelector('[role=status]')?.textContent.includes('No activities match')`,
  );
  await click("Clear filters");
  await setValue(
    '[aria-label="Search activities"]',
    "Web Accessibility",
    "HTMLInputElement",
  );
  await until(
    `document.querySelectorAll('[data-calendar-agenda] [data-calendar-event]').length===1`,
  );
  await open("eeeeeeeeeeeeeeeeeeeeeeee");
  assert.ok(
    await evaluate(
      `document.querySelector('dialog').textContent.includes('10:00 AM')`,
    ),
  );
  await click("Register", 'document.querySelector("dialog")');
  await until(`document.querySelector('dialog [role=alert]')`);
  assert.equal(events[0].registration, undefined);
  await click("Register", 'document.querySelector("dialog")');
  await until(
    `document.querySelector('dialog').textContent.includes('Meeting not available yet')`,
  );
  assert.equal(registrationRequests, 2);
  assert.equal(
    await evaluate(
      `document.querySelector('dialog a[href^="/meetings/"]')===null`,
    ),
    true,
  );
  await photo("calendar-registration-mobile", 390, false);
  await evaluate(
    `document.querySelector('dialog [aria-label="Close dialog"]').click()`,
  );
  await click("Clear filters");
  await setValue('[aria-label="Participation"]', "registered");
  assert.equal(
    await evaluate(
      `document.querySelectorAll('[data-calendar-agenda] [data-calendar-event]').length`,
    ),
    1,
  );
  events = events.map((event) =>
    event._id === "eeeeeeeeeeeeeeeeeeeeeeee"
      ? { ...event, meetingAccess: { state: "open" } }
      : event,
  );
  await click("Refresh");
  await until(
    `!Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Refresh').disabled`,
  );
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-label="Calendar view"] button[aria-pressed="true"]').textContent`,
    ),
    "List",
    "Refresh must retain view",
  );
  await open("eeeeeeeeeeeeeeeeeeeeeeee");
  await until(
    `document.querySelector('dialog a[href="/meetings/eeeeeeeeeeeeeeeeeeeeeeee"]')`,
  );
  await evaluate(
    `document.querySelector('dialog [aria-label="Close dialog"]').click()`,
  );
  await click("Clear filters");
  await open("dddddddddddddddddddddddd");
  assert.equal(
    await evaluate(
      `document.querySelector('dialog').textContent.includes('University Auditorium')`,
    ),
    false,
  );
  await click("Register", 'document.querySelector("dialog")');
  await until(
    `document.querySelector('dialog').textContent.includes('View registration')`,
  );
  await click("View registration", 'document.querySelector("dialog")');
  await until(`document.querySelectorAll('dialog[open]').length===2`);
  assert.ok(
    await evaluate(
      `Array.from(document.querySelectorAll('dialog'))[1].textContent.includes('University Auditorium')`,
    ),
  );
  await evaluate(
    `Array.from(document.querySelectorAll('dialog'))[1].querySelector('[aria-label="Close dialog"]').click()`,
  );
  await evaluate(
    `document.querySelector('dialog [aria-label="Close dialog"]').click()`,
  );
  await open("cccccccccccccccccccccccc");
  assert.equal(
    await evaluate(
      `Array.from(document.querySelectorAll('dialog button')).find(button=>button.textContent==='Registration closed').disabled`,
    ),
    true,
  );
  await evaluate(
    `document.querySelector('dialog [aria-label="Close dialog"]').click()`,
  );
  // Tomorrow may be in the next month; navigate the list to that month when necessary.
  if (addDays(today, 1).getUTCMonth() !== today.getUTCMonth())
    await evaluate(
      `document.querySelector('[aria-label="Next period"]').click()`,
    );
  await open("bbbbbbbbbbbbbbbbbbbbbbbb");
  assert.equal(
    await evaluate(
      `Array.from(document.querySelectorAll('dialog button')).find(button=>button.textContent==='Registration not open').disabled`,
    ),
    true,
  );
  await evaluate(
    `document.querySelector('dialog [aria-label="Close dialog"]').click()`,
  );
  await click("Today");
  await click("Month");
  await photo("calendar-mobile", 390, false);
  await photo("calendar-mobile-dark", 390, true);
  await photo("calendar-narrow-mobile", 320, false);
  await click("Week");
  await photo("calendar-week-mobile-dark", 390, true);
  await click("Alumni community");
  await until(
    `document.querySelector('main').textContent.includes('From the alumni community')`,
  );
  await until(
    `!document.querySelector('main').textContent.includes('Loading feed')`,
  );
  await photo("calendar-community-mobile", 390, false);
  await click("University calendar");
  await evaluate(
    `history.pushState({},'', '/alumni/events?post=notification-event'); window.dispatchEvent(new PopStateEvent('popstate'));`,
  );
  await until(`document.querySelector('#post-notification-event')`);
  assert.equal(
    await evaluate(
      `Array.from(document.querySelectorAll('[aria-label="Events workspace"] button')).find(button=>button.textContent==='Alumni community').getAttribute('aria-pressed')`,
    ),
    "true",
  );
  await click("University calendar");
  await until(`document.querySelector('[data-event-calendar]')`);
  assert.equal(
    await evaluate(`new URLSearchParams(location.search).has('post')`),
    false,
  );
  assert.deepEqual(runtimeErrors, []);
  console.log(
    "Passed: Manila timezone and midnight/leap-year boundaries; month/week/day/list, navigation, filters, draft exclusion, load retry, registration retry, meeting time gate/open link, onsite pass, registration deadlines, refresh retains view, community tab and notification deep links, desktop/mobile/dark screenshots. Mock APIs only. Artifacts: " +
      artifacts,
  );
} catch (error) {
  console.error(
    await evaluate(
      `({url:location.href,body:document.body.innerText.slice(0,2000)})`,
    ),
    { runtimeErrors, requests },
  );
  throw error;
} finally {
  await send("Browser.close").catch(() => {});
  socket.close();
}
