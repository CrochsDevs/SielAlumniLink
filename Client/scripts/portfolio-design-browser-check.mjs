// Run with isolated Edge/Chrome on port 9231. API fixtures never change real student records.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9231.
const artifacts = path.join(os.tmpdir(), "SielAlumni-portfolio-design-check");
await mkdir(artifacts, { recursive: true });
const target = await (
  await fetch("http://localhost:9231/json/new?about:blank", { method: "PUT" })
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

const user = {
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  authId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Alex Santos",
  email: "alex@example.test",
  role: "student",
  program: "BS Information Technology",
  contactNumber: "0912 345 6789",
  location: "Nueva Ecija",
  bio: "Information technology student interested in building accessible web applications.",
  passwordSetupRequired: false,
};
const portfolio = {
  skills: ["JavaScript", "React", "Communication"],
  projects: [
    {
      title: "Campus Event Portal",
      desc: "Designed and built an event registration platform using React. Collaborated with a team of four to simplify registration.",
    },
  ],
  research: [],
  certifications: ["AWS Cloud Practitioner - 2026"],
  seminars: ["Web Accessibility Workshop - 2026"],
  awards: ["Dean List - 2025"],
};
const internships = [
  {
    company: "Campus Technology Office",
    startDate: "2026-01-05",
    endDate: "2026-04-10",
    hoursCompleted: 300,
    completed: true,
  },
];
listeners.set("Runtime.exceptionThrown", ({ exceptionDetails }) =>
  runtimeErrors.push(
    exceptionDetails.exception?.description || exceptionDetails.text,
  ),
);
listeners.set("Fetch.requestPaused", async ({ requestId, request }) => {
  const route = new URL(request.url).pathname.replace("/api", "");
  let data = [];
  if (route === "/auth/me" || route === "/users/me") {
    if (request.method === "PUT")
      Object.assign(user, JSON.parse(request.postData));
    data = user;
  } else if (route.startsWith("/development")) {
    if (request.method === "PUT")
      portfolio[route.split("/").at(-1)] = JSON.parse(request.postData).entries;
    data = { portfolio, internships };
  }
  await send("Fetch.fulfillRequest", {
    requestId,
    responseCode: 200,
    responseHeaders: [
      { name: "Content-Type", value: "application/json" },
      { name: "Access-Control-Allow-Origin", value: "http://localhost:5173" },
      { name: "Access-Control-Allow-Credentials", value: "true" },
      { name: "Access-Control-Allow-Methods", value: "GET,PUT,OPTIONS" },
      { name: "Access-Control-Allow-Headers", value: "Content-Type" },
    ],
    body: Buffer.from(JSON.stringify({ success: true, data })).toString(
      "base64",
    ),
  });
});
const click = (label) =>
  evaluate(
    `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`,
  );
const setValue = (value) =>
  evaluate(
    `(()=>{const input=document.querySelector('dialog input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
const photo = async (name, width, dark) => {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(
    await evaluate(`document.documentElement.scrollWidth<=${width + 1}`),
    true,
    "Page overflow",
  );
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(artifacts, name + ".png"),
    Buffer.from(shot.data, "base64"),
  );
};
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Fetch.enable", {
    patterns: [{ urlPattern: "http://localhost:3002/api/*" }],
  });
  await send("Page.navigate", {
    url: "http://localhost:5173/student/portfolio",
  });
  await until(
    `document.querySelector('main .portfolio-resume')?.textContent.includes('JavaScript')`,
  );
  await photo("portfolio-desktop", 1440, false);
  await photo("portfolio-mobile-dark", 390, true);
  await click("Edit details");
  await until(`document.querySelector('#skills')`);
  await evaluate(
    `document.querySelector('button[aria-label="Add skill"]').click()`,
  );
  await until(`document.querySelector('dialog input')`);
  await setValue("TypeScript");
  await click("Save entry");
  await until(`!document.querySelector('dialog')`);
  assert.ok(portfolio.skills.includes("TypeScript"));
  await evaluate(
    `document.querySelector('button[aria-label="Edit TypeScript"]').click()`,
  );
  await until(`document.querySelector('dialog input')`);
  await setValue("TypeScript Development");
  await click("Save entry");
  await until(`!document.querySelector('dialog')`);
  assert.ok(portfolio.skills.includes("TypeScript Development"));
  await evaluate(
    `document.querySelector('button[aria-label="Remove TypeScript Development"]').click()`,
  );
  await click("Remove entry");
  await until(`!document.querySelector('dialog')`);
  assert.equal(portfolio.skills.length, 3);
  await click("Edit about");
  await until(`document.querySelector('dialog textarea')`);
  await evaluate(
    `(()=>{const field=document.querySelector('dialog textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'Student developer seeking opportunities in accessible web design.');field.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click("Save about");
  await until(`!document.querySelector('dialog')`);
  assert.equal(
    user.bio,
    "Student developer seeking opportunities in accessible web design.",
  );
  await click("Preview resume");
  await until(`document.querySelector('dialog .portfolio-resume')`);
  await photo("resume-mobile", 390, false);
  await photo("resume-desktop", 1440, false);
  for (const theme of ["classic", "modern", "professional", "minimal"]) {
    await evaluate(
      `document.querySelector('dialog input[value="${theme}"]').closest('label').click()`,
    );
    await until(
      `document.querySelector('dialog .portfolio-resume').dataset.resumeTheme==='${theme}'`,
    );
    assert.equal(
      await evaluate(
        `document.querySelector('.student-resume-print .portfolio-resume').dataset.resumeTheme`,
      ),
      theme,
    );
    if (theme === "professional") {
      assert.equal(
        await evaluate(
          `getComputedStyle(document.querySelector('dialog .portfolio-resume')).display`,
        ),
        "grid",
      );
      assert.equal(
        await evaluate(
          `getComputedStyle(document.querySelector('dialog .resume-sidebar')).backgroundColor`,
        ),
        "rgb(41, 62, 78)",
      );
      await photo("professional-desktop", 1440, false);
      await photo("professional-mobile", 390, false);
      assert.equal(
        await evaluate(
          `getComputedStyle(document.querySelector('dialog .portfolio-resume')).gridTemplateColumns.split(' ').length`,
        ),
        2,
      );
      await photo("professional-desktop-dark", 1440, true);
      await send("Emulation.setEmulatedMedia", { media: "print" });
      assert.equal(
        await evaluate(
          `getComputedStyle(document.querySelector('.student-resume-print .portfolio-resume')).gridTemplateColumns.split(' ').length`,
        ),
        2,
      );
      const themedPdf = await send("Page.printToPDF", {
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
      });
      await writeFile(
        path.join(artifacts, "professional-resume.pdf"),
        Buffer.from(themedPdf.data, "base64"),
      );
      await send("Emulation.setEmulatedMedia", { media: "" });
    }
  }
  assert.ok(
    await evaluate(
      `document.querySelector('dialog .portfolio-resume').textContent.includes('Campus Event Portal')`,
    ),
  );
  assert.equal(
    await evaluate(
      `document.querySelector('dialog .portfolio-resume').textContent.includes('Research')`,
    ),
    false,
  );
  await evaluate(
    `window.__printCalls=0; window.print=()=>{window.__printCalls++;}`,
  );
  await click("Print / Save as PDF");
  assert.equal(await evaluate("window.__printCalls"), 1);
  await send("Emulation.setEmulatedMedia", { media: "print" });
  assert.equal(
    await evaluate(`getComputedStyle(document.querySelector('#root')).display`),
    "none",
  );
  assert.equal(
    await evaluate(
      `getComputedStyle(document.querySelector('.student-resume-print')).display`,
    ),
    "block",
  );
  const pdf = await send("Page.printToPDF", {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
  });
  await writeFile(
    path.join(artifacts, "student-resume.pdf"),
    Buffer.from(pdf.data, "base64"),
  );
  await send("Emulation.setEmulatedMedia", { media: "" });
  await click("Close dialog").catch(() =>
    evaluate(
      `document.querySelector('button[aria-label="Close dialog"]').click()`,
    ),
  );
  await send("Page.reload");
  await until(
    `document.querySelector('main .portfolio-resume')?.textContent.includes('JavaScript')`,
  );
  assert.equal(
    await evaluate(
      `document.querySelector('main .portfolio-resume').dataset.resumeTheme`,
    ),
    "minimal",
  );
  assert.ok(
    await evaluate(
      `document.querySelector('main .portfolio-resume').textContent.includes('Student developer seeking opportunities in accessible web design.')`,
    ),
  );
  await evaluate(
    `localStorage.setItem('portfolio-resume-theme:${user.authId}', 'sidebar')`,
  );
  await send("Page.reload");
  await until(
    `document.querySelector('main .portfolio-resume')?.dataset.resumeTheme==='professional'`,
  );
  assert.equal(
    await evaluate(
      `document.querySelector('main input[value="professional"]').checked`,
    ),
    true,
  );
  await evaluate(
    `document.querySelector('main input[value="classic"]').closest('label').click()`,
  );
  await until(
    `document.querySelector('main .portfolio-resume')?.dataset.resumeTheme==='classic'`,
  );
  await evaluate(
    `document.querySelector('main input[value="professional"]').closest('label').click()`,
  );
  await until(
    `document.querySelector('main .portfolio-resume')?.dataset.resumeTheme==='professional'`,
  );
  await photo("professional-live-page", 1440, false);
  assert.deepEqual(runtimeErrors, []);
  console.log(
    "Passed: portfolio add/edit/delete and reload; responsive light/dark layouts; saved resume content and empty section omission; print action, isolated print styles, and PDF generation. Fixtures only. Artifacts: " +
      artifacts,
  );
} finally {
  await send("Browser.close").catch(() => {});
  socket.close();
}
