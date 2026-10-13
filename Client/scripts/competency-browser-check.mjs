import { competencySnapshot, validateCompetency, validateMentorEvaluation } from '../../Server/modules/development/competency.policy.js';
// Run with isolated Edge/Chrome on port 9234. API fixtures never change real student records.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9234.
const artifacts = path.join(os.tmpdir(), 'SielAlumni-competency-check');
await mkdir(artifacts, { recursive: true });
const target = await (await fetch('http://localhost:9234/json/new?about:blank', { method: 'PUT' })).json();
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



const user={_id:'aaaaaaaaaaaaaaaaaaaaaaaa',authId:'aaaaaaaaaaaaaaaaaaaaaaaa',name:'Alex Santos',email:'alex@example.test',role:'student',program:'BS Information Technology',passwordSetupRequired:false};
const record={assessments:{}};
const mentor={...user,_id:'cccccccccccccccccccccccc',authId:'cccccccccccccccccccccccc',name:'Alumni Mentor',role:'alumni'};
let account=user;let mentorEvaluations=[];
let failSave=true, saves=0;
const snapshot=()=>({competencies:competencySnapshot(record,mentorEvaluations),portfolio:{projects:[{title:'Campus Portal'}],certifications:['Training'],research:[]}});
listeners.set('Runtime.exceptionThrown',({exceptionDetails})=>runtimeErrors.push(exceptionDetails.exception?.description||exceptionDetails.text));
listeners.set('Fetch.requestPaused',async({requestId,request})=>{
 const route=new URL(request.url).pathname.replace('/api','');let data=[],responseCode=200,message;
 if(route==='/auth/me'||route==='/users/me') data=account;
 else if(route==='/development/mentees')data=[{authId:user.authId,name:user.name,program:user.program,email:user.email}];
 else if(route.startsWith('/development/mentees/')) {
  if(request.method==='PUT')mentorEvaluations=[{_id:'evaluation',studentAuthId:user.authId,mentorAuthId:mentor.authId,mentorName:mentor.name,competencyKey:route.split('/').at(-1),...validateMentorEvaluation(route.split('/').at(-1),JSON.parse(request.postData)),updatedAt:new Date().toISOString()}];
  data={student:{authId:user.authId,name:user.name,program:user.program},competencies:competencySnapshot(record,mentorEvaluations),portfolio:snapshot().portfolio};
 }
 else if(route.startsWith('/development')) {
  if(request.method==='PUT') {
   saves++;
   if(failSave){failSave=false;responseCode=503;message='Test save failure. Please retry.';}
   else {record.assessments[route.split('/').at(-1)]={...validateCompetency(route.split('/').at(-1),JSON.parse(request.postData)),updatedAt:new Date().toISOString()};record.updatedAt=new Date().toISOString();}
  }
  if(request.method==='DELETE')delete record.assessments[route.split('/').at(-1)];
  data=snapshot();
 }
 await send('Fetch.fulfillRequest',{requestId,responseCode,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'http://localhost:5173'},{name:'Access-Control-Allow-Credentials',value:'true'},{name:'Access-Control-Allow-Methods',value:'GET,PUT,DELETE,OPTIONS'},{name:'Access-Control-Allow-Headers',value:'Content-Type'}],body:Buffer.from(JSON.stringify({success:responseCode===200,data,message})).toString('base64')});
});
const click=async(label,scope='document')=>evaluate(`Array.from(${scope}.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);
const setValue=(selector,value,type='HTMLInputElement')=>evaluate(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${type}.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('${type==='HTMLSelectElement'?'change':'input'}',{bubbles:true}));})()`);
const photo=async(name,width,dark)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);await new Promise(r=>setTimeout(r,400));assert.equal(await evaluate(`document.documentElement.scrollWidth<=${width+1}`),true,'Overflow '+name);const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(artifacts,name+'.png'),Buffer.from(shot.data,'base64'));};
try{
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3002/api/*'}]});
 await send('Page.navigate',{url:'http://localhost:5173/student/competency'});
 await until(`document.querySelectorAll('article[data-competency]').length===3`);
 await photo('competency-desktop',1440,false);await photo('competency-mobile-dark',390,true);
 await click('Assess skill',`document.querySelector('[data-competency="communication"]')`);
 await until(`document.querySelector('dialog input[value="2"]')`);
 await evaluate(`document.querySelector('dialog input[value="2"]').click()`);
 await setValue('dialog textarea','Presented a class project to 30 students.','HTMLTextAreaElement');
 await setValue('dialog textarea[placeholder="A specific step you will take to develop this skill."]','Practice explaining my project without notes.','HTMLTextAreaElement');
 await click('Save assessment');await until(`document.querySelector('dialog [role=alert]')`);assert.equal(record.assessments.communication,undefined);
 await click('Save assessment');await until(`!document.querySelector('dialog')`);assert.equal(record.assessments.communication.rating,2);assert.equal(saves,2);
 assert.ok(await evaluate(`document.querySelector('[data-competency="communication"]').textContent.includes('Presented a class project')`));
 await setValue('main select','focus','HTMLSelectElement');await until(`document.querySelectorAll('article[data-competency]').length===1`);
 await click('Clear filters');await click('Technical');await until(`document.querySelectorAll('article[data-competency]').length===1`);
 await click('Clear filters');await setValue('main input[type=search]','Communication');await until(`document.querySelectorAll('article[data-competency]').length===1`);
 await photo('competency-assessed-mobile',390,false);await click('Clear filters');
 const reloaded=new Promise(resolve=>listeners.set('Page.loadEventFired',resolve));await send('Page.reload');await reloaded;await until(`document.querySelector('[data-competency="communication"]')?.textContent.includes('Practice explaining')`);
 await click('Update assessment',`document.querySelector('[data-competency="communication"]')`);await until(`document.querySelector('dialog input[value="4"]')`);
 await evaluate(`document.querySelector('dialog input[value="4"]').click()`);await until(`document.querySelector('dialog select').value==='4'`);
 await click('Save assessment');await until(`!document.querySelector('dialog')`);assert.equal(record.assessments.communication.rating,4);assert.equal(record.assessments.communication.target,4);
 await click('Reset',`document.querySelector('[data-competency="communication"]')`);await until(`document.querySelector('dialog')`);await click('Reset assessment');await until(`!document.querySelector('dialog')`);
 assert.equal(record.assessments.communication,undefined);
 account=mentor;await send('Page.navigate',{url:'http://localhost:5173/alumni/mentorship'});
 await until(`document.querySelector('[data-mentor-competency="technical"]')`);
 await photo('mentor-evaluations-desktop',1440,false);
 await click('Evaluate skill',`document.querySelector('[data-mentor-competency="technical"]')`);await until(`document.querySelector('dialog select')`);
 await setValue('dialog select','2','HTMLSelectElement');await setValue('dialog textarea','Practice debugging independently and explain the result.','HTMLTextAreaElement');
 await click('Save evaluation');await until(`!document.querySelector('dialog')`);assert.equal(mentorEvaluations[0].rating,2);
 await until(`document.querySelector('[data-mentor-competency="technical"]').textContent.includes('Practice debugging independently')`);
 await click('Evaluate skill',`document.querySelector('[data-mentor-competency="technical"]')`);await until(`document.querySelector('dialog textarea')`);
 assert.equal(await evaluate(`document.querySelector('dialog textarea').value`),'Practice debugging independently and explain the result.');await click('Cancel',`document.querySelector('dialog')`);
 account=user;await send('Page.navigate',{url:'http://localhost:5173/student/competency'});
 await until(`document.querySelector('[data-competency="technical"]')?.textContent.includes('Practice debugging independently')`);
 assert.ok(await evaluate(`document.querySelector('[data-competency="technical"]').textContent.includes('Skill gap: 1 level.')`));
 await photo('student-mentor-feedback',1440,false);await photo('student-mentor-feedback-mobile',390,true);
 await click('Assess skill',`document.querySelector('[data-competency="technical"]')`);await until(`document.querySelector('dialog input[value="4"]')`);
 await evaluate(`document.querySelector('dialog input[value="4"]').click()`);await click('Save assessment');await until(`!document.querySelector('dialog')`);
 assert.equal(record.assessments.technical.rating,4);assert.equal(mentorEvaluations[0].rating,2);
 await until(`document.querySelector('[data-competency="technical"]').textContent.includes('Skill gap: 2 levels.')`);
 assert.deepEqual(runtimeErrors,[]);
 console.log('Passed: protected competency route, save failure/retry, saved evidence and goals, filters/search, reload, rating/target update, reset, desktop/mobile and dark mode. Includes mentor evaluations, student feedback and automatic gaps. Mock APIs only. Artifacts: '+artifacts);
}finally{await send('Browser.close').catch(()=>{});socket.close();}
