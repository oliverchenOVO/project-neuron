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
  analysis_version: "0.1.1";
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
  analysis_schema_version: "0.1.1";
  numerical_transformation: string;
  provenance: string;
}
export interface AnalysisResult extends RepresentationMetrics {
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
export type FixtureId = "showcase" | "stress-64";
export type HeadSelection = "AVG" | number;
export type VisualizationMode = "HEATMAP" | "ARCS";
