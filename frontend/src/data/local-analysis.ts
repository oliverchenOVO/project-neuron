import { validateAnalysis } from "./validate";
import { isCoreAnalysis, type CoreAnalysisResult } from "../types/analysis";

export const MAX_LOCAL_BYTES = 32 * 1024 * 1024;
export const LOCAL_NOTICE = "LOCAL ANALYSIS · FILE SOURCE NOT VERIFIED";
const runtimeFields = ["model_source", "cache_hit", "forward_ms", "analysis_ms", "request_ms", "new_metrics_ms"];

/** Adapt engine CLI output without changing any model-derived numeric arrays. */
export function parseLocalAnalysis(raw: string): CoreAnalysisResult {
  let value: unknown;
  try {
    value = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("無法解析 JSON。請選擇 engine.cli 產生的分析檔案。");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("分析檔案必須是 JSON object。");
  const input = value as Record<string, unknown>;
  if (!input.metadata || typeof input.metadata !== "object" || Array.isArray(input.metadata))
    throw new Error("缺少模型 metadata。");
  const metadata = { ...input.metadata as Record<string, unknown> };
  for (const key of runtimeFields) delete metadata[key];
  if (!Array.isArray(input.tokens) || input.tokens.length < 1 || input.tokens.length > 64)
    throw new Error("分析必須包含 1–64 tokens。");
  // CLI has no original-prompt field. Reassemble decoded token text exactly,
  // including whitespace; never infer a prompt from BPE pieces.
  const decoded = Array.isArray(input.tokens)
    ? input.tokens.map((t: unknown) => {
        if (!t || typeof t !== "object" || typeof (t as { text?: unknown }).text !== "string")
          throw new Error("Token 缺少解碼文字。");
        return (t as { text: string }).text;
      }).join("")
    : "";
  const original = input.input_text ?? (input.fixture as { public_prompt?: unknown } | undefined)?.public_prompt;
  if (original !== undefined && typeof original !== "string") throw new Error("input_text 必須是文字。");
  if (original === undefined && decoded.includes("\uFFFD"))
    throw new Error("此舊版檔案缺少原始輸入文字，分詞含不完整 Unicode。請使用目前版本的 CLI 重新輸出。");
  const prompt = typeof original === "string" ? original : decoded;
  const { input_text: _originalPrompt, ...payload } = input;
  const analysis = validateAnalysis({
    ...payload,
    metadata,
    fixture: {
      notice: LOCAL_NOTICE,
      name: "local-import",
      public_prompt: prompt,
      generator_version: "local-file-import/1",
      model_revision: metadata.model_revision,
      analysis_schema_version: metadata.analysis_version,
      numerical_transformation: "none; original engine values preserved",
      provenance: "User-selected local file; schema validated, origin not independently verified",
    },
  }, { local: true });
  if (!isCoreAnalysis(analysis))
    throw new Error("需要 schema 0.2.0。請使用目前版本的 engine.cli 重新分析。");
  return analysis;
}

export async function readLocalAnalysis(file: Pick<File, "size" | "text">) {
  if (file.size > MAX_LOCAL_BYTES)
    throw new Error("檔案超過 32 MiB。請選擇最多 64 tokens 的分析 JSON。");
  if (file.size === 0) throw new Error("檔案是空的，請重新選擇。");
  return parseLocalAnalysis(await file.text());
}
