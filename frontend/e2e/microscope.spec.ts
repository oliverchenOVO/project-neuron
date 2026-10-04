import { test, expect } from "@playwright/test";
import {readFileSync} from 'node:fs';
import {getAttention,weightColor} from '../src/utils/attention';
import type {AnalysisResult} from '../src/types/analysis';
const real=JSON.parse(readFileSync('public/fixtures/showcase.json','utf8')) as AnalysisResult;
const waitReady = async (page: import("@playwright/test").Page) => {
  await expect(page.getByTestId("prediction")).toHaveCount(10);
  await page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      ),
  );
};
test("1920 real-data visual regression and complete interaction path", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await waitReady(page);
  await expect(page).toHaveScreenshot("matrix-hero.png");
  await page.screenshot({ path: "../docs/screenshots/matrix-hero.png" });
  await page.getByRole("button", { name: "Token 2: sat", exact: true }).click();
  await expect(page.getByTestId("attention-arc")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "ARCS", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveScreenshot("arc-hero.png");
  await page.screenshot({ path: "../docs/screenshots/arc-hero.png" });
  await page.getByRole("button", { name: "Layer 6", exact: true }).click();
  await page.getByRole("button", { name: "H04", exact: true }).click();
  await expect(page).toHaveScreenshot("layer06-head04.png");
  await page.getByRole("button", { name: "Layer 12", exact: true }).click();
  await page.getByRole("button", { name: "HEATMAP", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("cell-readout")).toContainText("0.000000");
  await page.getByRole("button", { name: "Information", exact: true }).click();
  await expect(page.locator("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("64-token stress renders all cells, changes all controls, no refetch", async ({
  page,
}) => {
  let requests = 0;
  const errors: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/fixtures/")) requests++;
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?fixture=stress-64");
  await waitReady(page);
  await expect(page.getByRole("button", { name: /^Token \d+:/ })).toHaveCount(
    64,
  );
  await expect(page).toHaveScreenshot("stress64-heatmap.png");
  await page.screenshot({ path: "../docs/screenshots/stress64-heatmap.png" });
  for (const layer of [1, 6, 12])
    await page
      .getByRole("button", { name: `Layer ${layer}`, exact: true })
      .click();
  for (let h = 1; h <= 12; h++)
    await page
      .getByRole("button", {
        name: `H${String(h).padStart(2, "0")}`,
        exact: true,
      })
      .click();
  await page
    .getByRole("button", { name: "Token 63: hello", exact: true })
    .click();
  await expect(page.getByTestId("attention-arc")).toHaveCount(5);
  await expect(page.getByTestId("magnitude")).toBeVisible();
  expect(requests).toBe(1);
  expect(errors).toEqual([]);
});
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
])
  test(`desktop layout ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await waitReady(page);
    for (const name of ["Layer 12", "H12", "ARCS", "Information"]) {
      const button = page.getByRole("button", { name, exact: true });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Token 2: sat", exact: true })
      .click();
    await expect(page.getByTestId("magnitude")).toBeVisible();
    await page.screenshot({
      path: `../docs/screenshots/desktop-${viewport.width}.png`,
    });
  });
test("missing / corrupt fixture errors and retry", async ({ page }) => {
  await page.route("**/fixtures/showcase.json", (r) =>
    r.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("FIXTURE UNAVAILABLE");
  await expect(page.getByTestId("prediction")).toHaveCount(0);
  await page.unroute("**/fixtures/showcase.json");
  await page.getByRole("button", { name: "Retry fixture" }).click();
  await waitReady(page);
});
test('canvas pixels and hover tooltip derive from genuine weights',async({page})=>{
  await page.goto('/');await waitReady(page);const canvas=page.locator('canvas'),box=(await canvas.boundingBox())!,matrix=getAttention(real,1,'AVG');
  await page.mouse.move(box.x+box.width*2.5/6,box.y+box.height*4.5/6);
  await expect(page.getByRole('tooltip')).toContainText(matrix[4][2].toFixed(6));
  await expect(page.getByRole('tooltip')).toContainText('L01 / AVG');
  const pixel=await canvas.evaluate((el)=>{const c=el as HTMLCanvasElement;return Array.from(c.getContext('2d')!.getImageData(Math.floor(c.width*2.5/6),Math.floor(c.height*4.5/6),1,1).data).slice(0,3);});
  expect(`rgb(${pixel.join(',')})`).toBe(weightColor(matrix[4][2]));
  await page.mouse.move(box.x+box.width*4.5/6,box.y+box.height*.5/6);await expect(page.getByRole('tooltip')).toContainText('0.000000');await expect(page.getByTestId('cell-readout')).toContainText('CAUSAL MASK');
});
