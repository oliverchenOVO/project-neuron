import type { AnalysisResult, HeadSelection } from "../types/analysis";
export const displayToken = (text: string) =>
  text.replaceAll(" ", "·").replaceAll("\n", "↵").replaceAll("\t", "⇥");
const means = new WeakMap<AnalysisResult, Map<number, number[][]>>();
export function getAttention(
  a: AnalysisResult,
  layer: number,
  head: HeadSelection,
): number[][] {
  if (head !== "AVG") return a.attention_matrices[layer - 1][head];
  let layers = means.get(a);
  if (!layers) {
    layers = new Map();
    means.set(a, layers);
  }
  const found = layers.get(layer);
  if (found) return found;
  const source = a.attention_matrices[layer - 1],
    n = a.tokens.length;
  const matrix = Array.from({ length: n }, (_, q) =>
    Array.from(
      { length: n },
      (_, k) => source.reduce((sum, h) => sum + h[q][k], 0) / a.head_count,
    ),
  );
  layers.set(layer, matrix);
  return matrix;
}
export function strongestTargets(
  matrix: number[][],
  query: number,
  count = 5,
): { key: number; weight: number }[] {
  return matrix[query]
    .slice(0, query + 1)
    .map((weight, key) => ({ weight, key }))
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.key - b.key)
    .slice(0, count);
}
export function weightColor(weight: number): string {
  // Fixed transfer function [0,1] -> graphite/cyan. It never changes by head.
  const t = Math.sqrt(Math.max(0, Math.min(1, weight)));
  return `rgb(${Math.round(15 + 99 * t)},${Math.round(25 + 196 * t)},${Math.round(35 + 182 * t)})`;
}
export const headLabel = (head: HeadSelection) =>
  head === "AVG" ? "AVG" : `H${String(head + 1).padStart(2, "0")}`;
