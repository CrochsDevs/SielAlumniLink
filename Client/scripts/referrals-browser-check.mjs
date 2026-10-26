import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9232.
const artifacts = path.join(os.tmpdir(), "SielAlumni-referrals-check");
await mkdir(artifacts, { recursive: true });
const target = await (
  await fetch("http://localhost:9232/json/new?about:blank", { method: "PUT" })
).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let sequence = 0;
const waiting = new Map();
const listeners = new Map();
const runtimeErrors = [];
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => {
      waiting.delete(id);
      reject(new Error(`Timeout: ${method}`));
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
  throw new Error(`UI wait failed: ${expression}`);
};

const student = {
  _id: "111111111111111111111111",
  authId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Alex Santos",
  email: "alex@example.test",
  role: "student",
  program: "BS Information Technology",
  passwordSetupRequired: false,
};
const alumni = {
  ...student,
  _id: "222222222222222222222222",
  authId: "bbbbbbbbbbbbbbbbbbbbbbbb",
  name: "Jamie Reyes",
  email: "jamie@example.test",
  role: "alumni",
};
let user = student;
let referrals = [
  {
    _id: "ccccccccccccccccccccccc1",
    type: "job",
    title: "Junior Software Developer",
    organization: "Campus Technology Partners",
    description:
      "Build useful web applications with a collaborative team.\n\nRequirements\nJavaScript, React, and a willingness to learn.\n\nApply here in the alumni portal.",
    link: "https://example.test/careers",
    authorAuthId: alumni.authId,
    authorName: alumni.name,
    isActive: true,
    createdAt: "2026-10-10",
  },
  {
    _id: "ccccccccccccccccccccccc2",
    type: "internship",
    title: "Engineering Internship Program",
    organization: "Community Engineering",
    description:
      "Get hands-on experience with an engineering team and develop practical workplace skills.",
    authorAuthId: alumni.authId,
    authorName: alumni.name,
    isActive: true,
    createdAt: "2026-10-09",
  },
  {
    _id: "ccccccccccccccccccccccc3",
    type: "scholarship",
    title: "Graduate Research Scholarship for Community Development",
    organization: "Alumni Education Foundation",
    description:
      "Support for students conducting research. Review eligibility and introduce your research interests when applying.",
    authorAuthId: alumni.authId,
    authorName: alumni.name,
    isActive: true,
    createdAt: "2026-10-08",
  },
];
let applications = [],
  applyRequests = 0,
  postRequests = 0,
  editRequests = 0,
  deleteRequests = 0,
  failNextEdit = true,
  failNextDelete = true,
  failNextApplication = true,
  failNextList = false;
