import type { CoreAnalysisResult } from "../types/analysis";
export const layerName = (layer: number) =>
  layer === 0 ? "EMB" : `L${String(layer).padStart(2, "0")}`;
export function similarityColor(value: number) {
  const t = Math.min(1, Math.abs(value));
  const target = value < 0 ? [163, 154, 219] : [116, 221, 217];
  return `rgb(${target.map((v, i) => Math.round([15, 25, 35][i] + (v - [15, 25, 35][i]) * t)).join(",")})`;
}
export function rankRelationships(matrix: number[][], token: number) {
  return matrix[token]
    .map((value, key) => ({ value, key }))
    .filter((x) => x.key !== token)
    .sort((a, b) => b.value - a.value || a.key - b.key);
}
export function relationshipGeometry(matrix: number[][], token: number) {
  const keys = matrix[token]
    .map((_, key) => key)
    .filter((key) => key !== token);
  return keys.map((key, index) => {
    const value = matrix[token][key],
      angle = -Math.PI / 2 + (index * 2 * Math.PI) / Math.max(1, keys.length),
      radius = 100 + (78 * (1 - Math.max(-1, Math.min(1, value)))) / 2;
    return {
      key,
      value,
      x: 500 + Math.cos(angle) * radius,
      y: 210 + Math.sin(angle) * radius,
      radius,
    };
  });
}
export function projectedPoint(
  a: CoreAnalysisResult,
  layer: number,
  token: number,
) {
  const [x, y] = a.shared_pca.coordinates[layer][token],
    [[xmin, xmax], [ymin, ymax]] = a.shared_pca.axis_domain;
  return {
    x: 88 + ((x - xmin) / (xmax - xmin)) * 824,
    y: 344 - ((y - ymin) / (ymax - ymin)) * 294,
    pc1: x,
    pc2: y,
  };
}
export function tokenTrail(a: CoreAnalysisResult, token: number) {
  return Array.from({ length: 13 }, (_, layer) => ({
    layer,
    ...projectedPoint(a, layer, token),
  }));
}
/** Move labels only. Points and axis mapping are never displaced. */
export function projectedLabels(
  points: { x: number; y: number }[],
  keys: number[],
  width = 1000,
  height = 420,
) {
  const sorted = keys
    .map((key) => ({ key, ...points[key] }))
    .sort((a, b) => a.y - b.y || a.key - b.key);
  const labels = new Map<number, { x: number; y: number }>();
  const gap = Math.max(10, Math.min(18, (height - 35) / (keys.length + 1)));
  let last = 8;
  for (const p of sorted) {
    const y = Math.max(p.y, last + gap);
    labels.set(p.key, { x: Math.min(width - 100, p.x + 20), y });
    last = y;
  }
  const overflow = Math.max(0, last - (height - 36));
  for (const p of labels.values()) p.y -= overflow;
  return labels;
}
