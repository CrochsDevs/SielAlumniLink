// Run with isolated Edge/Chrome on port 9228. API fixtures never change real student records.
import { calculateReadiness } from '../../Server/modules/development/development.policy.js';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9228.
const artifacts = path.join(os.tmpdir(), 'SielAlumni-development-check');
await mkdir(artifacts, { recursive: true });
const target = await (await fetch('http://localhost:9228/json/new?about:blank', { method: 'PUT' })).json();
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

const student={_id:'111111111111111111111111',authId:'aaaaaaaaaaaaaaaaaaaaaaaa',name:'Student Tester',email:'student@example.test',role:'student',program:'BS Information Technology',batch:'2025',passwordSetupRequired:false};
const alumni={...student,_id:'222222222222222222222222',authId:'bbbbbbbbbbbbbbbbbbbbbbbb',name:'Alumni Mentor',email:'mentor@example.test',role:'alumni'};
let account=student,failFirstInternship=true,mentorCount=0,applications=[],internships=[],events=[],academic={};
const portfolio=Object.fromEntries(['skills','certifications','seminars','projects','research','awards'].map(key=>[key,[]]));
const referrals=['job','internship','scholarship'].map((type,index)=>({_id:String(index+1).padStart(24,'c'),title:type+' opportunity',description:'Apply directly to the alumni referrer.',organization:'Campus Partner',type,authorAuthId:alumni.authId,authorName:alumni.name,isActive:true}));
const snapshot=()=>{
 const done={...academic,...(events.length?{events:events[0].date}:{}),...(mentorCount?{mentorship:'2025-01-01'}:{}),...(internships.some(record=>record.completed)?{internship:'2025-06-01'}:{})};
 let current=false;
 const timeline=[['enrolled','Enrolled'],['semester','First Semester Completed'],['mentorship','Joined Mentorship'],['events','Participated in Events'],['internship','Internship Completed'],['graduated','Graduated'],['alumni','Became Alumni'],['employed','Employed']].map(([key,title])=>{const state=done[key]?'done':!current?'current':'upcoming';if(state==='current')current=true;return {key,title,desc:title,date:done[key]||null,state,source:done[key]?'Saved record':''};});
 return {internships,events,portfolio,timeline,mentorCount,readiness:calculateReadiness({mentorCount,eventCount:events.length,portfolio,internships})};
};
let mutations=0;
listeners.set('Runtime.exceptionThrown',({exceptionDetails})=>runtimeErrors.push(exceptionDetails.exception?.description||exceptionDetails.text));
listeners.set('Fetch.requestPaused',async({requestId,request})=>{
 try{
  const route=new URL(request.url).pathname.replace('/api','');
  let data=[],responseCode=200,message;
  const input=request.postData?JSON.parse(request.postData):{};
  if(request.method==='OPTIONS')data=null;
  else if(route==='/auth/me'||route==='/users/me')data=account;
  else if(route==='/users')data=[alumni];
  else if(route==='/jobs')data=[{_id:'ffffffffffffffffffffffff',title:'University internship',company:'Campus',type:'Internship',description:'Campus internship',isActive:true}];
  else if(route==='/development/me')data=snapshot();
  else if(route.startsWith('/development/')){
   mutations++;
   if(route.includes('/internships')&&request.method==='POST'){
    if(failFirstInternship){failFirstInternship=false;responseCode=503;message='Test save failure. Retry your record.';}
    else internships.push({...input,_id:'dddddddddddddddddddddddd',completed:input.hoursCompleted>=input.requiredHours});
   }else if(route.includes('/internships/')&&request.method==='PUT')internships=internships.map(record=>({...record,...input,completed:input.hoursCompleted>=input.requiredHours}));
   else if(route.includes('/internships/')&&request.method==='DELETE')internships=[];
   else if(route==='/development/academic')academic[input.key]=input.date;
   else if(route==='/development/events')events.push({...input,_id:String(events.length+1).padStart(24,'e')});
   else if(route.startsWith('/development/portfolio/'))portfolio[route.split('/').at(-1)]=input.entries;
   data=snapshot();
  }else if(route==='/referrals/applications/me')data=applications.map(application=>({...application,referralTitle:referrals.find(item=>item._id===application.referralId)?.title,organization:'Campus Partner'}));
  else if(route==='/referrals')data=referrals;
  else if(route.endsWith('/apply')){applications.push({_id:'eeeeeeeeeeeeeeeeeeeeeeee',referralId:route.split('/')[2],email:student.email,name:student.name,note:input.note,status:'pending',createdAt:new Date().toISOString()});data=applications.at(-1);}
  else if(route.endsWith('/applications'))data=applications;
  else if(route.startsWith('/referrals/applications/')){applications=applications.map(application=>({...application,status:input.status}));data=applications[0];}
  await send('Fetch.fulfillRequest',{requestId,responseCode,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'http://localhost:5173'},{name:'Access-Control-Allow-Credentials',value:'true'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PUT,DELETE,OPTIONS'},{name:'Access-Control-Allow-Headers',value:'Content-Type'}],body:Buffer.from(JSON.stringify({success:responseCode===200,data,message})).toString('base64')});
 }catch(error){runtimeErrors.push(error.message);await send('Fetch.failRequest',{requestId,errorReason:'Failed'});}
});
const click=async(label,scope='document')=>evaluate('Array.from('+scope+'.querySelectorAll(\'button\')).find(button=>button.textContent.trim()==='+JSON.stringify(label)+').click()');
const setValue=async(selector,value,type='HTMLInputElement')=>evaluate('(()=>{const field=document.querySelector('+JSON.stringify(selector)+');Object.getOwnPropertyDescriptor('+type+'.prototype,\'value\').set.call(field,'+JSON.stringify(value)+');field.dispatchEvent(new Event(\''+(type==='HTMLSelectElement'?'change':'input')+'\',{bubbles:true}));})()');
const navigate=async page=>{const loaded=new Promise(resolve=>listeners.set('Page.loadEventFired',resolve));await send('Page.navigate',{url:'http://localhost:5173'+page});await loaded;await until('document.querySelector(\'main\')');await new Promise(resolve=>setTimeout(resolve,200));};
const photo=async(name,width,dark)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});await evaluate('document.documentElement.classList.toggle(\'dark\','+dark+')');await new Promise(resolve=>setTimeout(resolve,100));assert.equal(await evaluate('document.documentElement.scrollWidth<='+ (width+1)),true,'Overflow '+name+' at '+width);const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(artifacts,'development-'+name+'-'+width+'-'+dark+'.png'),Buffer.from(shot.data,'base64'));};
try{
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3002/api/*'}]});
 await navigate('/student/internship');await until('document.body.textContent.includes(\'No internship records yet\')');
 await click('Add record');await until('document.querySelector(\'dialog\')');
 await setValue('input[aria-label="Internship company"]','Campus Tech');await setValue('input[aria-label="Supervisor"]','Dr. Mentor');await setValue('input[aria-label="Required hours"]','100');await setValue('input[aria-label="Hours completed"]','95');await setValue('input[aria-label="Start date"]','2025-04-01');await setValue('textarea[aria-label="Evaluation"]','Good progress','HTMLTextAreaElement');
 await click('Save internship','document.querySelector(\'dialog\')');await until('document.querySelector(\'dialog [role=alert]\')');
 assert.equal(internships.length,0);assert.equal(await evaluate('document.querySelector(\'input[aria-label="Internship company"]\').value'),'Campus Tech');
 await click('Save internship','document.querySelector(\'dialog\')');await until('!document.querySelector(\'dialog\')&&document.body.textContent.includes(\'Campus Tech\')');
 await navigate('/student/internship');assert.equal(internships[0].evaluation,'Good progress');assert.ok(await evaluate('document.body.textContent.includes(\'95 / 100 hours\')'));
 for(const width of [320,390,768,1024,1440])for(const dark of [false,true])await photo('internship',width,dark);
 await navigate('/student/journey');await click('Record milestone');await until('document.querySelector(\'dialog\')');await setValue('input[aria-label="Milestone date"]','2023-08-01');await click('Save milestone','document.querySelector(\'dialog\')');await until('!document.querySelector(\'dialog\')');
 await click('Record milestone');await setValue('select[aria-label="Academic milestone"]','semester','HTMLSelectElement');await setValue('input[aria-label="Milestone date"]','2023-12-01');await click('Save milestone','document.querySelector(\'dialog\')');await until('!document.querySelector(\'dialog\')');
 await click('Event Attendance');for(const [title,date] of [['Career Fair','2025-02-01'],['Research Congress','2025-03-01']]){await setValue('input[aria-label="Attended event name"]',title);await setValue('input[aria-label="Attendance date"]',date);await click('Record attendance');await until('document.querySelector(\'input[aria-label="Attended event name"]\').value===\'\'');}
 assert.equal(events.length,2);await click('Timeline');await photo('journey',390,true);
 await navigate('/student/portfolio');
 const addEntry=async(index,value)=>{await evaluate('Array.from(document.querySelectorAll(\'main section\')['+index+'].querySelectorAll(\'button\')).find(button=>button.textContent.trim()===\'Add\').click()');await evaluate('(()=>{const field=document.querySelectorAll(\'main section\')['+index+'].querySelector(\'input\');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,\'value\').set.call(field,'+JSON.stringify(value)+');field.dispatchEvent(new Event(\'input\',{bubbles:true}));})()');await evaluate('Array.from(document.querySelectorAll(\'main section\')['+index+'].querySelectorAll(\'button\')).find(button=>button.textContent.trim()===\'Add\').click()');await until('!document.querySelectorAll(\'main section\')['+index+'].querySelector(\'input\')');};
 for(const [index,value]of [[0,'SQL'],[1,'Certificate A'],[1,'Certificate B'],[2,'Career Seminar'],[3,'Capstone Project'],[4,'Research Paper']])await addEntry(index,value);
 mentorCount=1;await navigate('/student/readiness');await until('document.body.textContent.includes(\'Highly Prepared\')');assert.equal(snapshot().readiness.score,82);assert.equal(await evaluate('document.querySelector(\'main strong\').textContent'),'82');
 for(const width of [320,390,768,1024,1440])for(const dark of [false,true])await photo('readiness',width,dark);
 await navigate('/student/portfolio');assert.ok(await evaluate('document.body.textContent.includes(\'Certificate A\')'));await photo('portfolio',390,true);
 await navigate('/student/referrals');await until('document.querySelector(\'article\')');await click('Apply directly','document.querySelector(\'article\')');await setValue('textarea','Interested in this role','HTMLTextAreaElement');await evaluate('(()=>{const button=Array.from(document.querySelectorAll(\'article button\')).find(button=>button.textContent.trim()===\'Submit application\');button.click();button.click();})()');await until('document.body.textContent.includes(\'Application submitted\')');assert.equal(applications.length,1);
 await until('!document.querySelector(\'.swal2-container\')');await click('Applied (1)');await until('document.body.textContent.includes(\'job opportunity\')');await photo('student-referrals',390,true);
 account=alumni;await navigate('/alumni/referral');await until('document.querySelector(\'button[aria-label="Delete referral"]\')');await click('View applicants','document.querySelector(\'article\')');await until('document.querySelector(\'article select\')');assert.ok(await evaluate('document.body.textContent.includes(\'Interested in this role\')'));await setValue('article select','accepted','HTMLSelectElement');await new Promise(resolve=>setTimeout(resolve,150));
 assert.equal(applications[0].status,'accepted');
 assert.deepEqual(runtimeErrors,[]);console.log('Passed: internship failure/retry and reload, saved academic dates, attendance, portfolio records, dynamic 82/100 readiness, referral double-submit guard and review, plus mobile/desktop themes.');
}finally{await send('Browser.close').catch(()=>{});socket.close();}
