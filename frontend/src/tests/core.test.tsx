import { readFileSync } from "node:fs";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "../app/App";
import { validateAnalysis } from "../data/validate";
import { fixtureSource } from "../data/source";
import { useMicroscope } from "../state/microscope";
import type { CoreAnalysisResult } from "../types/analysis";
import {
  rankRelationships,
  relationshipGeometry,
  similarityColor,
  projectedPoint,
  tokenTrail,
} from "../utils/representation";
const raw = readFileSync("public/fixtures/showcase.json", "utf8"),
  raw64 = readFileSync("public/fixtures/stress-64.json", "utf8");
const a = validateAnalysis(JSON.parse(raw)) as CoreAnalysisResult,
  b = validateAnalysis(JSON.parse(raw64)) as CoreAnalysisResult;
beforeEach(() => {
  fixtureSource.clear("showcase");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(raw)),
  );
  useMicroscope.setState({
    microscopeMode: "ATTENTION",
    status: "loading",
    analysis: null,
  });
});
async function ready() {
  render(<App />);
  await screen.findByRole("button", { name: "Token 2: sat" });
  fireEvent.click(screen.getByRole("button", { name: "Token 2: sat" }));
}
describe("representation numerical contracts", () => {
  it("retains genuine cosine, symmetry and self diagonal", () => {
    for (const m of a.hidden_similarity)
      for (let i = 0; i < 6; i++) {
        expect(m[i][i]).toBeCloseTo(1, 5);
        for (let j = 0; j < 6; j++) expect(m[i][j]).toBe(m[j][i]);
      }
  });
  it("signed diverging color has distinct negative/zero/positive endpoints", () => {
    expect(similarityColor(-1)).toBe("rgb(163,154,219)");
    expect(similarityColor(0)).toBe("rgb(15,25,35)");
    expect(similarityColor(1)).toBe("rgb(116,221,217)");
    expect(similarityColor(-0.5)).not.toBe(similarityColor(0.5));
  });
  it("ranking excludes self and sorts raw cosine, including negative values", () => {
    const m = [
      [1, -0.9, 0.2, -0.1],
      [-0.9, 1, 0, 0],
      [0.2, 0, 1, 0],
      [-0.1, 0, 0, 1],
    ];
    expect(rankRelationships(m, 0).map((r) => r.key)).toEqual([2, 3, 1]);
  });
  it("genuine selected-token ranking matches exact source row", () => {
    const r = rankRelationships(a.hidden_similarity[6], 2);
    expect(r).toHaveLength(5);
    expect(
      r.every(
        (p) => p.key !== 2 && p.value === a.hidden_similarity[6][2][p.key],
      ),
    ).toBe(true);
    expect(r.map((p) => p.value)).toEqual(
      [...r.map((p) => p.value)].sort((x, y) => y - x),
    );
  });
  it("graph geometry is deterministic, bounded, monotonic and signed", () => {
    const m = [
        [1, 1, -1],
        [1, 1, 0],
        [-1, 0, 1],
      ],
      g = relationshipGeometry(m, 0);
    expect(g).toEqual(relationshipGeometry(m, 0));
    expect(g[0].radius).toBeLessThan(g[1].radius);
    expect(g[1].value).toBe(-1);
    expect(g.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(
      true,
    );
  });
  it("shared PCA maps actual coordinates with one fixed domain for all layers", () => {
    const domain = a.shared_pca.axis_domain;
    for (let l = 0; l < 13; l++) {
      const p = projectedPoint(a, l, 2),
        [x, y] = a.shared_pca.coordinates[l][2];
      expect(p.pc1).toBe(x);
      expect(p.pc2).toBe(y);
      expect(p.x).toBe(
        88 + ((x - domain[0][0]) / (domain[0][1] - domain[0][0])) * 824,
      );
      expect(a.shared_pca.axis_domain).toBe(domain);
    }
  });
  it("trail has 13 exact ordered genuine layer points", () => {
    const trail = tokenTrail(a, 2);
    expect(trail.map((p) => p.layer)).toEqual(
      Array.from({ length: 13 }, (_, i) => i),
    );
    trail.forEach((p) =>
      expect([p.pc1, p.pc2]).toEqual(a.shared_pca.coordinates[p.layer][2]),
    );
  });
  it("64-token core matrices and shared projection contain all points", () => {
    expect(b.shared_pca.coordinates[6]).toHaveLength(64);
    expect(b.hidden_similarity[6]).toHaveLength(64);
    expect(b.same_token_layer_similarity).toHaveLength(64);
  });
  it.each([
    "missing",
    "scope",
    "NaN",
    "domain",
    "count",
    "distance shape",
    "cosine symmetry",
    "cosine diagonal",
    "negative distance",
  ])("rejects invalid %s", (kind) => {
    const x = JSON.parse(raw) as CoreAnalysisResult;
    switch (kind) {
      case "missing":
        delete (x as Partial<CoreAnalysisResult>).shared_pca;
        break;
      case "scope":
        x.shared_pca.fit_scope = "per_layer" as "all_layers_all_tokens";
        break;
      case "NaN":
        x.shared_pca.coordinates[1][2][0] = NaN;
        break;
      case "domain":
        x.shared_pca.axis_domain[0][0] = 0;
        break;
      case "count":
        x.shared_pca.fit_sample_count = 6;
        break;
      case "distance shape":
        x.same_token_layer_distance[0].pop();
        break;
      case "cosine symmetry":
        x.same_token_layer_similarity[0][0][1] = -0.9;
        break;
      case "cosine diagonal":
        x.same_token_layer_similarity[0][0][0] = 0.5;
        break;
      case "negative distance":
        x.same_token_layer_distance[0][0][1] = -1;
    }
    expect(() => validateAnalysis(x)).toThrow(/UNSUPPORTED/);
  });
  it("accepts retained schema 0.1.1 without changing semantics", () =>
    expect(
      validateAnalysis(
        JSON.parse(
          readFileSync("public/fixtures/legacy-0.1.1/showcase.json", "utf8"),
        ),
      ).metadata.analysis_version,
    ).toBe("0.1.1"));
});
describe("new microscope modes", () => {
  it("mode navigation retains layer/token/head and analysis identity", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Layer 6" }));
    fireEvent.click(screen.getByRole("button", { name: "H04" }));
    const reference = useMicroscope.getState().analysis;
    for (const mode of ["SIMILARITY", "SPACE", "COMPARE", "ATTENTION"]) {
      fireEvent.click(screen.getByRole("button", { name: mode }));
      expect(useMicroscope.getState().selectedLayer).toBe(6);
      expect(useMicroscope.getState().selectedToken).toBe(2);
      expect(useMicroscope.getState().selectedHead).toBe(3);
      expect(useMicroscope.getState().analysis).toBe(reference);
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("similarity keyboard readout and ranked relationships are exact", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "SIMILARITY" }));
    const canvas = screen.getByLabelText(/Hidden-state similarity matrix/);
    fireEvent.keyDown(canvas, { key: "ArrowDown" });
    fireEvent.keyDown(canvas, { key: "ArrowRight" });
    expect(screen.getByTestId("similarity-cell")).toHaveTextContent(
      a.hidden_similarity[1][1][1].toFixed(6),
    );
    expect(
      screen.getAllByTestId("ranked-cosine").map((e) => e.textContent),
    ).toEqual(
      rankRelationships(a.hidden_similarity[1], 2).map((p) =>
        p.value.toFixed(6),
      ),
    );
    expect(screen.getByRole("button", { name: "H04" })).toBeDisabled();
  });
  it("graph contains all other tokens", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "SIMILARITY" }));
    fireEvent.click(screen.getByRole("button", { name: "GRAPH" }));
    expect(screen.getAllByTestId("relationship-node")).toHaveLength(5);
  });
  it("space shares global axes, selection and accessible coordinates", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "SPACE" }));
    const plot = screen.getByTestId("space-plot"),
      domain = plot.getAttribute("data-domain");
    expect(screen.getAllByTestId("space-node")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Layer 6" }));
    expect(plot).toHaveAttribute("data-domain", domain);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Space token data" }),
      { target: { value: "4" } },
    );
    expect(useMicroscope.getState().selectedToken).toBe(4);
    expect(screen.getByTestId("selected-coordinate")).toHaveTextContent(
      a.shared_pca.coordinates[6][4][0].toFixed(6),
    );
    fireEvent.click(screen.getByRole("button", { name: "Embedding layer" }));
    expect(useMicroscope.getState().selectedLayer).toBe(0);
  });
  it("trail has all actual 13 coordinates with non-causal label", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "SPACE" }));
    fireEvent.click(screen.getByRole("button", { name: "TRAIL OFF" }));
    const points = screen.getAllByTestId("trail-point");
    expect(points).toHaveLength(13);
    points.forEach((p, l) => {
      expect(p).toHaveAttribute("data-layer", String(l));
      expect(Number(p.getAttribute("data-pc1"))).toBe(
        a.shared_pca.coordinates[l][2][0],
      );
    });
    expect(screen.getByText(/not a causal reasoning path/)).toBeInTheDocument();
  });
  it("compare FROM/TO uses genuine full-space distance and cosine", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "COMPARE" }));
    fireEvent.change(
      screen.getByRole("combobox", { name: "Compare FROM layer" }),
      { target: { value: "2" } },
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Compare TO layer" }),
      { target: { value: "10" } },
    );
    expect(screen.getByTestId("compare-distance")).toHaveTextContent(
      a.same_token_layer_distance[2][2][10].toFixed(6),
    );
    expect(screen.getByTestId("compare-cosine")).toHaveTextContent(
      a.same_token_layer_similarity[2][2][10].toFixed(6),
    );
    expect(screen.getByTestId("compare-magnitude-delta")).toHaveTextContent(
      (
        a.representation_magnitude[10][2] - a.representation_magnitude[2][2]
      ).toFixed(6),
    );
  });
  it("magnitude/change profiles expose exact values and EMB N/A", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "SPACE" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Profile layer" }), {
      target: { value: "6" },
    });
    expect(screen.getByTestId("profile-value")).toHaveTextContent(
      a.representation_magnitude[6][2].toFixed(6),
    );
    expect(screen.getByTestId("profile-value")).toHaveTextContent(
      a.representation_delta[6][2]!.toFixed(6),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Profile layer" }), {
      target: { value: "0" },
    });
    expect(screen.getByTestId("profile-value")).toHaveTextContent("N/A");
  });
  it("64 space has 64 nodes, no truncation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(raw64)),
    );
    render(<App />);
    await screen.findByRole("button", { name: "Token 63: hello" });
    fireEvent.click(screen.getByRole("button", { name: "SPACE" }));
    expect(screen.getAllByTestId("space-node")).toHaveLength(64);
  });
});
