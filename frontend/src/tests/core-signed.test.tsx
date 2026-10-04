import { readFileSync } from "node:fs";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SimilarityMatrix } from "../app/CoreViews";
import type { CoreAnalysisResult } from "../types/analysis";
import { similarityColor } from "../utils/representation";
const real = JSON.parse(
  readFileSync("public/fixtures/showcase.json", "utf8"),
) as CoreAnalysisResult;
it("signed mathematical test case renders negative cosine without absolute-value filtering", () => {
  // Explicit mathematical unit case, never a product fixture or fallback.
  const testCase = structuredClone(real);
  testCase.hidden_similarity[1][0][1] = -0.5;
  testCase.hidden_similarity[1][1][0] = -0.5;
  const colors: string[] = [];
  const ctx = {
    scale() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    set fillStyle(value: string) {
      colors.push(value);
    },
  };
  const spy = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  render(<SimilarityMatrix analysis={testCase} layer={1} />);
  const canvas = screen.getByLabelText(/Hidden-state similarity matrix/);
  fireEvent.keyDown(canvas, { key: "ArrowRight" });
  expect(screen.getByTestId("similarity-cell")).toHaveTextContent("-0.500000");
  expect(colors).toContain(similarityColor(-0.5));
  spy.mockRestore();
});
it("new genuine fixture retains all original per-layer / attention / prediction metrics", () => {
  const legacy = JSON.parse(
    readFileSync("public/fixtures/legacy-0.1.1/showcase.json", "utf8"),
  );
  for (const key of Object.keys(legacy).filter(
    (key) => !["metadata", "fixture"].includes(key),
  ))
    expect(real[key as keyof CoreAnalysisResult]).toEqual(legacy[key]);
});
