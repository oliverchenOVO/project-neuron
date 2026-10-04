import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
const summary = (values) => {
  const a = [...values].sort((x, y) => x - y);
  return {
    samples: a.length,
    medianMs: a[Math.floor(a.length / 2)],
    p95Ms: a[Math.ceil(a.length * 0.95) - 1],
    minMs: a[0],
    maxMs: a.at(-1),
  };
};
const browser = await chromium.launch(),
  page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.NEURON_URL ?? "http://127.0.0.1:4173";
const result = {
  method:
    "Production browser; 15 fresh document loads per fixture; repeated actual DOM clicks. JS timing is handler to React layout commit, next rAF separate. Normal-motion shared-space animation: consecutive rAF intervals and callback CPU work, not monitor latency.",
  environment: {
    cpu: os.cpus()[0].model,
    logicalCores: os.cpus().length,
    memoryGiB: os.totalmem() / 2 ** 30,
    platform: os.platform(),
    release: os.release(),
    node: process.version,
    chromium: browser.version(),
    viewport: "1920x1080",
    dpr: 1,
  },
  fixtures: {},
  errors,
};
for (const fixture of ["showcase", "stress-64"]) {
  const loads = [];
  for (let i = 0; i < 15; i++) {
    await page.goto(`${base}/?fixture=${fixture}`);
    await page.waitForFunction(
      () => window.neuronDiagnostics?.loads[0]?.firstRenderMs !== undefined,
    );
    loads.push(await page.evaluate(() => window.neuronDiagnostics.loads[0]));
  }
  const metrics = {};
  for (const key of [
    "fetchMs",
    "parseMs",
    "validationMs",
    "stateMs",
    "firstRenderMs",
  ])
    metrics[key] = summary(loads.map((s) => s[key]));
  await page.getByRole("button", { name: new RegExp("^Token 2:") }).click();
  await page.evaluate(() => (window.neuronDiagnostics.interactions.length = 0));
  for (const mode of ["SIMILARITY", "SPACE"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    for (let i = 0; i < 60; i++) {
      await page
        .getByRole("button", { name: `Layer ${(i % 12) + 1}`, exact: true })
        .click();
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    }
  }
  await page.getByRole("button", { name: "TRAIL OFF", exact: true }).click();
  for (let i = 0; i < 60; i++) {
    await page
      .getByLabel("Space token data")
      .selectOption(String((i * 17) % (fixture === "showcase" ? 6 : 64)));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  }
  await page.getByRole("button", { name: "COMPARE", exact: true }).click();
  for (let i = 0; i < 60; i++) {
    await page
      .getByLabel(i % 2 ? "Compare TO layer" : "Compare FROM layer")
      .selectOption(String(i % 13));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  }
  for (let i = 0; i < 60; i++) {
    await page
      .getByRole("button", {
        name: ["ATTENTION", "SIMILARITY", "SPACE", "COMPARE"][i % 4],
        exact: true,
      })
      .click();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  }
  const raw = await page.evaluate(() => window.neuronDiagnostics.interactions),
    interactions = {};
  for (const kind of [
    "similarity-layer",
    "space-layer",
    "trail-token",
    "compare-layer",
    "microscope-mode",
  ]) {
    const group = raw.filter((s) => s.kind === kind);
    interactions[kind] = {
      commit: summary(group.map((s) => s.commitMs)),
      frameReady: summary(
        group.filter((s) => s.paintMs !== undefined).map((s) => s.paintMs),
      ),
    };
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "SPACE", exact: true }).click();
  await page.evaluate(
    () => (window.neuronDiagnostics.animationFrames.length = 0),
  );
  for (let i = 0; i < 16; i++) {
    await page
      .getByRole("button", { name: `Layer ${(i % 12) + 1}`, exact: true })
      .click();
    await page.waitForTimeout(270);
  }
  const frames = await page.evaluate(
    () => window.neuronDiagnostics.animationFrames,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  result.fixtures[fixture] = {
    tokens: fixture === "showcase" ? 6 : 64,
    payloadBytes: loads[0].bytes,
    loads,
    metrics,
    interactions,
    rawInteractions: raw,
    animation: {
      frameInterval: summary(frames.map((s) => s.frameMs)),
      callbackWork: summary(frames.map((s) => s.updateMs)),
      rawFrames: frames,
    },
  };
  console.log(
    `${fixture}: parse p95 ${metrics.parseMs.p95Ms.toFixed(2)} ms; worst interaction p95 ${Math.max(...Object.values(interactions).map((i) => i.commit.p95Ms)).toFixed(2)} ms; animation frame p95 ${result.fixtures[fixture].animation.frameInterval.p95Ms.toFixed(2)} ms`,
  );
}
await browser.close();
await mkdir("../docs/evidence", { recursive: true });
await writeFile(
  "../docs/evidence/phase1a-browser-benchmark.json",
  JSON.stringify(result, null, 2) + "\n",
);
if (
  errors.length ||
  Object.values(result.fixtures).some((f) =>
    Object.values(f.interactions).some((i) => i.commit.p95Ms >= 50),
  )
)
  process.exitCode = 1;
