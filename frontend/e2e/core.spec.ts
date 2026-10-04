import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { CoreAnalysisResult } from "../src/types/analysis";
const a = JSON.parse(
  readFileSync("public/fixtures/showcase.json", "utf8"),
) as CoreAnalysisResult;
async function settle(page: import("@playwright/test").Page) {
  await page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      ),
  );
}
test("similarity, graph, fixed axes, trail and compare heroes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(page).toHaveTitle(/Project NEURON/);
  await expect(page.getByTestId("prediction")).toHaveCount(10);
  await page.getByRole("button", { name: "Token 2: sat", exact: true }).click();
  await page.getByRole("button", { name: "Layer 6", exact: true }).click();
  await page.getByRole("button", { name: "SIMILARITY", exact: true }).click();
  await settle(page);
  await expect(page).toHaveScreenshot("similarity-matrix.png");
  await page.screenshot({
    path: "../docs/screenshots/phase1a-similarity-matrix.png",
  });
  await page.getByRole("button", { name: "GRAPH", exact: true }).click();
  await expect(page.getByTestId("relationship-node")).toHaveCount(5);
  await expect(page).toHaveScreenshot("similarity-graph.png");
  await page.screenshot({
    path: "../docs/screenshots/phase1a-similarity-graph.png",
  });
  await page.getByRole("button", { name: "SPACE", exact: true }).click();
  await settle(page);
  const domain = await page
    .getByTestId("space-plot")
    .getAttribute("data-domain");
  await expect(page.getByTestId("space-node")).toHaveCount(6);
  await expect(page).toHaveScreenshot("shared-pca-space.png");
  await page.screenshot({
    path: "../docs/screenshots/phase1a-shared-space.png",
  });
  for (const layer of [1, 12, 6]) {
    await page
      .getByRole("button", { name: `Layer ${layer}`, exact: true })
      .click();
    await expect(page.getByTestId("space-plot")).toHaveAttribute(
      "data-domain",
      domain!,
    );
    const node = page.getByTestId("space-node").nth(2);
    await expect(node).toHaveAttribute(
      "data-pc1",
      String(a.shared_pca.coordinates[layer][2][0]),
    );
  }
  await page.getByRole("button", { name: "TRAIL OFF", exact: true }).click();
  await expect(page.getByTestId("trail-point")).toHaveCount(13);
  expect(
    await page
      .getByTestId("trail-point")
      .evaluateAll((points) =>
        points.map((p) => Number(p.getAttribute("data-layer"))),
      ),
  ).toEqual(Array.from({ length: 13 }, (_, i) => i));
  await expect(page).toHaveScreenshot("representation-trail.png");
  await page.screenshot({ path: "../docs/screenshots/phase1a-trail-hero.png" });
  await page.getByRole("button", { name: "COMPARE", exact: true }).click();
  await expect(page.getByTestId("compare-distance")).toHaveText(
    a.same_token_layer_distance[2][3][9].toFixed(6),
  );
  await expect(page.getByTestId("compare-cosine")).toHaveText(
    a.same_token_layer_similarity[2][3][9].toFixed(6),
  );
  await expect(page).toHaveScreenshot("compare-mode.png");
  await page.screenshot({ path: "../docs/screenshots/phase1a-compare.png" });
  await page.getByLabel("Compare FROM layer").selectOption("0");
  await page.getByLabel("Compare TO layer").selectOption("12");
  await expect(page.getByTestId("compare-distance")).toHaveText(
    a.same_token_layer_distance[2][0][12].toFixed(6),
  );
  expect(errors).toEqual([]);
});
test("64-token similarity and space stress, accessible token selection", async ({
  page,
}) => {
  await page.goto("/?fixture=stress-64");
  await expect(page.getByTestId("prediction")).toHaveCount(10);
  await page
    .getByRole("button", { name: "Token 63: hello", exact: true })
    .click();
  await page.getByRole("button", { name: "SIMILARITY", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "SPACE", exact: true }).click();
  await page.getByRole("button", { name: "Layer 6", exact: true }).click();
  await expect(page.getByTestId("space-node")).toHaveCount(64);
  await page.getByRole("button", { name: "TRAIL OFF" }).click();
  await settle(page);
  await expect(page).toHaveScreenshot("space64-stress.png");
  await page.screenshot({ path: "../docs/screenshots/phase1a-space64.png" });
  await page.getByLabel("Space token data").selectOption("32");
  await expect(page.getByTestId("trail-point")).toHaveCount(13);
  await page.getByRole("button", { name: "Embedding layer" }).click();
  await expect(page.getByLabel("Representation layer scrubber")).toHaveValue(
    "0",
  );
  await page.getByRole("button", { name: "ATTENTION", exact: true }).click();
  await expect(
    page.getByText("EMB has no attention matrix. Select Layer 01–12."),
  ).toBeVisible();
});
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
])
  test(`new core desktop ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: "Token 2: sat" }).click();
    await page.getByRole("button", { name: "SPACE", exact: true }).click();
    await page.getByRole("button", { name: "Layer 6", exact: true }).click();
    await page.getByRole("button", { name: "TRAIL OFF" }).click();
    await settle(page);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    for (const label of ["Representation layer scrubber", "Space token data"])
      await expect(page.getByLabel(label)).toBeVisible();
    await page.screenshot({
      path: `../docs/screenshots/phase1a-desktop-${viewport.width}.png`,
    });
  });
test("normal motion interpolates with fixed axes; reduced-motion baseline remains exact", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "SPACE", exact: true }).click();
  const domain = await page
    .getByTestId("space-plot")
    .getAttribute("data-domain");
  await page.getByRole("button", { name: "Layer 12", exact: true }).click();
  await page.waitForFunction(
    () => window.neuronDiagnostics.animationFrames.length >= 2,
  );
  await page.waitForTimeout(280);
  await expect(page.getByTestId("space-plot")).toHaveAttribute(
    "data-domain",
    domain!,
  );
  await expect(page.getByTestId("space-node").nth(2)).toHaveAttribute(
    "data-x",
    String(
      88 +
        ((a.shared_pca.coordinates[12][2][0] - a.shared_pca.axis_domain[0][0]) /
          (a.shared_pca.axis_domain[0][1] - a.shared_pca.axis_domain[0][0])) *
          824,
    ),
  );
});
