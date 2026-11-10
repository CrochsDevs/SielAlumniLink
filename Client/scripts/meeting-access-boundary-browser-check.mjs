// Run with isolated Edge/Chrome on port 9235. API fixtures never change real records.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9235.
const artifacts = path.join(os.tmpdir(), "SielAlumni-event-cards-check");
await mkdir(artifacts, { recursive: true });
const target = await (
  await fetch("http://localhost:9235/json/new?about:blank", { method: "PUT" })
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
  } else {
    const pending = listeners.get(message.method)?.(message.params);
    pending?.catch(error => {
      // Closing/replacing a preview aborts its request, invalidating the mock
      // interception before the fixture response can be delivered.
      if (error.message !== 'Invalid InterceptionId.') runtimeErrors.push(error.message);
    });
  }
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
  throw new Error(`UI wait failed: ${expression}\n${await evaluate('document.body.innerText')}\n${runtimeErrors.join('\n')}`);
};

const origin='http://localhost:5180';let role='student';let opensAt=Date.now()+4000;let refreshes=0;
const fixture=()=>({_id:'b'.repeat(24),title:'Opening boundary test',organizer:'CLSU',deliveryMode:'online',activityType:'seminar',startAt:new Date(opensAt+15*60000).toISOString(),endAt:new Date(opensAt+75*60000).toISOString(),registration:{name:'Registered Tester'},registrationWindow:{state:'open'},meetingAccess:{state:Date.now()<opensAt?'upcoming':'open',opensAt:new Date(opensAt).toISOString(),earlyAccessMinutes:15}});
const headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:origin},{name:'Access-Control-Allow-Credentials',value:'true'},{name:'Access-Control-Allow-Headers',value:'Content-Type, X-Account-Id'}];
listeners.set('Fetch.requestPaused',async({requestId,request})=>{
  const route=new URL(request.url).pathname.replace('/api','');let data=[];
  if(['/auth/me','/users/me'].includes(route))data={_id:'a'.repeat(24),authId:'a'.repeat(24),name:'Opening Tester',role,passwordSetupRequired:false};
  else if(route==='/events')data=[fixture()];
  else if(route.startsWith('/events/')){refreshes++;data=fixture();}
  else if(route==='/tracer/access')data={updateRequired:false,quarter:'2026-Q4',nextUpdateAt:'2099-01-01'};
  await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:headers,body:Buffer.from(JSON.stringify({success:true,data})).toString('base64')});
});
try{
  await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3002/api/*'}]});
  for(const audience of ['student','alumni']){
    role=audience;opensAt=Date.now()+4000;refreshes=0;
    await send('Page.navigate',{url:`${origin}/activities`});
    await until(`document.body.textContent.includes('Meeting not available yet')`);
    assert.equal(await evaluate(`!!document.querySelector('a[href^="/meetings/"]')`),false,'Locked before opening');
    const started=Date.now();
    await until(`!!document.querySelector('a[href^="/meetings/"]')`);
    assert.ok(Date.now()<opensAt+2000,'Opens at boundary instead of 15-second poll');
    assert.ok(refreshes>0,'Revalidated single event with API');
    console.log({role,waitMs:Date.now()-started,refreshes});
  }
  console.log('Passed: student/alumni links remain locked before the 15-minute boundary and revalidate with server immediately when access opens.');
}finally{await send('Browser.close').catch(()=>{});socket.close();}

