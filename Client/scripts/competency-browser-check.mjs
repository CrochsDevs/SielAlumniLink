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
const other={...user,_id:'bbbbbbbbbbbbbbbbbbbbbbbb',authId:'bbbbbbbbbbbbbbbbbbbbbbbb',name:'Jamie Cruz',email:'jamie@example.test',program:'BS Business Administration'};
const otherRecord={assessments:{technical:{rating:3,target:4,evidence:'Built a budget spreadsheet.',goal:'Improve formula auditing.'}}};
const record={assessments:{}};
const mentor={...user,_id:'cccccccccccccccccccccccc',authId:'cccccccccccccccccccccccc',name:'Alumni Mentor',role:'alumni'};
let account=user;let mentorEvaluations=[];
let failSave=true, saves=0, openedStudentEmail='',failMentorSave=true,mentorSaves=0;
const studentSnapshot=student=>({competencies:competencySnapshot(student.authId===user.authId?record:otherRecord,mentorEvaluations.filter(evaluation=>evaluation.studentAuthId===student.authId)),portfolio:{projects:[{title:student.authId===user.authId?'Campus Portal':'Budget Spreadsheet'}],certifications:['Training'],research:[]}});
const snapshot=()=>studentSnapshot(user);
listeners.set('Runtime.exceptionThrown',({exceptionDetails})=>runtimeErrors.push(exceptionDetails.exception?.description||exceptionDetails.text));
listeners.set('Fetch.requestPaused',async({requestId,request})=>{
 const route=new URL(request.url).pathname.replace('/api','');let data=[],responseCode=200,message;
 if(route==='/auth/me'||route==='/users/me') data=account;
 else if(route==='/conversations'&&request.method==='POST') {openedStudentEmail=JSON.parse(request.postData).email;data={_id:'mentor-student-chat',name:user.name,email:user.email,role:'student',unread:0,preview:''};}
 else if(route==='/development/mentees')data=[user,other];
 else if(route.startsWith('/development/mentees/')) {
  const student=[user,other].find(student=>student.authId===route.split('/')[3]);
  if(!student){responseCode=403;message='You can only evaluate students with an accepted mentorship connection.';}
  else{
   if(request.method==='PUT'){
    mentorSaves++;
    if(failMentorSave){failMentorSave=false;responseCode=503;message='Test evaluation failure. Please retry.';}
    else{const key=route.split('/').at(-1);mentorEvaluations=[...mentorEvaluations.filter(evaluation=>!(evaluation.studentAuthId===student.authId&&evaluation.competencyKey===key)),{_id:student.authId+'-'+key,studentAuthId:student.authId,mentorAuthId:mentor.authId,mentorName:mentor.name,competencyKey:key,...validateMentorEvaluation(key,JSON.parse(request.postData)),updatedAt:new Date().toISOString()}];}
   }
   data={student,...studentSnapshot(student)};
  }
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
 await send('Fetch.fulfillRequest',{requestId,responseCode,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'http://localhost:5173'},{name:'Access-Control-Allow-Credentials',value:'true'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PUT,DELETE,OPTIONS'},{name:'Access-Control-Allow-Headers',value:'Content-Type'}],body:Buffer.from(JSON.stringify({success:responseCode===200,data,message})).toString('base64')});
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
 await until(`document.querySelector('[data-mentee]')`);
 assert.ok(await evaluate(`document.querySelector('main h1').textContent.includes('Mentor dashboard')`));
 assert.equal(await evaluate(`document.body.textContent.includes('Find alumni to connect with and learn from.')`),false);
 await photo('alumni-mentor-dashboard-desktop',1440,false);await photo('alumni-mentor-dashboard-mobile',390,true);
 await setValue('main input[type=search]','Missing student');await until(`document.body.textContent.includes('No students match your search.')`);
 await click('Clear search');await until(`document.querySelector('[data-mentee]')`);
 assert.equal(await evaluate(`document.querySelector('[data-evaluate-student]')===null`),true,'My mentee is for messaging only');
 await click('Message Mentee',`document.querySelector('[data-mentee="${user.authId}"]')`);await until(`document.querySelector('[aria-label="Close chat"]')`);
 assert.equal(openedStudentEmail,user.email);await evaluate(`document.querySelector('[aria-label="Close chat"]').click()`);
 await click('Skill evaluations');assert.equal(await evaluate(`document.querySelector('[data-mentor-competency]')===null`),true);
 assert.equal(await evaluate(`Array.from(document.querySelectorAll('[data-mentee] button')).some(button=>button.textContent.includes('Message'))`),false,'Skill evaluations offers the evaluation action only');
 await evaluate(`document.querySelector('[data-evaluate-student="${user.authId}"]').click()`);
 await until(`document.querySelector('[data-mentor-competency="technical"]')`);
 assert.equal(await evaluate(`location.pathname`),`/alumni/mentorship/${user.authId}/evaluation`);
 assert.equal(await evaluate(`document.querySelector('main h1').textContent`),'Evaluate Alex Santos');
 assert.equal(await evaluate(`document.querySelector('main select')===null`),true,'Evaluation is bound to a single student');
 await photo('mentor-evaluations-desktop',1440,false);
 await click('Evaluate skill',`document.querySelector('[data-mentor-competency="technical"]')`);await until(`document.querySelector('dialog select')`);
 assert.ok(await evaluate(`document.querySelector('dialog').textContent.includes('Alex Santos')`));
 assert.equal(await evaluate(`document.querySelector('dialog select').value`),'','No invented initial rating');
 await setValue('dialog select','2','HTMLSelectElement');await setValue('dialog textarea','Practice debugging independently and explain the result.','HTMLTextAreaElement');
 await setValue('dialog textarea[name=observedEvidence]','Reviewed Alex’s Campus Portal during a mentoring session.','HTMLTextAreaElement');
 await setValue('dialog textarea[name=nextStep]','Add regression checks to the Campus Portal.','HTMLTextAreaElement');
 await photo('student-specific-evaluation-form',390,false);
 await click('Save evaluation');await until(`document.querySelector('dialog [role=alert]')`);assert.equal(mentorEvaluations.length,0);
 await evaluate(`(()=>{const button=Array.from(document.querySelector('dialog').querySelectorAll('button')).find(button=>button.textContent.trim()==='Save evaluation');button.click();button.click();})()`);
 await until(`!document.querySelector('dialog')`);assert.equal(mentorEvaluations[0].rating,2);assert.equal(mentorSaves,2);
 await until(`document.querySelector('[data-mentor-competency="technical"]').textContent.includes('Practice debugging independently')`);
 await click('Evaluate skill',`document.querySelector('[data-mentor-competency="technical"]')`);await until(`document.querySelector('dialog textarea')`);
 assert.equal(await evaluate(`document.querySelector('dialog textarea').value`),'Practice debugging independently and explain the result.');await click('Cancel',`document.querySelector('dialog')`);
 await send('Page.navigate',{url:`http://localhost:5173/alumni/mentorship/${other.authId}/evaluation`});
 await until(`document.querySelector('main h1')?.textContent==='Evaluate Jamie Cruz'`);
 assert.equal(await evaluate(`document.body.textContent.includes('Practice debugging independently and explain the result.')`),false);
 assert.ok(await evaluate(`document.body.textContent.includes('Budget Spreadsheet')`));
 await click('Evaluate skill',`document.querySelector('[data-mentor-competency="technical"]')`);await until(`document.querySelector('dialog select')`);
 assert.ok(await evaluate(`document.querySelector('dialog').textContent.includes('Jamie Cruz')`));
 await setValue('dialog select','4','HTMLSelectElement');await setValue('dialog textarea[name=feedback]','Jamie explained the budget analysis clearly.','HTMLTextAreaElement');
 await click('Save evaluation');await until(`!document.querySelector('dialog')`);
 assert.equal(mentorEvaluations.find(evaluation=>evaluation.studentAuthId===other.authId).rating,4);
 assert.equal(mentorEvaluations.find(evaluation=>evaluation.studentAuthId===user.authId).rating,2);
 await send('Page.navigate',{url:`http://localhost:5173/alumni/mentorship/${user.authId}/evaluation`});
 await until(`document.querySelector('[data-mentor-competency="technical"]')?.textContent.includes('Add regression checks')`);
 assert.equal(await evaluate(`document.body.textContent.includes('Jamie explained the budget analysis clearly.')`),false);
 await photo('student-specific-evaluation-mobile',390,true);
 await send('Page.navigate',{url:'http://localhost:5173/alumni/mentorship/dddddddddddddddddddddddd/evaluation'});
 await until(`document.querySelector('main [role=alert]')?.textContent.includes('accepted mentorship connection')`);
 assert.equal(await evaluate(`document.querySelector('[data-mentor-competency]')===null`),true);
 account=user;await send('Page.navigate',{url:'http://localhost:5173/student/competency'});
 await until(`document.querySelector('[data-competency="technical"]')?.textContent.includes('Practice debugging independently')`);
 assert.ok(await evaluate(`document.querySelector('[data-competency="technical"]').textContent.includes('Add regression checks to the Campus Portal.')`));
 assert.ok(await evaluate(`document.querySelector('[data-competency="technical"]').textContent.includes('Skill gap: 1 level.')`));
 await photo('student-mentor-feedback',1440,false);await photo('student-mentor-feedback-mobile',390,true);
 await click('Assess skill',`document.querySelector('[data-competency="technical"]')`);await until(`document.querySelector('dialog input[value="4"]')`);
 await evaluate(`document.querySelector('dialog input[value="4"]').click()`);await click('Save assessment');await until(`!document.querySelector('dialog')`);
 assert.equal(record.assessments.technical.rating,4);assert.equal(mentorEvaluations[0].rating,2);
 await until(`document.querySelector('[data-competency="technical"]').textContent.includes('Skill gap: 2 levels.')`);
 assert.deepEqual(runtimeErrors,[]);
 console.log('Passed: dedicated evaluation URLs for two students, named recipient in forms, no preselected rating, observations/next steps, save failure/retry and double-submit guard, student isolation, blocked unconnected student, own feedback and gaps; dashboard search/chat and competency filters/reset; desktop/mobile and dark mode. Mock APIs only. Artifacts: '+artifacts);
}finally{await send('Browser.close').catch(()=>{});socket.close();}
