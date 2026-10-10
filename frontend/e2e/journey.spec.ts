import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const raw=readFileSync("public/fixtures/phase1b/showcase.json","utf8");
const a=JSON.parse(raw);
async function enter(page:Page) {
  await page.goto("/"); await page.getByRole("button",{name:"Token 2: sat",exact:true}).click();
  await page.getByRole("button",{name:"JOURNEY",exact:true}).click();
}
for(const stage of [0,6,12,13]) test(`Journey ${stage===0?"EMB":stage===13?"OUT":`L${stage}`} real values and fixed axes`,async({page})=>{
  await enter(page);const name=stage===0?"EMB":stage===13?"OUT":`L${String(stage).padStart(2,"0")}`;
  await page.getByRole("button",{name:`Journey stage ${name}`,exact:true}).click();
  await expect(page.getByRole("button",{name:`Journey stage ${name}`,exact:true})).toHaveAttribute("aria-current","step");
  await expect(page.getByTestId("journey-space")).toHaveAttribute("data-domain",JSON.stringify(a.shared_pca.axis_domain));
  await expect(page.getByTestId("journey-node").nth(2)).toHaveAttribute("data-x",String(a.shared_pca.coordinates[Math.min(stage,12)][2][0]));
  await expect(page.getByTestId("journey-trail")).toHaveAttribute("data-stages",String(Math.min(stage,12)+1));
  await expect(page.getByTestId("journey-prediction").first()).toHaveAttribute("data-token-id",String((stage===13?a.final_top_k:a.logit_lens_top_k[stage])[0].token_id));
  if(stage===0 || stage===13) await expect(page.getByTestId("journey-attention-na")).toBeVisible();
  await expect(page).toHaveScreenshot(`journey-${name}.png`);
});
test("Prediction Evolution hero, exact values, logit switch and candidate filtering",async({page})=>{
  await enter(page);await page.getByRole("button",{name:"Journey stage L12",exact:true}).click();
  await expect(page.getByTestId("prediction-point")).toHaveCount(70);
  await expect(page.getByTestId("prediction-point").nth(12)).toHaveAttribute("data-value",String(a.prediction_evolution.candidates[0].probabilities[12]));
  await page.locator(".prediction-table summary").click();
  await expect(page.locator(".prediction-table tbody tr")).toHaveCount(5);
  await page.getByTestId("prediction-evolution").screenshot({path:"../docs/screenshots/phase1b-prediction-hero.png"});
  await expect(page.getByTestId("prediction-evolution")).toHaveScreenshot("prediction-evolution.png");
  await page.getByLabel("Evolution metric").selectOption("logits");
  await expect(page.getByTestId("prediction-point").nth(12)).toHaveAttribute("data-value",String(a.prediction_evolution.candidates[0].logits[12]));
  await page.getByLabel(`Candidate ${a.final_top_k[0].token_id}`,{exact:true}).uncheck();await expect(page.getByTestId("prediction-point")).toHaveCount(56);
});
test("Cinematic recording preset, provenance and full instrument hero",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error") errors.push(m.text())});
  await page.goto("/?recording=1");await expect(page.getByTestId("journey-space")).toBeVisible();
  await expect(page.getByText("SHOWCASE FIXTURE",{exact:true})).toBeVisible();
  await expect(page.getByText("REAL FORWARD PASS",{exact:true})).toBeVisible();
  await expect(page.getByLabel("Fixture",{exact:true})).toBeHidden();
  await expect(page.getByRole("button",{name:"Journey stage L06",exact:true})).toHaveAttribute("aria-current","step");
  await expect(page).toHaveScreenshot("cinematic-journey.png");
  await page.screenshot({path:"../docs/screenshots/phase1b-journey-hero.png"});
  const dimensions=await page.locator(".journey-workspace").evaluate(e=>({client:e.clientHeight,scroll:e.scrollHeight}));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+1);
  await page.getByRole("button",{name:"CINEMATIC",exact:true}).click();await expect(page.getByLabel("Fixture",{exact:true})).toBeHidden();
  expect(errors).toEqual([]);
});
test("Public Showcase sequences genuine stages without another fetch",async({page})=>{
  let requests=0;page.on("request",r=>{if(r.url().endsWith("showcase.json")) requests++});
  await page.clock.install();await page.goto("/");await expect(page.getByTestId("prediction")).toHaveCount(10);
  await page.getByRole("button",{name:"PLAY SHOWCASE",exact:true}).click();
  await expect(page.getByRole("button",{name:"Layer 1",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.clock.fastForward(1800);await expect(page.getByRole("button",{name:"Layer 6",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.clock.fastForward(1800);await expect(page.getByRole("button",{name:"Layer 12",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.clock.fastForward(1800);await expect(page.getByRole("button",{name:"SIMILARITY",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.clock.fastForward(1800);await expect(page.getByTestId("space-plot")).toBeVisible();
  await page.clock.fastForward(1800);await expect(page.getByTestId("journey-space")).toBeVisible();
  for(let i=1;i<=13;i++) { await page.clock.fastForward(900); await expect(page.getByRole("button",{name:`Journey stage ${i===13?"OUT":`L${String(i).padStart(2,"0")}`}`,exact:true})).toHaveAttribute("aria-current","step"); }
  await expect(page.getByRole("heading",{name:/FINAL PREDICTION/})).toBeVisible();expect(requests).toBe(1);
});
test("Imported CLI-shaped JSON Journey, invalid import retains state and honest provenance",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await enter(page);
  const {fixture,...cli}=a;cli.input_text=fixture.public_prompt;cli.metadata={...cli.metadata,model_source:"private/path",prediction_evolution_ms:1};
  await page.getByLabel("Fixture",{exact:true}).selectOption("import");
  await page.getByLabel("Local analysis JSON").setInputFiles({name:"cli.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(cli))});
  await page.getByRole("button",{name:"開始觀察",exact:true}).click();
  await page.getByRole("button",{name:"Token 2: sat",exact:true}).click();await page.getByRole("button",{name:"JOURNEY",exact:true}).click();
  await page.getByRole("button",{name:"Journey stage L06",exact:true}).click();
  await page.getByLabel("Fixture",{exact:true}).selectOption("import");
  await page.getByLabel("Local analysis JSON").setInputFiles({name:"bad.json",mimeType:"application/json",buffer:Buffer.from("{")});
  await expect(page.getByRole("alert")).toBeVisible();await page.getByRole("button",{name:"Close local analysis",exact:true}).click();
  await expect(page.getByRole("button",{name:"Journey stage L06",exact:true})).toHaveAttribute("aria-current","step");
  await page.getByRole("button",{name:"CINEMATIC",exact:true}).click();await expect(page.getByText("LOCAL ANALYSIS",{exact:true})).toBeVisible();await expect(page.getByText("SOURCE NOT VERIFIED",{exact:true})).toBeVisible();
  await expect(page).toHaveScreenshot("imported-journey.png");expect(errors).toEqual([]);
  await page.getByRole("button",{name:"CINEMATIC",exact:true}).click();await expect(page.getByLabel("Fixture",{exact:true})).toBeVisible();
});
test("64-token Journey stress: full points, sparse labels, keyboard and reduced-motion playback",async({page})=>{
  await page.goto("/?fixture=stress-64");await page.getByRole("button",{name:/^Token 63:/}).click();await page.getByRole("button",{name:"JOURNEY",exact:true}).click();
  await expect(page.getByTestId("journey-node")).toHaveCount(64);
  expect(await page.locator(".journey-point text").count()).toBeLessThan(10);
  await page.locator("h1").click();await page.keyboard.press("ArrowRight");await expect(page.getByRole("button",{name:"Journey stage L01",exact:true})).toHaveAttribute("aria-current","step");
  await page.keyboard.press("End");await expect(page.getByRole("heading",{name:/FINAL PREDICTION/})).toBeVisible();await page.keyboard.press("Home");
  await page.getByLabel("Playback speed").selectOption("2");await page.getByRole("button",{name:"Play",exact:true}).click();
  await expect(page.getByRole("button",{name:"Journey stage L01",exact:true})).toHaveAttribute("aria-current","step");await page.getByRole("button",{name:"Pause",exact:true}).click();
  await page.getByRole("button",{name:"Journey stage L06",exact:true}).click();await expect(page).toHaveScreenshot("journey-stress64.png");
});
test("normal motion and narrow viewport remain interactive",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await enter(page);await page.getByRole("button",{name:"Next",exact:true}).click();
  const duration=await page.locator(".journey-point circle").first().evaluate(e=>getComputedStyle(e).transitionDuration);expect(duration).toContain("0.24s");
  await page.setViewportSize({width:390,height:844});await page.getByRole("button",{name:"Journey stage OUT",exact:true}).click();await expect(page.getByRole("heading",{name:/FINAL PREDICTION/})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
test("recording intro starts with real tokenization and no preselected token",async({page})=>{
  await page.goto("/?recording=1&intro=1");
  await expect(page.getByRole("button",{name:"Token 2: sat",exact:true})).toHaveAttribute("aria-pressed","false");
  await expect(page.getByLabel("Fixture",{exact:true})).toBeHidden();
  await page.getByRole("button",{name:"Token 2: sat",exact:true}).click();
  await expect(page.getByTestId("attention-arc")).toHaveCount(3);
});
