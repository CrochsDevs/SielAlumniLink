// Run with isolated Edge/Chrome on port 9230. API fixtures never change real student records.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9230.
const artifacts = path.join(os.tmpdir(), 'SielAlumni-career-design-check');
await mkdir(artifacts, { recursive: true });
const target = await (await fetch('http://localhost:9230/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const waiting = new Map();
const listeners = new Map();
const runtimeErrors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timeout = setTimeout(() => { waiting.delete(id); reject(new Error(`Timeout: ${method}`)); }, 15000);
  waiting.set(id, { resolve, reject, timeout });
  socket.send(JSON.stringify({ id, method, params }));
});
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const request = waiting.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout); waiting.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  } else listeners.get(message.method)?.(message.params);
};
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const until = async expression => {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`UI wait failed: ${expression}`);
};


const job = { _id:'ffffffffffffffffffffffff', title:'Junior Software Developer', company:'Campus Technology Partners', location:'Science City of Munoz, Nueva Ecija', type:'Full-time', mode:'Hybrid', isActive:true, description:'Build useful software with a collaborative engineering team.\n\nWhat you will do\nDevelop web applications, collaborate with designers, and help maintain reliable services.\n\nWhat we are looking for\nExperience with JavaScript and React, a willingness to learn, and strong communication skills.', tags:['React', 'JavaScript', 'Teamwork'] };
const user = {_id:'aaaaaaaaaaaaaaaaaaaaaaaa', authId:'aaaaaaaaaaaaaaaaaaaaaaaa', name:'Alex Santos', email:'alex@example.test', role:'alumni', program:'BS Information Technology', batch:'2025', passwordSetupRequired:false};
let applications = [];
listeners.set('Runtime.exceptionThrown', ({exceptionDetails})=>runtimeErrors.push(exceptionDetails.text));
listeners.set('Fetch.requestPaused', async ({requestId,request}) => {
 const route=new URL(request.url).pathname.replace('/api','');
 let data=[];
 if(route==='/auth/me'||route==='/users/me') data=user;
 else if(route==='/jobs') data=[job];
 else if(route===`/jobs/${job._id}`) data=job;
 else if(route==='/jobs/applications/me') data=applications;
 else if(route.endsWith('/apply') && request.method==='POST') { data={_id:'app1',jobId:job._id,createdAt:new Date().toISOString()};applications=[data]; }
 await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'http://localhost:5173'},{name:'Access-Control-Allow-Credentials',value:'true'},{name:'Access-Control-Allow-Methods',value:'GET,POST,OPTIONS'},{name:'Access-Control-Allow-Headers',value:'Content-Type'}],body:Buffer.from(JSON.stringify({success:true,data})).toString('base64')});
});
const click = label => evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);
const photo=async(name,width,dark)=>{
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});
 await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
 await new Promise(resolve=>setTimeout(resolve,100));
 assert.equal(await evaluate(`document.documentElement.scrollWidth<=${width+1}`),true,'Page overflow');
 assert.equal(await evaluate(`(()=>{const d=document.querySelector('dialog');return d.scrollWidth<=d.clientWidth+1;})()`),true,'Dialog overflow');
 const shot=await send('Page.captureScreenshot',{format:'png'});
 await writeFile(path.join(artifacts,name+'.png'),Buffer.from(shot.data,'base64'));
};
try {
 await send('Page.enable'); await send('Runtime.enable'); await send('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3002/api/*'}]});
 await send('Page.navigate',{url:'http://localhost:5173/alumni/career'});
 await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Apply')`);
 await click('Apply'); await until(`document.querySelector('dialog')?.textContent.includes('About the role')`);
 await photo('details-desktop',1440,false);
 await photo('details-mobile-dark',390,true);
 await click('Apply now'); await until(`document.querySelector('input[type=file]')`);
 await photo('application-mobile',390,false);
 await photo('application-desktop',1440,false);
 await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.7 resume'], 'Alex-Santos-Resume.pdf',{type:'application/pdf'}));const input=document.querySelector('input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await until(`document.body.textContent.includes('Ready to submit')`);
 await photo('application-selected-dark',1440,true);
 await click('Back to details'); await click('Apply now');
 assert.ok(await evaluate(`document.body.textContent.includes('Alex-Santos-Resume.pdf')`));
 await click('Submit application'); await until(`document.body.textContent.includes('You have taken the next step.')`);
 await photo('confirmation-mobile',390,false);
 assert.equal(applications.length,1); assert.deepEqual(runtimeErrors,[]);
 console.log('Passed: details, resume selection, back navigation preserves file, submission confirmation, and mobile/desktop overflow checks. API fixtures only. Screenshots: '+artifacts);
} finally { await send('Browser.close').catch(()=>{}); socket.close(); }
