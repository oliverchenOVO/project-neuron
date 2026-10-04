import type { AnalysisResult } from "../types/analysis";
export const REVISION = "607a30d783dfa663caf39e06633721c8d4cfcd7e";
export const CAUSAL_TOLERANCE = 1e-6;
export class AnalysisValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisValidationError";
  }
}
function fail(path: string): never {
  throw new AnalysisValidationError(`UNSUPPORTED ANALYSIS DATA · ${path}`);
}
function object(
  value: unknown,
  path: string,
  keys: string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path);
  const result = value as Record<string, unknown>;
  if (
    Object.keys(result).length !== keys.length ||
    keys.some((k) => !(k in result))
  )
    fail(`${path}: unexpected/missing fields`);
  return result;
}
function array(value: unknown, length: number, path: string): unknown[] {
  if (!Array.isArray(value) || value.length !== length)
    fail(`${path}: expected ${length} entries`);
  return value;
}
function num(
  v: unknown,
  path: string,
  min = -Infinity,
  max = Infinity,
): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    fail(`${path}: invalid numeric value`);
  return v;
}
function int(v: unknown, path: string, min = 0, max = Infinity): number {
  const n = num(v, path, min, max);
  if (!Number.isInteger(n)) fail(path);
  return n;
}
function text(v: unknown, path: string): string {
  if (typeof v !== "string") fail(path);
  return v;
}
function equal(v: unknown, expected: unknown, path: string) {
  if (v !== expected) fail(path);
}
function shape(value: unknown, expected: number[], path: string) {
  const a = array(value, expected.length, path);
  a.forEach((v, i) => equal(v, expected[i], path));
}
function matrix(
  value: unknown,
  n: number,
  path: string,
  min = -Infinity,
  max = Infinity,
) {
  array(value, n, path).forEach((row, q) =>
    array(row, n, path).forEach((v, k) =>
      num(v, `${path}[${q},${k}]`, min, max),
    ),
  );
}
function predictions(value: unknown, path: string, length = 10) {
  let previous = Infinity,
    total = 0;
  const seen = new Set<number>();
  array(value, length, path).forEach((item, i) => {
    const p = object(item, `${path}[${i}]`, [
      "token_id",
      "token",
      "probability",
      "logit",
    ]);
    const id = int(p.token_id, path, 0, 50256);
    if (seen.has(id)) fail(`${path}: duplicate token`);
    seen.add(id);
    text(p.token, path);
    num(p.logit, path);
    const probability = num(p.probability, path, 0, 1);
    if (probability > previous + 1e-12)
      fail(`${path}: rankings not descending`);
    previous = probability;
    total += probability;
  });
  if (total > 1 + 1e-6) fail(`${path}: top-k sum exceeds one`);
}

