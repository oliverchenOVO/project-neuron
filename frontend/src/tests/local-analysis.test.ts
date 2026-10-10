import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_LOCAL_BYTES, LOCAL_NOTICE, parseLocalAnalysis, readLocalAnalysis } from "../data/local-analysis";
import { validateAnalysis } from "../data/validate";
import { useMicroscope } from "../state/microscope";

const raw = readFileSync("public/fixtures/showcase.json", "utf8");
const genuine = validateAnalysis(JSON.parse(raw));
function cliPayload() {
  const { fixture, ...input } = JSON.parse(raw);
  return { ...input, input_text: fixture.public_prompt, metadata: { ...input.metadata,
    model_source: "private/model/path", cache_hit: false, forward_ms: 1, analysis_ms: 2, request_ms: 2, new_metrics_ms: 1 } };
}
function file(name: string, text: () => Promise<string>): File {
  return { name, size: raw.length, text } as File;
}
beforeEach(() => useMicroscope.setState({ analysis: genuine, status: "ready", localFilename: null,
  selectedToken: 2, selectedLayer: 6, microscopeMode: "SPACE", trail: true, error: null }));

describe("local CLI import", () => {
  it("preserves every numeric field while removing machine paths and runtime timings", () => {
    const imported = parseLocalAnalysis(JSON.stringify(cliPayload()));
    for (const key of ["attention_matrices", "shared_pca", "same_token_layer_distance", "final_top_k"] as const)
      expect(imported[key]).toEqual(JSON.parse(raw)[key]);
    expect(imported.fixture.notice).toBe(LOCAL_NOTICE);
    expect(imported.fixture.public_prompt).toBe("The cat sat on the mat");
    expect(imported.metadata).not.toHaveProperty("model_source");
    expect(() => validateAnalysis(imported)).toThrow(/fixture notice/);
  });
  it("uses original prompt rather than concatenating incomplete UTF-8 token decodes", () => {
    const input = cliPayload();
    input.tokens[1].text = "\uFFFD";
    expect(parseLocalAnalysis(JSON.stringify(input)).fixture.public_prompt).toBe(input.input_text);
    delete (input as { input_text?: string }).input_text;
    expect(() => parseLocalAnalysis(JSON.stringify(input))).toThrow(/Unicode/);
  });
  it("accepts genuine public JSON and UTF-8 BOM but identifies it as a local file", () => {
    expect(parseLocalAnalysis("\uFEFF" + raw).fixture.notice).toBe(LOCAL_NOTICE);
  });
  it.each(["{", "[]", "null"])("rejects malformed/non-object JSON: %s", (s) => {
    expect(() => parseLocalAnalysis(s)).toThrow();
  });
  it("rejects wrong model revision and causal matrix corruption", () => {
    const input = cliPayload();
    input.metadata.model_revision = "unknown";
    expect(() => parseLocalAnalysis(JSON.stringify(input))).toThrow(/revision/);
    input.metadata.model_revision = genuine.metadata.model_revision;
    input.attention_matrices[0][0][0][1] = 0.1;
    expect(() => parseLocalAnalysis(JSON.stringify(input))).toThrow(/causal/);
  });
  it("rejects oversized/empty files before reading", async () => {
    const text = vi.fn();
    await expect(readLocalAnalysis({ size: MAX_LOCAL_BYTES + 1, text })).rejects.toThrow(/32 MiB/);
    await expect(readLocalAnalysis({ size: 0, text })).rejects.toThrow(/空/);
    expect(text).not.toHaveBeenCalled();
  });
  it("keeps the previous analysis and selections when import fails", async () => {
    await expect(useMicroscope.getState().importLocal(file("bad.json", async () => "{"))).rejects.toThrow();
    expect(useMicroscope.getState()).toMatchObject({ analysis: genuine, selectedToken: 2, selectedLayer: 6, status: "ready", trail: true });
  });
  it("resets selections for a new import without fetching or persisting it", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(raw));
    await useMicroscope.getState().importLocal(file("mine.json", async () => raw));
    expect(useMicroscope.getState()).toMatchObject({ localFilename: "mine.json", selectedToken: null,
      selectedLayer: 1, trail: false, microscopeMode: "ATTENTION", loadTimings: null });
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
  it("ignores cancelled reads and an old read after switching back to a fixture", async () => {
    let finish!: (s: string) => void;
    const delayed = file("late.json", () => new Promise((r) => { finish = r; }));
    const controller = new AbortController();
    const cancelled = useMicroscope.getState().importLocal(delayed, controller.signal);
    controller.abort(); finish(raw);
    expect(await cancelled).toBe(false);
    const pending = useMicroscope.getState().importLocal(delayed);
    await useMicroscope.getState().load("showcase", { clear() {}, async load() {
      return { analysis: genuine, timings: { fixture: "showcase", bytes: raw.length, fetchMs: 0, parseMs: 0, validationMs: 0, stateMs: 0 } };
    } });
    finish(raw);
    expect(await pending).toBe(false);
    expect(useMicroscope.getState().localFilename).toBeNull();
  });
});
