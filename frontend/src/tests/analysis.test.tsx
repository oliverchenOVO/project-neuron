import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../app/App";
import { validateAnalysis } from "../data/validate";
import { FixtureDataSource, fixtureSource } from "../data/source";
import {
  getAttention,
  strongestTargets,
  displayToken,
} from "../utils/attention";
import { useMicroscope } from "../state/microscope";
import type { AnalysisResult } from "../types/analysis";
const raw = readFileSync("public/fixtures/showcase.json", "utf8");
const raw64 = readFileSync("public/fixtures/stress-64.json", "utf8");
const analysis = validateAnalysis(JSON.parse(raw));
const mutated = (fn: (a: AnalysisResult) => void) => {
  const a = JSON.parse(raw);
  fn(a);
  return a;
};
beforeEach(() => {
  fixtureSource.clear("showcase");
  fixtureSource.clear("stress-64");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(raw)),
  );
  useMicroscope.setState({
    analysis: null,
    status: "loading",
    selectedLayer: 1,
    selectedHead: "AVG",
    selectedToken: null,
    visualizationMode: "HEATMAP",
  });
});
describe("real fixture contract", () => {
  it("accepts genuine data without cloning", () => {
    const a = JSON.parse(raw);
    expect(validateAnalysis(a)).toBe(a);
    expect(a.token_ids).toEqual([464, 3797, 3332, 319, 262, 2603]);
  });
  it("accepts exactly 64 tokens", () =>
    expect(validateAnalysis(JSON.parse(raw64)).tokens).toHaveLength(64));
  it.each([
    "schema",
    "revision",
    "empty",
    "65 tokens",
    "shape",
    "NaN",
    "future",
    "row sum",
    "probability",
    "ranking",
    "extra field",
  ])("rejects %s", (kind) => {
    const a = mutated((a) => {
      switch (kind) {
        case "schema":
          a.metadata.analysis_version = "9" as "0.1.1";
          break;
        case "revision":
          a.metadata.model_revision = "invalid";
          break;
        case "empty":
          a.tokens = [];
          break;
        case "65 tokens":
          a.metadata.sequence_length = 65;
          break;
        case "shape":
          a.attention_matrices.pop();
          break;
        case "NaN":
          a.representation_magnitude[1][0] = NaN;
          break;
        case "future":
          a.attention_matrices[0][0][0][1] = 0.1;
          break;
        case "row sum":
          a.attention_matrices[0][0][0][0] = 0.5;
          break;
        case "probability":
          a.final_top_k[0].probability = 1.1;
          break;
        case "ranking":
          a.final_top_k.reverse();
          break;
        case "extra field":
          Object.assign(a, { fake: true });
      }
    });
    expect(() => validateAnalysis(a)).toThrow(/UNSUPPORTED ANALYSIS DATA/);
  });
  it("AVG is arithmetic mean and cached", () => {
    const m = getAttention(analysis, 6, "AVG");
    for (let q = 0; q < 6; q++)
      for (let k = 0; k < 6; k++)
        expect(m[q][k]).toBe(
          analysis.attention_matrices[5].reduce((sum, h) => sum + h[q][k], 0) /
            12,
        );
    expect(getAttention(analysis, 6, "AVG")).toBe(m);
  });
  it("individual heads retain exact references", () =>
    expect(getAttention(analysis, 12, 11)).toBe(
      analysis.attention_matrices[11][11],
    ));
  it("future cells are zero", () => {
    for (const layer of analysis.attention_matrices)
      for (const h of layer)
        for (let q = 0; q < 6; q++)
          for (let k = q + 1; k < 6; k++) expect(h[q][k]).toBe(0);
  });
  it("arc top-N excludes future/zero and orders genuine weights", () => {
    const m = getAttention(analysis, 1, "AVG"),
      edges = strongestTargets(m, 2);
    expect(edges).toHaveLength(3);
    expect(edges.every((e) => e.key <= 2 && e.weight > 0)).toBe(true);
    expect(edges.map((e) => e.weight)).toEqual(
      edges.map((e) => e.weight).sort((a, b) => b - a),
    );
    expect(strongestTargets(m, 5)).toHaveLength(5);
  });
  it("preserves raw whitespace and separately displays visible whitespace", () => {
    expect(analysis.tokens[2].piece).toBe("Ġsat");
    expect(analysis.tokens[2].text).toBe(" sat");
    expect(displayToken(" \n\t")).toBe("·↵⇥");
  });
  it("source caches a single fetch/parse and shared object", async () => {
    const source = new FixtureDataSource();
    const [a, b] = await Promise.all([
      source.load("showcase"),
      source.load("showcase"),
    ]);
    expect(a.analysis).toBe(b.analysis);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a.timings.bytes).toBe(Buffer.byteLength(raw));
  });
  it("formal HTTP failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    await expect(new FixtureDataSource().load("showcase")).rejects.toThrow(
      /FIXTURE UNAVAILABLE/,
    );
  });
});
describe("rendered microscope", () => {
  async function ready() {
    render(<App />);
    await screen.findByRole("button", { name: "Token 2: sat" });
  }
  it("renders six real tokens and genuine final predictions", async () => {
    await ready();
    expect(screen.getAllByRole("button", { name: /^Token \d:/ })).toHaveLength(
      6,
    );
    expect(screen.getAllByTestId("prediction")).toHaveLength(10);
    for (const p of analysis.final_top_k)
      expect(
        document.querySelector(`[data-probability="${p.probability}"]`),
      ).toHaveStyle({ width: `${p.probability * 100}%` });
    expect(
      analysis.final_top_k.reduce((s, p) => s + p.probability, 0),
    ).toBeLessThan(1);
  });
  it("sat switches to genuine arcs, inspector indexes raw representation layer", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Token 2: sat" }));
    expect(screen.getByRole("button", { name: "ARCS" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByTestId("attention-arc")).toHaveLength(3);
    expect(screen.getByTestId("magnitude")).toHaveTextContent(
      analysis.representation_magnitude[1][2].toFixed(6),
    );
    expect(screen.getByTestId("delta")).toHaveTextContent(
      analysis.representation_delta[1][2]!.toFixed(6),
    );
    expect(screen.getByTestId("raw-piece")).toHaveTextContent("Ġsat");
  });
  it("layer/head changes keep large result reference and update values", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Token 2: sat" }));
    const reference = useMicroscope.getState().analysis;
    for (const layer of [6, 12]) {
      fireEvent.click(screen.getByRole("button", { name: `Layer ${layer}` }));
      expect(screen.getByTestId("magnitude")).toHaveTextContent(
        analysis.representation_magnitude[layer][2].toFixed(6),
      );
    }
    for (let h = 1; h <= 12; h++)
      fireEvent.click(
        screen.getByRole("button", { name: `H${String(h).padStart(2, "0")}` }),
      );
    expect(useMicroscope.getState().analysis).toBe(reference);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("keyboard heatmap exposes exact values and future mask", async () => {
    await ready();
    const canvas = screen.getByLabelText(/Attention heatmap/);
    fireEvent.focus(canvas);
    fireEvent.keyDown(canvas, { key: "ArrowRight" });
    expect(screen.getByTestId("cell-readout")).toHaveTextContent("0.000000");
    expect(screen.getByTestId("cell-readout")).toHaveTextContent("CAUSAL MASK");
    fireEvent.keyDown(canvas, { key: "ArrowDown" });
    expect(screen.getByTestId("cell-readout")).toHaveTextContent(
      getAttention(analysis, 1, "AVG")[1][1].toFixed(6),
    );
  });
  it("global arrow keys and disabled embedding", async () => {
    await ready();
    expect(screen.getByRole("button", { name: "EMB" })).toBeDisabled();
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: "Layer 2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("unselected arcs have no edges", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "ARCS" }));
    expect(screen.queryAllByTestId("attention-arc")).toHaveLength(0);
  });
  it("invalid data renders a visible formal error, no numeric substitute", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}")),
    );
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "UNSUPPORTED ANALYSIS DATA",
    );
    expect(screen.queryByTestId("prediction")).not.toBeInTheDocument();
  });
  it("loading is explicit before data arrives", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((r) => (resolve = r))),
    );
    render(<App />);
    expect(screen.getByText("LOADING REAL FIXTURE")).toBeInTheDocument();
    resolve(new Response(raw));
    await waitFor(() =>
      expect(screen.getAllByTestId("prediction")).toHaveLength(10),
    );
  });
  it("information explains fixture and mathematical limits", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Information" }));
    expect(
      screen.getByText(/GENERATED FROM REAL GPT-2 OUTPUT/),
    ).toBeInTheDocument();
    expect(screen.getByText(/PCA uses independent axes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close information" }));
    expect(document.querySelector("dialog")).not.toBeInTheDocument();
  });
});
