import { certificateSvg } from '../../Server/modules/development/certificates.template.js';
// Run with isolated Edge/Chrome on port 9235. API fixtures never change real student records.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9235.
const artifacts = path.join(os.tmpdir(), 'SielAlumni-certificates-check');
await mkdir(artifacts, { recursive: true });
const target = await (await fetch('http://localhost:9235/json/new?about:blank', { method: 'PUT' })).json();
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



const student={_id:'aaaaaaaaaaaaaaaaaaaaaaaa',authId:'aaaaaaaaaaaaaaaaaaaaaaaa',name:'Alex Santos',email:'student@example.test',role:'student',program:'BS Information Technology',passwordSetupRequired:false};
const admin={...student,_id:'cccccccccccccccccccccccc',authId:'cccccccccccccccccccccccc',name:'Admin Tester',role:'admin'};
let account=student,certificates=[],failFirst=true,confirmations=0;
const attendance={_id:'dddddddddddddddddddddddd',authId:student.authId,studentName:student.name,title:'Web Accessibility Seminar',date:'2025-02-15'};
const portfolio={skills:[],projects:[],research:[],certifications:[],seminars:[],awards:[]};
const headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'http://localhost:5173'},{name:'Access-Control-Allow-Credentials',value:'true'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PUT,DELETE,OPTIONS'},{name:'Access-Control-Allow-Headers',value:'Content-Type'}];
listeners.set('Runtime.exceptionThrown',({exceptionDetails})=>runtimeErrors.push(exceptionDetails.exception?.description||exceptionDetails.text));
listeners.set('Fetch.requestPaused',async({requestId,request})=>{
 const route=new URL(request.url).pathname.replace('/api','');let data=[],responseCode=200,message;
 if(route==='/auth/me'||route==='/users/me')data=account;
 else if(route==='/development/me')data={digitalCertificates:certificates,portfolio,internships:[]};
 else if(route==='/certificates/participants')data=[{...student}];
 else if(route==='/certificates/attendance')data=certificates.length?[]:[attendance];
 else if(route==='/certificates/issued')data=certificates;
 else if(route.endsWith('/confirm')&&request.method==='POST'){
  confirmations++;
  if(failFirst){failFirst=false;responseCode=503;message='Test confirmation failure. Please retry.';}
  else {const input=JSON.parse(request.postData);certificates=[{_id:'a'.repeat(64),studentAuthId:student.authId,recipientName:student.name,title:attendance.title,activityType:input.type,participationDate:attendance.date,organizer:input.organizer,issuedAt:new Date().toISOString(),certificateNumber:'SL-1234567890ABCDEF'}];data=certificates[0];}
 }
 else if(route.endsWith('/download')&&request.method==='GET'){
  await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[...headers.filter(header=>header.name!=='Content-Type'),{name:'Content-Type',value:'image/svg+xml; charset=utf-8'}],body:Buffer.from(certificateSvg(certificates[0])).toString('base64')});return;
 }
 await send('Fetch.fulfillRequest',{requestId,responseCode,responseHeaders:headers,body:Buffer.from(JSON.stringify({success:responseCode===200,data,message})).toString('base64')});
});
const click=(label,scope='document')=>evaluate(`Array.from(${scope}.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);
const setValue=(selector,value,type='HTMLInputElement')=>evaluate(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${type}.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('${type==='HTMLSelectElement'?'change':'input'}',{bubbles:true}));})()`);
const navigate=async url=>{const loaded=new Promise(resolve=>listeners.set('Page.loadEventFired',resolve));await send('Page.navigate',{url:'http://localhost:5173'+url});await loaded;};
const photo=async(name,width,dark)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);await new Promise(r=>setTimeout(r,400));assert.equal(await evaluate(`document.documentElement.scrollWidth<=${width+1}`),true,'Overflow '+name);const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(artifacts,name+'.png'),Buffer.from(shot.data,'base64'));};
try{
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3002/api/*'}]});
 await navigate('/student/certificate');await until(`document.body.textContent.includes('No certificates issued yet')`);
 account=admin;await navigate('/admin/certificates');await until(`document.querySelector('[data-attendance]')`);
 await click('Confirm participation');await until(`document.querySelector('dialog select')`);await setValue('dialog select','seminar','HTMLSelectElement');
 await evaluate(`document.querySelector('dialog input[type=checkbox]').click()`);
 await click('Confirm & issue certificate');await until(`document.querySelector('dialog [role=alert]')`);assert.equal(certificates.length,0);
 await evaluate(`(()=>{const button=Array.from(document.querySelector('dialog').querySelectorAll('button')).find(b=>b.textContent.trim()==='Confirm & issue certificate');button.click();button.click();})()`);
 await until(`document.querySelector('dialog img')?.naturalWidth>0`);assert.equal(confirmations,2);assert.equal(certificates.length,1);
 await photo('admin-issued-certificate',1440,false);await evaluate(`document.querySelector('button[aria-label="Close dialog"]').click()`);
 assert.equal(await evaluate(`document.querySelectorAll('[data-attendance]').length`),0);
 account=student;await navigate('/student/certificate');await until(`document.querySelector('article[data-certificate]')`);
 await photo('student-certificates-desktop',1440,false);await photo('student-certificates-mobile-dark',390,true);
 await setValue('main select','training','HTMLSelectElement');await until(`document.body.textContent.includes('No matching certificates')`);
 await click('Clear filters');await until(`document.querySelector('article[data-certificate]')`);await click('View certificate');await until(`document.querySelector('dialog img')?.naturalWidth>0`);
 assert.equal(await evaluate(`document.querySelector('dialog a[download]').download`),'SL-1234567890ABCDEF.svg');
 await photo('certificate-preview-mobile',390,false);await photo('certificate-preview-desktop',1440,false);
 await evaluate(`window.__printCalls=0;window.print=()=>{window.__printCalls++;}`);await click('Print / Save as PDF');assert.equal(await evaluate('window.__printCalls'),1);
 await send('Emulation.setEmulatedMedia',{media:'print'});assert.equal(await evaluate(`getComputedStyle(document.querySelector('#root')).display`),'none');
 const pdf=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});const buffer=Buffer.from(pdf.data,'base64');
 await writeFile(path.join(artifacts,'digital-certificate.pdf'),buffer);await writeFile(path.join(artifacts,'digital-certificate.svg'),certificateSvg(certificates[0]));
 const media=buffer.toString('latin1').match(/\/MediaBox\s*\[\s*0\s*0\s*([\d.]+)\s*([\d.]+)\s*\]/);assert.ok(media&&Number(media[1])>Number(media[2]),'Landscape print output');assert.equal((buffer.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1);
 await send('Emulation.setEmulatedMedia',{media:''});await evaluate(`document.querySelector('button[aria-label="Close dialog"]').click()`);
 await navigate('/student/portfolio');await until(`document.querySelector('main .portfolio-resume')?.textContent.includes('Web Accessibility Seminar')`);await click('Edit details');await until(`document.querySelector('#digital-certificates')?.textContent.includes('Web Accessibility Seminar')`);
 assert.deepEqual(runtimeErrors,[]);console.log('Passed: confirmed attendance auto-issuance, failure/retry and double-submit guard, student collection, activity filters, SVG preview/download, one-page landscape PDF, and automatic portfolio/resume inclusion. Mock APIs only. Artifacts: '+artifacts);
}finally{await send('Browser.close').catch(()=>{});socket.close();}
