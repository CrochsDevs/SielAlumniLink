import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Isolated Edge/Chrome on port 9231. All API responses are fixtures;
// no application accounts, posts, or moderation settings are changed.
const artifacts = path.join(os.tmpdir(), "SielAlumni-community-status-check");
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
  if (!message.id) {
    listeners.get(message.method)?.(message.params);
    return;
  }
  const request = waiting.get(message.id);
  if (!request) return;
  clearTimeout(request.timeout);
  waiting.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
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


try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://localhost:5173/login' });
  await until('document.querySelector("#root")');
  await evaluate(`(async () => {
    const ReactModule = await import('/node_modules/.vite/deps/react.js'); const React = ReactModule.default || ReactModule;
    const DomModule = await import('/node_modules/.vite/deps/react-dom_client.js'); const { createRoot } = DomModule.default || DomModule;
    const { PageSkeleton } = await import('/src/components/ui/Skeleton.jsx');
    const host = document.createElement('div'); host.id = 'loading-preview';
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:auto'; document.body.append(host);
    const root = createRoot(host);
    window.renderLoading = path => root.render(React.createElement(PageSkeleton, { pathname:path }));
  })()`);
  for (const role of ['admin','student','alumni']) {
    for (const page of ['', '/events', '/message', '/settings']) {
      await evaluate(`window.renderLoading('/${role}${page}')`);
      await until('document.querySelector("#loading-preview [role=status]")');
      assert.equal(await evaluate('document.querySelectorAll("#loading-preview [role=status]").length'), 1);
      for (const width of [390,1440]) {
        await send('Emulation.setDeviceMetricsOverride', { width,height:900,deviceScaleFactor:1,mobile:width<768 });
        for (const dark of [false,true]) {
          await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
          assert.equal(await evaluate('document.querySelector("#loading-preview").scrollWidth <= innerWidth'),true);
        }
      }
    }
  }
  await send('Emulation.setEmulatedMedia', { features: [{name:'prefers-reduced-motion',value:'reduce'}] });
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#loading-preview .siel-skeleton"),"::after").animationName'),'none');
  console.log('PASS: admin, student, alumni loading layouts; mobile/desktop; light/dark; one accessible status; reduced motion');
} finally { await send('Page.close'); socket.close(); }
