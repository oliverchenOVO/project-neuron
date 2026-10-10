import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
const summary=values=>{const a=[...values].sort((x,y)=>x-y);return {samples:a.length,medianMs:a[Math.floor(a.length/2)],p95Ms:a[Math.ceil(a.length*.95)-1],maxMs:a.at(-1)}};
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1920,height:1080},reducedMotion:"reduce"});
const base=process.env.NEURON_URL??"http://127.0.0.1:4175";
const errors=[];p.on("pageerror",e=>errors.push(e.message));p.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
const result={sourceRevision:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),
 method:"Production Chromium; 60 DOM interactions per category and 13 actual timer-driven play steps per source. Handler to React layout commit measures the entire stage render (PCA, signals, chart focus, ranking); next-rAF latency is reported separately. No CPU throttling. Heap delta is a coarse whole-page approximation, not isolated object size.",
 environment:{cpu:os.cpus()[0].model,cores:os.cpus().length,memoryGiB:os.totalmem()/2**30,platform:os.platform(),release:os.release(),node:process.version,chromium:b.version(),viewport:"1920x1080",motion:"reduce"},cases:{},errors};
const frame=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
for(const id of ["showcase","stress-64"]) for(const local of [false,true]) {
 const name=`${id}-${local?"cli-import":"public"}`;
 await p.goto(`${base}/?fixture=${id}`);await p.getByRole("button",{name:/^Token 2:/}).waitFor();await frame();
 const before=await p.evaluate(()=>performance.memory?.usedJSHeapSize??null);
 let bytes=await p.evaluate(()=>window.neuronDiagnostics.loads[0].bytes);
 if(local) {
   const raw=await readFile(`../artifacts/phase1b-cli-${id==="showcase"?6:64}.json`);
   bytes=raw.length;
   await p.getByLabel("Fixture",{exact:true}).selectOption("import");
   await p.getByLabel("Local analysis JSON").setInputFiles({name:`analysis-${id}.json`,mimeType:"application/json",buffer:raw});
   await p.getByRole("button",{name:"開始觀察",exact:true}).click();
 }
 await p.getByRole("button",{name:/^Token 2:/}).click();await p.getByRole("button",{name:"JOURNEY",exact:true}).click();await frame();
 const after=await p.evaluate(()=>performance.memory?.usedJSHeapSize??null);
 await p.evaluate(()=>window.neuronDiagnostics.interactions.length=0);
 for(let i=0;i<60;i++){await p.getByRole("button",{name:`Journey stage L${String(i%12+1).padStart(2,"0")}`,exact:true}).click();await frame()}
 for(let i=0;i<60;i++){await p.getByLabel("Evolution metric").selectOption(i%2?"probabilities":"logits");await frame()}
 const candidate=await p.getByLabel(/^Candidate /).first().getAttribute("aria-label");
 for(let i=0;i<60;i++){await p.getByLabel(candidate,{exact:true}).click();await frame()}
 for(let i=0;i<60;i++){await p.getByRole("button",{name:"CINEMATIC",exact:true}).click();await frame()}
 for(let i=0;i<60;i++){const node=p.getByTestId("journey-node").nth(i%(id==="showcase"?6:64));await node.focus();await node.press("Enter");await frame()}
 await p.getByRole("button",{name:"Reset",exact:true}).click();await p.getByLabel("Playback speed").selectOption("2");await p.getByRole("button",{name:"Play",exact:true}).click();
 await p.getByRole("button",{name:"Journey stage OUT",exact:true}).waitFor();
 await p.waitForFunction(()=>document.querySelector('[aria-label="Journey stage OUT"]')?.getAttribute("aria-current")==="step",{},{timeout:15000});await frame();
 const timings=await p.evaluate(()=>window.neuronDiagnostics.interactions);
 const metrics={};for(const kind of ["journey-stage","journey-play-step","prediction-chart","prediction-candidates","cinematic","token"]){
   const samples=timings.filter(t=>t.kind===kind);if(!samples.length) continue;
   metrics[kind]={commit:summary(samples.map(t=>t.commitMs)),frameReady:summary(samples.filter(t=>t.paintMs!==undefined).map(t=>t.paintMs))};
 }
 const points=await p.getByTestId("journey-node").count();if(points!==(id==="showcase"?6:64))throw Error("Wrong token count");
 result.cases[name]={tokens:points,bytes,heap:{beforeBytes:before,afterBytes:after,deltaBytes:before===null||after===null?null:after-before},loads:await p.evaluate(()=>window.neuronDiagnostics.loads),metrics};
 console.log(name,JSON.stringify(Object.fromEntries(Object.entries(metrics).map(([k,v])=>[k,v.commit.p95Ms]))));
}
await b.close();
result.passed=errors.length===0&&Object.values(result.cases).every(c=>c.tokens===(c.tokens===6?6:64)&&Object.values(c.metrics).every(v=>v.commit.p95Ms<50));
await mkdir("../docs/evidence",{recursive:true});await writeFile("../docs/evidence/phase1b-browser-performance.json",JSON.stringify(result,null,2));
if(!result.passed)throw Error("Phase 1B benchmark gate failed; inspect evidence");
