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
export function validateAnalysis(value: unknown, options: { local?: boolean } = {}): AnalysisResult {
  const version = (
    value as { metadata?: { analysis_version?: unknown } } | null
  )?.metadata?.analysis_version;
  if (version !== "0.1.1" && version !== "0.2.0" && version !== "0.3.0") fail("schema version");
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
    ...(version !== "0.1.1"
      ? [
          "shared_pca",
          "same_token_layer_similarity",
          "same_token_layer_distance",
        ]
      : []),
    ...(version === "0.3.0" ? ["prediction_evolution"] : []),
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
  equal(m.analysis_version, version, "schema version");
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
    options.local ? "LOCAL ANALYSIS · FILE SOURCE NOT VERIFIED" : "GENERATED FROM REAL GPT-2 OUTPUT — NOT MOCK DATA",
    "fixture notice",
  );
  equal(f.model_revision, REVISION, "fixture revision");
  equal(f.analysis_schema_version, version, "fixture schema");
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
  if (version !== "0.1.1") {
    const p = object(a.shared_pca, "shared PCA", [
      "projection_type",
      "fit_scope",
      "components",
      "centering",
      "fit_sample_count",
      "domain_padding_fraction",
      "explained_variance_ratio",
      "axis_domain",
      "coordinates",
    ]);
    equal(p.projection_type, "global_pca", "shared projection type");
    equal(p.fit_scope, "all_layers_all_tokens", "shared fit scope");
    equal(p.components, 2, "shared axes");
    equal(p.centering, "global_feature_mean", "shared centering");
    equal(p.fit_sample_count, 13 * n, "fit sample count");
    equal(p.domain_padding_fraction, 0.08, "fixed padding");
    const ratios = array(p.explained_variance_ratio, 2, "shared variance");
    if (
      num(ratios[0], "PC1 variance", 0, 1) +
        num(ratios[1], "PC2 variance", 0, 1) >
      1 + 1e-6
    )
      fail("shared variance sum");
    const domains = array(p.axis_domain, 2, "shared domains").map((axis) => {
      const pair = array(axis, 2, "axis range");
      const low = num(pair[0], "axis minimum"),
        high = num(pair[1], "axis maximum");
      if (low >= high) fail("shared axis domain");
      return [low, high];
    });
    const extrema = [
      [Infinity, -Infinity],
      [Infinity, -Infinity],
    ];
    const center = [0, 0];
    array(p.coordinates, 13, "shared layers").forEach((row) =>
      array(row, n, "shared tokens").forEach((point) =>
        array(point, 2, "shared coordinate").forEach((v, i) => {
          const x = num(v, "shared coordinate", domains[i][0], domains[i][1]);
          extrema[i][0] = Math.min(extrema[i][0], x);
          extrema[i][1] = Math.max(extrema[i][1], x);
          center[i] += x;
        }),
      ),
    );
    domains.forEach((domain, i) => {
      const span = extrema[i][1] - extrema[i][0],
        pad = span > 0 ? span * 0.08 : 0.5;
      if (
        Math.abs(domain[0] - (extrema[i][0] - pad)) > 1e-7 ||
        Math.abs(domain[1] - (extrema[i][1] + pad)) > 1e-7
      )
        fail("shared fixed global domain");
      if (Math.abs(center[i] / (13 * n)) > 1e-7)
        fail("shared global centering");
    });
    const cross = array(
        a.same_token_layer_similarity,
        n,
        "cross-layer token count",
      ),
      dist = array(a.same_token_layer_distance, n, "cross-layer distances");
    cross.forEach((item, token) => {
      matrix(item, 13, "cross-layer cosine", -1, 1);
      matrix(dist[token], 13, "cross-layer distance", 0);
      const c = item as number[][],
        d = dist[token] as number[][],
        magnitudes = a.representation_magnitude as number[][],
        delta = a.representation_delta as (number | null)[][];
      for (let i = 0; i < 13; i++) {
        if (
          Math.abs(c[i][i] - (magnitudes[i][token] > 1e-12 ? 1 : 0)) > 1e-5 ||
          d[i][i] !== 0
        )
          fail("cross-layer diagonal");
        for (let j = 0; j < 13; j++)
          if (
            Math.abs(c[i][j] - c[j][i]) > 1e-6 ||
            Math.abs(d[i][j] - d[j][i]) > 1e-6
          )
            fail("cross-layer symmetry");
        if (
          i > 0 &&
          Math.abs(d[i - 1][i] - delta[i][token]!) >
            Math.max(1e-5, Math.abs(delta[i][token]!) * 1e-5)
        )
          fail("cross-layer consecutive change");
      }
    });
  }
  if (version === "0.3.0") {
    const e = object(a.prediction_evolution, "prediction evolution", ["position", "stages", "probability_basis", "projection", "candidates"]);
    equal(e.position, n - 1, "evolution position is last input");
    equal(e.probability_basis, "full_vocabulary_softmax_float64", "evolution normalization");
    equal(e.projection, "raw_residual -> final_ln_f -> lm_head; OUT = forward logits", "evolution projection");
    const labels = ["EMB", ...Array.from({ length: 12 }, (_, i) => `L${String(i + 1).padStart(2, "0")}`), "OUT"];
    array(e.stages, 14, "evolution stages").forEach((s, i) => equal(s, labels[i], "evolution stage label"));
    const finals = a.final_top_k as { token_id: number; token: string; probability: number; logit: number }[];
    array(e.candidates, 5, "fixed candidates").forEach((v, i) => {
      const c = object(v, "candidate", ["token_id", "token", "logits", "probabilities"]);
      equal(c.token_id, finals[i].token_id, "candidate final rank");
      equal(c.token, finals[i].token, "candidate text");
      const logits = array(c.logits, 14, "candidate logits"), probabilities = array(c.probabilities, 14, "candidate probabilities");
      logits.forEach((x) => num(x, "candidate logit"));
      probabilities.forEach((x) => num(x, "candidate probability", 0, 1));
      equal(logits[13], finals[i].logit, "OUT logit");
      equal(probabilities[13], finals[i].probability, "OUT probability");
      const lens = a.logit_lens_top_k as { token_id: number; probability: number; logit: number }[][];
      for (let stage = 0; stage < 13; stage++) {
        const ranked = lens[stage].find((p) => p.token_id === c.token_id);
        if (ranked) {
          equal(logits[stage], ranked.logit, "candidate/lens logit mismatch");
          equal(probabilities[stage], ranked.probability, "candidate/lens probability mismatch");
        } else if ((probabilities[stage] as number) > lens[stage].at(-1)!.probability + 1e-12) fail("missing candidate exceeds top-k floor");
      }
    });
    for (let stage = 0; stage < 14; stage++) {
      const cs = e.candidates as { logits: number[]; probabilities: number[] }[];
      if (cs.reduce((total, c) => total + c.probabilities[stage], 0) > 1 + 1e-6) fail("candidate probability sum");
      // All probabilities at a stage share the same full-vocabulary denominator.
      const positive = cs.filter((c) => c.probabilities[stage] > 0);
      if (positive.length) {
        const logZ = positive[0].logits[stage] - Math.log(positive[0].probabilities[stage]);
        if (positive.some((c) => Math.abs(c.logits[stage] - Math.log(c.probabilities[stage]) - logZ) > 1e-8)) fail("candidate normalization inconsistent");
      }
    }
  }
  return value as AnalysisResult;
}
