import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
const base = process.env.NEURON_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const summary = (values) => {
  const a = [...values].sort((a, b) => a - b);
  return {
    samples: a.length,
    medianMs: a[Math.floor(a.length / 2)],
    p95Ms: a[Math.ceil(a.length * 0.95) - 1],
    minMs: a[0],
    maxMs: a.at(-1),
  };
};
const result = {
  method:
    "Production Vite preview; Playwright Chromium; uncached new document loads; repeated actual DOM clicks. JS handler-to-React-layout commit and handler-to-next-rAF are separate. rAF is a frame-readiness proxy, not physical display latency.",
  environment: {
    platform: os.platform(),
    release: os.release(),
    cpu: os.cpus()[0].model,
    logicalCores: os.cpus().length,
    memoryGB: os.totalmem() / 2 ** 30,
    node: process.version,
    chromium: browser.version(),
    viewport: "1920x1080",
    deviceScaleFactor: 1,
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
  // Worst dense matrix path: layer/head changes use HEATMAP; token path mounts ARCS.
  await page.getByRole("button", { name: "HEATMAP", exact: true }).click();
  await page.evaluate(() => (window.neuronDiagnostics.interactions.length = 0));
  for (let i = 0; i < 60; i++) {
    await page
      .getByRole("button", { name: `Layer ${(i % 12) + 1}`, exact: true })
      .click();
    await page
      .getByRole("button", {
        name: `H${String((i % 12) + 1).padStart(2, "0")}`,
        exact: true,
      })
      .click();
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => r())),
    );
  }
  for (let i = 0; i < 60; i++) {
    const token = fixture === "showcase" ? i % 6 : (i * 17) % 64;
    await page
      .getByRole("button", { name: new RegExp(`^Token ${token}:`) })
      .click();
    await page.getByRole("button", { name: "HEATMAP", exact: true }).click();
    await page.getByRole("button", { name: "ARCS", exact: true }).click();
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => r())),
    );
  }
  const samples = await page.evaluate(
    () => window.neuronDiagnostics.interactions,
  );
  const interactions = {};
  for (const kind of ["layer", "head", "token", "mode"]) {
    const group = samples.filter((s) => s.kind === kind);
    interactions[kind] = {
      commit: summary(group.map((s) => s.commitMs)),
      frameReady: summary(
        group.filter((s) => s.paintMs !== undefined).map((s) => s.paintMs),
      ),
    };
  }
  result.fixtures[fixture] = {
    tokens: fixture === "showcase" ? 6 : 64,
    payloadBytes: loads[0].bytes,
    loads,
    metrics,
    interactions,
    rawInteractions: samples,
  };
  console.log(
    `${fixture}: ${loads[0].bytes} bytes; parse p95 ${metrics.parseMs.p95Ms.toFixed(2)} ms; render p95 ${metrics.firstRenderMs.p95Ms.toFixed(2)} ms; interaction commit p95 ${Math.max(...Object.values(interactions).map((s) => s.commit.p95Ms)).toFixed(2)} ms`,
  );
}
await browser.close();
await mkdir("../docs/evidence", { recursive: true });
await writeFile(
  "../docs/evidence/browser-benchmark.json",
  JSON.stringify(result, null, 2) + "\n",
);
if (
  errors.length ||
  Object.values(result.fixtures).some((f) =>
    Object.values(f.interactions).some((i) => i.commit.p95Ms >= 50),
  )
)
  process.exitCode = 1;