listeners.set("Runtime.exceptionThrown", ({ exceptionDetails }) =>
  runtimeErrors.push(
    exceptionDetails.exception?.description || exceptionDetails.text,
  ),
);
listeners.set("Fetch.requestPaused", async ({ requestId, request }) => {
  try {
    const route = new URL(request.url).pathname.replace("/api", "");
    let data = [],
      responseCode = 200,
      message = "";
    if (request.method !== "OPTIONS") {
      const body = request.postData ? JSON.parse(request.postData) : {};
      if (route === "/auth/me" || route === "/users/me") data = user;
      else if (route === "/tracer/access") data = { updateRequired: false, quarter: "2026-Q4", nextUpdateAt: "2027-01-01T00:00:00Z" };
      else if (route === "/notifications/unread-count") data = { count: 0 };
      else if (route === "/referrals/applications/me")
        data = applications
          .filter((item) => item.applicantAuthId === user.authId)
          .map((item) => {
            const referral = referrals.find((r) => r._id === item.referralId);
            return {
              ...item,
              referralTitle: referral?.title,
              organization: referral?.organization,
              type: referral?.type,
            };
          });
      else if (route === "/referrals" && request.method === "GET") {
        if (failNextList) {
          failNextList = false;
          responseCode = 503;
          message = "Fixture list failed";
        } else data = referrals;
      } else if (route === "/referrals" && request.method === "POST") {
        postRequests++;
        data = {
          ...body,
          _id: "ddddddddddddddddddddddd" + postRequests,
          authorAuthId: user.authId,
          authorName: user.name,
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        referrals.unshift(data);
      } else if (route.endsWith("/apply")) {
        applyRequests++;
        if (failNextApplication) {
          failNextApplication = false;
          responseCode = 503;
          message = "Fixture application failed. Please retry.";
        } else {
          await new Promise((resolve) => setTimeout(resolve, 200));
          data = {
            _id: "eeeeeeeeeeeeeeeeeeeee" + applications.length,
            referralId: route.split("/")[2],
            applicantAuthId: user.authId,
            name: user.name,
            email: user.email,
            note: body.note,
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          applications.push(data);
          responseCode = 201;
        }
      } else if (route.endsWith("/applications"))
        data = applications.filter(
          (item) => item.referralId === route.split("/")[2],
        );
      else if (
        route.startsWith("/referrals/applications/") &&
        request.method === "PUT"
      ) {
        data = applications.find((item) => item._id === route.split("/").pop());
        Object.assign(data, { status: body.status });
      } else if (route.startsWith("/referrals/") && request.method === "PUT") {
        editRequests++;
        if (failNextEdit) {
          failNextEdit = false;
          responseCode = 503;
          message = "Fixture edit failed. Please retry.";
        } else {
          data = referrals.find((item) => item._id === route.split("/").pop());
          Object.assign(data, body);
        }
      } else if (
        route.startsWith("/referrals/") &&
        request.method === "DELETE"
      ) {
        deleteRequests++;
        if (failNextDelete) {
          failNextDelete = false;
          responseCode = 503;
          message = "Fixture delete failed. Please retry.";
        } else {
          await new Promise(resolve => setTimeout(resolve, 150));
          const id = route.split("/").pop();
          referrals = referrals.filter((item) => item._id !== id);
          applications = applications.filter((item) => item.referralId !== id);
        }
      }
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
        JSON.stringify({ success: responseCode < 400, data, message }),
      ).toString("base64"),
    });
  } catch (error) {
    runtimeErrors.push(error.message);
    await send("Fetch.failRequest", { requestId, errorReason: "Failed" });
  }
});
const click = (label, scope = "document") =>
  evaluate(
    `Array.from(${scope}.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`,
  );
const fill = (label, value) =>
  evaluate(
    `(()=>{const field=document.querySelector('[aria-label='+${JSON.stringify(JSON.stringify(label))}+']');const prototype=field.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:field.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`,
  );
