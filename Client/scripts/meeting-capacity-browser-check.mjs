// Run with isolated Edge/Chrome on port 9235. API fixtures never change real student records.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9235.
const artifacts = path.join(os.tmpdir(), "SielAlumni-meeting-chat-check");
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

const origin='http://localhost:5180';const eventId='b'.repeat(24);
const headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:origin},{name:'Access-Control-Allow-Credentials',value:'true'},{name:'Access-Control-Allow-Headers',value:'Content-Type, X-Account-Id'},{name:'Access-Control-Allow-Methods',value:'GET, POST, OPTIONS'}];
listeners.set('Fetch.requestPaused',async({requestId,request})=>{
  const route=new URL(request.url).pathname.replace('/api','');let data=[];
  if(['/auth/me','/users/me'].includes(route))data={_id:'a'.repeat(24),authId:'a'.repeat(24),name:'Host Tester',role:'admin',passwordSetupRequired:false};
  else if(route==='/meetings/config')data={iceServers:[]};
  else if(route===`/meetings/${eventId}`)data={event:{_id:eventId,title:'100 participant layout check',startAt:new Date().toISOString(),deliveryMode:'online'},meeting:{state:'active'},capacity:100};
  await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:headers,body:Buffer.from(JSON.stringify({success:true,data})).toString('base64')});
});
try{
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3002/api/*'}]});
  await send('Page.navigate',{url:`${origin}/meetings/${eventId}`});
  await until(`document.querySelector('.meeting-join-card')`);
  await evaluate(`(async()=>{const {getSocket}=await import('/src/realtime/socket.js');const socket=getSocket();socket.connected=true;socket.emit=()=>socket;socket.timeout=()=>({emit:(event,input,callback)=>callback(null,{success:true,data:{self:{id:'self',name:'Host Tester',host:true},peers:[],messages:[]}})});window.__meetingSocket=socket;Array.from(document.querySelectorAll('.meeting-join-card button')).find(button=>button.textContent.trim()==='Join as host').click();})()`);
  await until(`document.querySelector('.meeting-room.is-joined')`);
  const start=performance.now();
  await evaluate(`(()=>{for(let i=1;i<100;i++)window.__meetingSocket.emitEvent(['meeting:peer-joined',{id:'load-'+i,name:'Participant '+i,mic:false,camera:false,sharing:false}]);})()`);
  await until(`document.querySelectorAll('[data-meeting-peer]').length===100`);
  const renderMs=performance.now()-start;
  for(const width of [1440,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<640});
    const result=await evaluate(`(()=>{const g=document.querySelector('.meeting-gallery');return {count:g.children.length,minTileHeight:Math.min(...Array.from(g.children).map(c=>c.getBoundingClientRect().height)),scrolls:g.scrollHeight>g.clientHeight,bodyOverflow:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1};})()`);
    assert.equal(result.count,100);assert.ok(result.minTileHeight>=119,JSON.stringify(result));assert.equal(result.scrolls,true);assert.equal(result.bodyOverflow,false);
    console.log({width,renderMs,result});
  }
  console.log('Passed: 100 participant tiles stay readable in an internal scroller; meeting fits desktop/mobile. Mock signaling only, no video traffic.');
}finally{await send('Browser.close').catch(()=>{});socket.close();}
