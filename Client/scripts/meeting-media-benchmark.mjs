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
    }, 120000);
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

const { createServer } = await import('node:http');
const server = createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Isolated WebRTC media benchmark</title>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}`});
  await until(`document.readyState==='complete'`);
  const results=[];
  for (const receivers of [7,24,99]) {
    const result=await evaluate(`(async () => {
      const count=${receivers}, pairs=[], videos=[], canvas=document.createElement('canvas');
      canvas.width=640;canvas.height=360;document.body.append(canvas);
      const context=canvas.getContext('2d');let tick=0;
      const draw=setInterval(()=>{context.fillStyle='hsl('+((tick*7)%360)+' 70% 45%)';context.fillRect(0,0,640,360);context.fillStyle='white';context.font='32px sans-serif';context.fillText('Synthetic video '+tick++,40,100);},1000/15);
      const stream=canvas.captureStream(15);const errors=[];const start=performance.now();
      let timer;const lag=[];let previous=performance.now();
      timer=setInterval(()=>{const now=performance.now();lag.push(Math.max(0,now-previous-50));previous=now;},50);
      try {
        const connect=async()=>{
          const a=new RTCPeerConnection({iceServers:[]}), b=new RTCPeerConnection({iceServers:[]});pairs.push([a,b]);
          a.onicecandidate=e=>{if(e.candidate)b.addIceCandidate(e.candidate).catch(e=>errors.push(e.message));};
          b.onicecandidate=e=>{if(e.candidate)a.addIceCandidate(e.candidate).catch(e=>errors.push(e.message));};
          b.ontrack=e=>{const video=document.createElement('video');video.autoplay=true;video.muted=true;video.style.width='100px';video.srcObject=new MediaStream([e.track]);document.body.append(video);videos.push(video);video.play().catch(()=>{});};
          a.addTrack(stream.getVideoTracks()[0],stream);
          await a.setLocalDescription(await a.createOffer());await b.setRemoteDescription(a.localDescription);
          await b.setLocalDescription(await b.createAnswer());await a.setRemoteDescription(b.localDescription);
        };
        for(let i=0;i<count;i+=6) await Promise.all(Array.from({length:Math.min(6,count-i)},connect));
        const deadline=performance.now()+15000;
        while(pairs.some(([a,b])=>a.connectionState!=='connected'||b.connectionState!=='connected')&&performance.now()<deadline)await new Promise(r=>setTimeout(r,100));
        const connected=pairs.filter(([a,b])=>a.connectionState==='connected'&&b.connectionState==='connected').length;
        const before=await Promise.all(pairs.map(async ([a,b])=>{const reports=await b.getStats();return [...reports.values()].find(r=>r.type==='inbound-rtp'&&r.kind==='video');}));
        const measureStart=performance.now();await new Promise(r=>setTimeout(r,6000));const seconds=(performance.now()-measureStart)/1000;
        const samples=await Promise.all(pairs.map(async ([a,b],i)=>{const reports=[...(await b.getStats()).values()];const inbound=reports.find(r=>r.type==='inbound-rtp'&&r.kind==='video');const candidate=reports.find(r=>r.type==='candidate-pair'&&r.state==='succeeded');return {fps:((inbound?.framesDecoded||0)-(before[i]?.framesDecoded||0))/seconds,lost:inbound?.packetsLost||0,received:inbound?.packetsReceived||0,rtt:candidate?.currentRoundTripTime||0};}));
        const sorted=samples.map(x=>x.fps).sort((a,b)=>a-b);lag.sort((a,b)=>a-b);
        const packets=samples.reduce((sum,x)=>sum+x.received,0), lost=samples.reduce((sum,x)=>sum+x.lost,0);
        return {receivers:count,connected,source:'synthetic canvas 640x360 at 15fps; video only; localhost; sender and all receiver peers in one browser',sampleSeconds:+seconds.toFixed(2),setupMs:+(measureStart-start).toFixed(1),decodedFpsMin:+sorted[0].toFixed(2),decodedFpsMedian:+sorted[Math.floor(count/2)].toFixed(2),packetLossPercent:+(100*lost/Math.max(1,packets+lost)).toFixed(3),rttMaxMs:+(1000*Math.max(...samples.map(x=>x.rtt))).toFixed(2),timerLagP95Ms:+(lag[Math.floor(lag.length*.95)]||0).toFixed(2),errors,jsHeapMB:Math.round((performance.memory?.usedJSHeapSize||0)/1024/1024)};
      } finally {clearInterval(draw);clearInterval(timer);stream.getTracks().forEach(t=>t.stop());pairs.flat().forEach(pc=>pc.close());videos.forEach(v=>{v.srcObject=null;v.remove();});canvas.remove();}
    })()`);
    results.push(result);console.log(JSON.stringify(result));
    if(result.connected<receivers || result.decodedFpsMedian<8 || result.timerLagP95Ms>500){console.log('Stopped scaling after degraded media results.');break;}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  await writeFile(path.join(os.tmpdir(),'siel-meeting-media-benchmark.json'),JSON.stringify(results,null,2));
} finally {await send('Browser.close').catch(()=>{});socket.close();await new Promise(resolve=>server.close(resolve));}