const photo = async (name, width, dark) => {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(
    await evaluate(`document.documentElement.scrollWidth<=${width + 1}`),
    true,
    `${name} page overflow`,
  );
  const dialog = await evaluate(
    `(()=>{const dialog=document.querySelector('dialog');return !dialog||dialog.scrollWidth<=dialog.clientWidth+1;})()`,
  );
  assert.equal(dialog, true, `${name} dialog overflow`);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(artifacts, name + ".png"),
    Buffer.from(shot.data, "base64"),
  );
};
const navigate = async (route) => {
  await evaluate("window.oldReferralDocument=true");
  await send("Page.navigate", { url: "http://localhost:5173" + route });
  await until(
    `!window.oldReferralDocument&&document.querySelector('[data-referral-card]')`,
  );
};
const close = () =>
  evaluate(`document.querySelector('[aria-label="Close dialog"]').click()`);
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Fetch.enable", {
    patterns: [{ urlPattern: "http://localhost:3002/api/*" }],
  });
  await send("Page.navigate", {
    url: "http://localhost:5173/student/referrals",
  });
  await until(`document.querySelectorAll('[data-referral-card]').length===3`);
  assert.equal(await evaluate(`document.querySelectorAll('.referral-card-management').length`), 0, 'Students cannot edit or delete referrals');
  assert.equal(
    await evaluate(
      `Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Share an opportunity')`,
    ),
    false,
    "Students cannot publish",
  );
  await photo("student-desktop", 1440, false);
  await photo("student-mobile-dark", 390, true);
  await photo("student-small-mobile", 320, false);
  await click(
    "Scholarships",
    `document.querySelector('nav[aria-label="Referral views"]').parentElement`,
  );
  await until(`document.querySelectorAll('[data-referral-card]').length===1`);
  assert.ok(
    await evaluate(
      `document.querySelector('[data-referral-card]').textContent.includes('Graduate Research Scholarship')`,
    ),
  );
  await click("All types");
  await until(`document.querySelectorAll('[data-referral-card]').length===3`);
  await fill("Search referrals", "no-match");
  await until(
    `document.body.textContent.includes('No matching opportunities')`,
  );
  await click("Clear filters");
  await until(`document.querySelectorAll('[data-referral-card]').length===3`);
  await click("View details", `document.querySelector('[data-referral-card]')`);
  await until(`document.querySelector('dialog')`);
  assert.equal(
    await evaluate(`document.querySelector('dialog a').href`),
    "https://example.test/careers",
  );
  await photo("student-details", 390, true);
  await close();
  await click(
    "Apply directly",
    `document.querySelector('[data-referral-card]')`,
  );
  await until(`document.querySelector('[aria-label="Application note"]')`);
  await fill(
    "Application note",
    "I enjoy building web applications and would like to join your team.",
  );
  await click("Submit application", 'document.querySelector("dialog")');
  await until(
    `document.querySelector('dialog [role="alert"]')?.textContent.includes('Fixture application failed')`,
  );
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-label="Application note"]').value`,
    ),
    "I enjoy building web applications and would like to join your team.",
  );
  await photo("application-error-mobile", 390, false);
  await evaluate(
    `(()=>{const button=document.querySelector('dialog button[type=submit]');button.click();button.click();})()`,
  );
  await until(
    `document.querySelector('dialog')?.textContent.includes('Your next step is underway.')`,
  );
  assert.equal(applyRequests, 2);
  assert.equal(applications.length, 1);
  await photo("application-confirmation", 390, true);
  await click("Done", 'document.querySelector("dialog")');
  for (const type of ["internship", "scholarship"]) {
    await evaluate(
      `Array.from(Array.from(document.querySelectorAll('[data-referral-card]')).find(card=>card.textContent.includes(${JSON.stringify(type === "internship" ? "Engineering Internship" : "Graduate Research")})).querySelectorAll('button')).find(button=>button.textContent.trim()==='Apply directly').click()`,
    );
    await until(`document.querySelector('[aria-label="Application note"]')`);
    await click("Submit application", 'document.querySelector("dialog")');
    await until(
      `document.querySelector('dialog')?.textContent.includes('Your next step is underway.')`,
    );
    await click("Done", 'document.querySelector("dialog")');
  }
  assert.equal(applications.length, 3);
  await evaluate(
    `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.includes('My applications')).click()`,
  );
  await until(`document.body.textContent.includes('Your applications')`);
  assert.equal(
    await evaluate(`document.querySelectorAll('[data-referral-card]').length`),
    3,
  );
  await photo("student-applications-mobile", 390, false);
  await navigate("/student/referrals");
  assert.equal(
    await evaluate(
      `Array.from(document.querySelectorAll('[data-referral-card] button')).filter(button=>button.textContent.includes('Apply directly')).length`,
    ),
    0,
    "Reload preserves applications",
  );
  user = alumni;
  await navigate("/alumni/referral");
  await photo("alumni-desktop", 1440, false);
  await photo("alumni-mobile-dark", 390, true);
  assert.equal(await evaluate(`document.querySelectorAll('.referral-card-management').length`), 3, 'Owners can manage their referrals');
  await click("View details", `document.querySelector('[data-referral-card]')`);
  await until(`document.querySelector('.referral-detail-management')`);
  await click("Edit referral", 'document.querySelector("dialog")');
  await until(`document.querySelector('[aria-label="Organization"]')`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Opportunity title"]').value`), referrals[0].title);
  await fill("Organization", "Campus Partners Updated");
  await click("Save changes", 'document.querySelector("dialog")');
  await until(`document.querySelector('dialog [role="alert"]')?.textContent.includes('Fixture edit failed')`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Organization"]').value`), 'Campus Partners Updated', 'Edit failure preserves input');
  await evaluate(`(()=>{const button=document.querySelector('dialog button[type=submit]');button.click();button.click();})()`);
  await until(`!document.querySelector('dialog')`);
  assert.equal(editRequests, 2, 'Retry sends one save request');
  assert.equal(referrals[0].organization, 'Campus Partners Updated');
  await click("View details", `document.querySelector('[data-referral-card]')`);
  await until(`document.querySelector('.referral-detail-management')`);
  await click("Delete referral", 'document.querySelector("dialog")');
  await until(`document.querySelector('dialog')?.textContent.includes('Delete this referral?')`);
  await click("Cancel", 'document.querySelector("dialog")');
  assert.equal(deleteRequests, 0, 'Cancel does not delete');
  assert.equal(referrals.length, 3);
  await click("Share an opportunity");
  await until(`document.querySelector('[aria-label="Opportunity title"]')`);
  await click("Scholarship", 'document.querySelector("dialog")');
  await fill("Opportunity title", "Community Leaders Scholarship");
  await fill("Organization", "Campus Foundation");
  await fill("Official opportunity link", "https://example.test/scholarships");
  await fill(
    "Opportunity details",
    "Scholarship support for students working on community projects.",
  );
  await photo("share-scholarship-mobile", 390, false);
  await evaluate(
    `(()=>{const button=document.querySelector('dialog button[type=submit]');button.click();button.click();})()`,
  );
  await until(
    `!document.querySelector('dialog')&&document.body.textContent.includes('Referral published')`,
  );
  assert.equal(postRequests, 1);
  assert.equal(referrals[0].type, "scholarship");
  await evaluate(
    `document.querySelector('[aria-label="Edit Community Leaders Scholarship"]').click()`,
  );
  await until(`document.querySelector('[aria-label="Opportunity title"]')`);
  await fill("Opportunity title", "Community Leadership Scholarship");
  await click("Save changes", 'document.querySelector("dialog")');
  await until(
    `!document.querySelector('dialog')&&document.body.textContent.includes('Referral updated.')`,
  );
  await evaluate(
    `Array.from(Array.from(document.querySelectorAll('[data-referral-card]')).find(card=>card.textContent.includes('Junior Software Developer')).querySelectorAll('button')).find(button=>button.textContent.trim()==='Applicants').click()`,
  );
  await until(
    `document.querySelector('dialog')?.textContent.includes('Alex Santos')`,
  );
  await photo("applicants-mobile-dark", 390, true);
  await fill("Status for Alex Santos", "accepted");
  await until(
    `document.querySelector('dialog')?.textContent.includes('Application status updated.')`,
  );
  assert.equal(applications[0].status, "accepted");
  await close();
  await evaluate(
    `document.querySelector('[aria-label="Delete Community Leadership Scholarship"]').click()`,
  );
  await until(`document.querySelector('dialog')`);
  await click("Delete referral", 'document.querySelector("dialog")');
  await until(`document.querySelector('dialog [role="alert"]')?.textContent.includes('Fixture delete failed')`);
  assert.ok(referrals.some(item => item.title === 'Community Leadership Scholarship'), 'Failed deletion preserves referral');
  await evaluate(`(()=>{const button=Array.from(document.querySelectorAll('dialog button')).find(button=>button.textContent.trim()==='Delete referral');button.click();button.click();})()`);
  await until(
    `!document.querySelector('dialog')&&!document.body.textContent.includes('Community Leadership Scholarship')`,
  );
  user = student;
  assert.equal(deleteRequests, 2, 'Retry sends one delete request');
  await navigate("/student/referrals");
  await evaluate(
    `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.includes('My applications')).click()`,
  );
  await until(`document.body.textContent.includes('Accepted')`);
  failNextList = true;
  await evaluate(
    `document.querySelector('[aria-label="Refresh referrals"]').click()`,
  );
  await until(
    `document.querySelector('[role="alert"]')?.textContent.includes('Some opportunities')`,
  );
  await click("Retry");
  await until(`!document.querySelector('main p[role="alert"]')`);
  user = { ...alumni, authId: '999999999999999999999999', _id: '888888888888888888888888' };
  await navigate('/alumni/referral');
  assert.equal(await evaluate(`document.querySelectorAll('.referral-card-management').length`), 0, 'Other alumni cannot manage someone else’s referrals');
  await click('View details', `document.querySelector('[data-referral-card]')`);
  await until(`document.querySelector('dialog')`);
  assert.equal(await evaluate(`!!document.querySelector('.referral-detail-management')`), false, 'Details hide management from non-owners');
  await close();
  user = { ...alumni, role: 'admin' };
  await navigate('/alumni/referral');
  assert.equal(await evaluate(`document.querySelectorAll('.referral-card-management').length`), referrals.length, 'Admins can manage all referrals');
  assert.deepEqual(runtimeErrors, []);
  console.log(
    "Passed: responsive referral design, category/search filters, safe links, student applications to all three types, failure/retry, duplicate-submit guards, persisted status, alumni publish/edit/delete, and applicant review. API fixtures only. Screenshots: " +
      artifacts,
  );
} finally {
  await send("Browser.close").catch(() => {});
  socket.close();
}