/** Validate all dimensions/semantics in place. No cloning, precision loss or default values. */
export function validateAnalysis(value: unknown): AnalysisResult {
  const a = object(value, "analysis", [
    "metadata",
    "fixture",
    "tokens",
    "token_ids",
    "layer_count",
    "head_count",
    "tensor_shapes",
    "representation_magnitude",
    "representation_delta",
    "hidden_similarity",
    "pca_coordinates",
    "pca_explained_variance_ratio",
    "attention_matrices",
    "final_top_k",
    "logit_lens_top_k",
  ]);
  const m = object(a.metadata, "metadata", [
    "model",
    "model_revision",
    "analysis_version",
    "device",
    "parameter_count",
    "attention_implementation",
    "max_tokens",
    "sequence_length",
    "representation_basis",
    "layer_labels",
    "attention_axes",
    "pca_basis",
    "logit_lens_position",
    "local_inference",
    "local_only_loading",
    "torch_version",
    "transformers_version",
  ]);
  equal(m.model, "openai-community/gpt2", "model");
  equal(m.model_revision, REVISION, "revision");
  equal(m.analysis_version, "0.1.1", "schema version");
  equal(m.parameter_count, 124439808, "parameters");
  equal(m.attention_implementation, "eager", "attention implementation");
  equal(m.max_tokens, 64, "maximum context");
  if (m.device !== "cpu" && m.device !== "cuda") fail("device");
  equal(m.local_inference, true, "local inference");
  equal(m.local_only_loading, true, "local model loading");
  const n = int(m.sequence_length, "sequence length", 1, 64);
  equal(m.logit_lens_position, n - 1, "lens position");
  [
    "representation_basis",
    "pca_basis",
    "torch_version",
    "transformers_version",
  ].forEach((k) => text(m[k], k));
  array(m.layer_labels, 13, "layer labels").forEach((l, i) =>
    equal(l, i === 0 ? "EMB" : `L${i}`, "layer label"),
  );
  array(m.attention_axes, 4, "attention axes").forEach((v, i) =>
    equal(v, ["layer", "head", "query", "key"][i], "attention axes"),
  );
  equal(a.layer_count, 12, "layer count");
  equal(a.head_count, 12, "head count");
  const f = object(a.fixture, "fixture", [
    "notice",
    "name",
    "public_prompt",
    "generator_version",
    "model_revision",
    "analysis_schema_version",
    "numerical_transformation",
    "provenance",
  ]);
  equal(
    f.notice,
    "GENERATED FROM REAL GPT-2 OUTPUT — NOT MOCK DATA",
    "fixture notice",
  );
  equal(f.model_revision, REVISION, "fixture revision");
  equal(f.analysis_schema_version, "0.1.1", "fixture schema");
  equal(
    f.numerical_transformation,
    "none; original engine values preserved",
    "numeric provenance",
  );
  const prompt = text(f.public_prompt, "public prompt");
  if (!prompt.trim()) fail("empty public prompt");
  ["name", "generator_version", "provenance"].forEach((k) => text(f[k], k));
  const ids = array(a.token_ids, n, "token ids");
  array(a.tokens, n, "tokens").forEach((item, i) => {
    const t = object(item, "token", [
      "position",
      "id",
      "text",
      "piece",
      "offset",
    ]);
    equal(t.position, i, "token position");
    const id = int(t.id, "token ID", 0, 50256);
    equal(ids[i], id, "token ID mismatch");
    text(t.text, "token display text");
    text(t.piece, "BPE piece");
    const offset = array(t.offset, 2, "token offset");
    const start = int(offset[0], "offset start", 0, prompt.length);
    int(offset[1], "offset end", start, prompt.length);
  });
  const s = object(a.tensor_shapes, "shapes", [
    "word_embeddings",
    "position_embeddings",
    "hidden_states",
    "raw_representations",
    "attentions",
    "final_logits",
  ]);
  shape(s.word_embeddings, [1, n, 768], "word embeddings");
  shape(s.position_embeddings, [1, n, 768], "position embeddings");
  array(s.hidden_states, 13, "hidden states").forEach((v) =>
    shape(v, [1, n, 768], "hidden state"),
  );
  array(s.raw_representations, 13, "residual streams").forEach((v) =>
    shape(v, [n, 768], "residual stream"),
  );
  array(s.attentions, 12, "attention shapes").forEach((v) =>
    shape(v, [1, 12, n, n], "attention shape"),
  );
  shape(s.final_logits, [1, n, 50257], "logits");
  array(a.representation_magnitude, 13, "magnitudes").forEach((row) =>
    array(row, n, "magnitude row").forEach((v) => num(v, "magnitude", 0)),
  );
  array(a.representation_delta, 13, "changes").forEach((row, l) =>
    array(row, n, "change row").forEach((v) =>
      l === 0 ? equal(v, null, "EMB change") : num(v, "change", 0),
    ),
  );
  array(a.hidden_similarity, 13, "similarities").forEach((v) =>
    matrix(v, n, "cosine matrix", -1, 1),
  );
  array(a.pca_coordinates, 13, "PCA").forEach((row) =>
    array(row, n, "PCA tokens").forEach((x) =>
      array(x, 2, "PCA coordinate").forEach((v) => num(v, "PCA value")),
    ),
  );
  array(a.pca_explained_variance_ratio, 13, "PCA variance").forEach((row) => {
    const v = array(row, 2, "PCA variance axes");
    if (num(v[0], "variance", 0, 1) + num(v[1], "variance", 0, 1) > 1 + 1e-6)
      fail("PCA variance sum");
  });
  // Hot path: no per-cell strings/objects in the 589,824-value stress scan.
  array(a.attention_matrices, 12, "attention layers").forEach((layer, l) =>
    array(layer, 12, "attention heads").forEach((head, h) =>
      array(head, n, "query rows").forEach((row, q) => {
        const entries = array(row, n, "key columns");
        let sum = 0;
        for (let k = 0; k < n; k++) {
          const w = entries[k];
          if (
            typeof w !== "number" ||
            !Number.isFinite(w) ||
            w < 0 ||
            w > 1 + 1e-6
          )
            fail(`attention ${l}/${h}/${q}/${k}`);
          if (k > q && w > CAUSAL_TOLERANCE)
            fail(`causal future attention ${l}/${h}/${q}/${k}`);
          sum += w;
        }
        if (Math.abs(sum - 1) > 1e-5) fail(`attention row sum ${l}/${h}/${q}`);
      }),
    ),
  );
  predictions(a.final_top_k, "final predictions");
  array(a.logit_lens_top_k, 13, "lens layers").forEach((v) =>
    predictions(v, "lens predictions"),
  );
  return value as AnalysisResult;
}
