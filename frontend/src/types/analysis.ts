export type SimilarityMatrix = number[][];
export type AttentionLayer = number[][][];
export type PCAProjection = [number, number][];
export interface TokenInfo {
  position: number;
  id: number;
  text: string;
  piece: string;
  offset: [number, number];
}
export interface PredictionEntry {
  token_id: number;
  token: string;
  probability: number;
  logit: number;
}
export type LogitLensLayer = PredictionEntry[];
export interface RepresentationMetrics {
  representation_magnitude: number[][];
  representation_delta: (number | null)[][];
}
export interface ModelMetadata {
  model: "openai-community/gpt2";
  model_revision: string;
  analysis_version: "0.1.1" | "0.2.0" | "0.3.0";
  device: "cpu" | "cuda";
  parameter_count: number;
  attention_implementation: "eager";
  max_tokens: 64;
  sequence_length: number;
  representation_basis: string;
  layer_labels: string[];
  attention_axes: string[];
  pca_basis: string;
  logit_lens_position: number;
  local_inference: true;
  local_only_loading: true;
  torch_version: string;
  transformers_version: string;
}
export interface FixtureProvenance {
  notice: string;
  name: string;
  public_prompt: string;
  generator_version: string;
  model_revision: string;
  analysis_schema_version: "0.1.1" | "0.2.0" | "0.3.0";
  numerical_transformation: string;
  provenance: string;
}
interface BaseAnalysisResult extends RepresentationMetrics {
  metadata: ModelMetadata;
  fixture: FixtureProvenance;
  tokens: TokenInfo[];
  token_ids: number[];
  layer_count: 12;
  head_count: 12;
  tensor_shapes: {
    word_embeddings: number[];
    position_embeddings: number[];
    hidden_states: number[][];
    raw_representations: number[][];
    attentions: number[][];
    final_logits: number[];
  };
  hidden_similarity: SimilarityMatrix[];
  pca_coordinates: PCAProjection[];
  pca_explained_variance_ratio: number[][];
  attention_matrices: AttentionLayer[];
  final_top_k: PredictionEntry[];
  logit_lens_top_k: LogitLensLayer[];
}
export interface SharedPCA {
  projection_type: "global_pca";
  fit_scope: "all_layers_all_tokens";
  components: 2;
  centering: "global_feature_mean";
  fit_sample_count: number;
  domain_padding_fraction: 0.08;
  explained_variance_ratio: [number, number];
  axis_domain: [[number, number], [number, number]];
  coordinates: PCAProjection[];
}
export interface LegacyAnalysisResult extends BaseAnalysisResult {
  metadata: ModelMetadata & { analysis_version: "0.1.1" };
}
export interface CoreAnalysisResult extends BaseAnalysisResult {
  metadata: ModelMetadata & { analysis_version: "0.2.0" | "0.3.0" };
  shared_pca: SharedPCA;
  same_token_layer_similarity: number[][][];
  same_token_layer_distance: number[][][];
}
export interface PredictionEvolution {
  position: number;
  stages: string[];
  probability_basis: "full_vocabulary_softmax_float64";
  projection: string;
  candidates: { token_id: number; token: string; logits: number[]; probabilities: number[] }[];
}
export interface JourneyAnalysisResult extends CoreAnalysisResult {
  metadata: ModelMetadata & { analysis_version: "0.3.0" };
  prediction_evolution: PredictionEvolution;
}
export type AnalysisResult = LegacyAnalysisResult | CoreAnalysisResult | JourneyAnalysisResult;
export function isCoreAnalysis(a: AnalysisResult): a is CoreAnalysisResult {
  return a.metadata.analysis_version === "0.2.0" || a.metadata.analysis_version === "0.3.0";
}
export function isJourneyAnalysis(a: AnalysisResult): a is JourneyAnalysisResult {
  return a.metadata.analysis_version === "0.3.0";
}
export type MicroscopeMode = "ATTENTION" | "SIMILARITY" | "SPACE" | "COMPARE" | "JOURNEY";
export type FixtureId = "showcase" | "stress-64";
export type HeadSelection = "AVG" | number;
export type VisualizationMode = "HEATMAP" | "ARCS";
