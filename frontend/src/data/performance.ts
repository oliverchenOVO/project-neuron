export interface LoadTimings {
  fixture: string;
  bytes: number;
  fetchMs: number;
  parseMs: number;
  validationMs: number;
  stateMs: number;
  firstRenderMs?: number;
}
export interface InteractionTiming {
  kind: string;
  commitMs: number;
  paintMs?: number;
}
export const diagnostics = {
  loads: [] as LoadTimings[],
  interactions: [] as InteractionTiming[],
};
declare global {
  interface Window {
    neuronDiagnostics: typeof diagnostics;
  }
}
if (typeof window !== "undefined") window.neuronDiagnostics = diagnostics;
let pending: { kind: string; start: number } | null = null;
export function beginInteraction(kind: string) {
  pending = { kind, start: performance.now() };
}
export function commitInteraction() {
  if (!pending) return;
  const event = pending;
  pending = null;
  const sample: InteractionTiming = {
    kind: event.kind,
    commitMs: performance.now() - event.start,
  };
  diagnostics.interactions.push(sample);
  requestAnimationFrame(() => {
    sample.paintMs = performance.now() - event.start;
  });
}
export function markFirstRender(load: LoadTimings, started: number) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      load.firstRenderMs = performance.now() - started;
    }),
  );
}
