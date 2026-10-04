import { create } from "zustand";
import type {
  AnalysisResult,
  FixtureId,
  HeadSelection,
  VisualizationMode,
} from "../types/analysis";
import { fixtureSource, type AnalysisDataSource } from "../data/source";
import {
  beginInteraction,
  diagnostics,
  type LoadTimings,
} from "../data/performance";
interface MicroscopeState {
  analysis: AnalysisResult | null;
  fixtureId: FixtureId;
  status: "loading" | "ready" | "error";
  error: string | null;
  selectedLayer: number;
  selectedHead: HeadSelection;
  selectedToken: number | null;
  hoveredToken: number | null;
  visualizationMode: VisualizationMode;
  loadTimings: LoadTimings | null;
  renderStarted: number;
  load: (id: FixtureId, source?: AnalysisDataSource) => Promise<void>;
  retry: () => void;
  setLayer: (layer: number) => void;
  setHead: (head: HeadSelection) => void;
  selectToken: (token: number, openArcs?: boolean) => void;
  hoverToken: (token: number | null) => void;
  setMode: (mode: VisualizationMode) => void;
}
let request = 0;
export const useMicroscope = create<MicroscopeState>((set, get) => ({
  analysis: null,
  fixtureId: "showcase",
  status: "loading",
  error: null,
  selectedLayer: 1,
  selectedHead: "AVG",
  selectedToken: null,
  hoveredToken: null,
  visualizationMode: "HEATMAP",
  loadTimings: null,
  renderStarted: 0,
  load: async (id, source = fixtureSource) => {
    const ticket = ++request;
    set({ fixtureId: id, status: "loading", error: null, analysis: null });
    try {
      const result = await source.load(id);
      if (ticket !== request) return;
      const start = performance.now();
      set({
        analysis: result.analysis,
        status: "ready",
        selectedLayer: 1,
        selectedHead: "AVG",
        selectedToken: null,
        hoveredToken: null,
        visualizationMode: "HEATMAP",
        loadTimings: result.timings,
        renderStarted: start,
      });
      result.timings.stateMs = performance.now() - start;
      diagnostics.loads.push(result.timings);
    } catch (error) {
      if (ticket === request)
        set({
          status: "error",
          error:
            error instanceof Error ? error.message : "ANALYSIS UNAVAILABLE",
          analysis: null,
        });
    }
  },
  retry: () => {
    fixtureSource.clear(get().fixtureId);
    void get().load(get().fixtureId);
  },
  setLayer: (layer) => {
    if (Number.isInteger(layer) && layer >= 1 && layer <= 12 && layer !== get().selectedLayer) {
      beginInteraction("layer");
      set({ selectedLayer: layer });
    }
  },
  setHead: (head) => {
    if (
      (head === "AVG" || (Number.isInteger(head) && head >= 0 && head < 12)) &&
      head !== get().selectedHead
    ) {
      beginInteraction("head");
      set({ selectedHead: head });
    }
  },
  selectToken: (token, openArcs = true) => {
    if (!Number.isInteger(token) || !get().analysis || token < 0 || token >= get().analysis!.tokens.length)
      return;
    beginInteraction("token");
    set({
      selectedToken: token,
      ...(openArcs ? { visualizationMode: "ARCS" as const } : {}),
    });
  },
  hoverToken: (token) => set({ hoveredToken: token }),
  setMode: (mode) => {
    if (mode !== get().visualizationMode) {
      beginInteraction("mode");
      set({ visualizationMode: mode });
    }
  },
}));
