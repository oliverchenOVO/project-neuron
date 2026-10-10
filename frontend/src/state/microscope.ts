import { create } from "zustand";
import type {
  AnalysisResult,
  FixtureId,
  HeadSelection,
  VisualizationMode,
  MicroscopeMode,
} from "../types/analysis";
import { fixtureSource, type AnalysisDataSource } from "../data/source";
import { readLocalAnalysis } from "../data/local-analysis";
import {
  beginInteraction,
  diagnostics,
  type LoadTimings,
} from "../data/performance";
interface MicroscopeState {
  analysis: AnalysisResult | null;
  fixtureId: FixtureId;
  localFilename: string | null;
  importLocal: (file: File, signal?: AbortSignal) => Promise<boolean>;
  status: "loading" | "ready" | "error";
  error: string | null;
  selectedLayer: number;
  selectedHead: HeadSelection;
  selectedToken: number | null;
  hoveredToken: number | null;
  visualizationMode: VisualizationMode;
  microscopeMode: MicroscopeMode;
  similarityView: "MATRIX" | "GRAPH";
  trail: boolean;
  compareFrom: number;
  compareTo: number;
  setMicroscopeMode: (mode: MicroscopeMode) => void;
  setSimilarityView: (mode: "MATRIX" | "GRAPH") => void;
  setTrail: (enabled: boolean) => void;
  setCompare: (side: "from" | "to", layer: number) => void;
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
let localRequest = 0;
let activeSource: AnalysisDataSource = fixtureSource;
export const useMicroscope = create<MicroscopeState>((set, get) => ({
  analysis: null,
  fixtureId: "showcase",
  localFilename: null,
  status: "loading",
  error: null,
  selectedLayer: 1,
  selectedHead: "AVG",
  selectedToken: null,
  hoveredToken: null,
  visualizationMode: "HEATMAP",
  microscopeMode: "ATTENTION",
  similarityView: "MATRIX",
  trail: false,
  compareFrom: 3,
  compareTo: 9,
  loadTimings: null,
  renderStarted: 0,
  load: async (id, source = fixtureSource) => {
    activeSource = source;
    const ticket = ++request;
    set({ fixtureId: id, localFilename: null, status: "loading", error: null, analysis: null });
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
        microscopeMode: "ATTENTION",
        similarityView: "MATRIX",
        trail: false,
        compareFrom: 3,
        compareTo: 9,
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
  importLocal: async (file, signal) => {
    const ticket = request;
    const localTicket = ++localRequest;
    try {
      const analysis = await readLocalAnalysis(file);
      if (ticket !== request || localTicket !== localRequest || signal?.aborted) return false;
      ++request; // A successful import supersedes any pending fixture load.
      set({ analysis, localFilename: file.name, status: "ready", error: null,
        selectedLayer: 1, selectedHead: "AVG", selectedToken: null, hoveredToken: null,
        visualizationMode: "HEATMAP", microscopeMode: "ATTENTION", similarityView: "MATRIX",
        trail: false, compareFrom: 3, compareTo: 9, loadTimings: null, renderStarted: performance.now() });
      return true;
    } catch (e) {
      if (ticket !== request || localTicket !== localRequest || signal?.aborted) return false;
      throw e;
    }
  },
  retry: () => {
    activeSource.clear(get().fixtureId);
    void get().load(get().fixtureId, activeSource);
  },
  setLayer: (layer) => {
    if (
      Number.isInteger(layer) &&
      layer >= (get().microscopeMode === "ATTENTION" ? 1 : 0) &&
      layer <= 12 &&
      layer !== get().selectedLayer
    ) {
      beginInteraction(
        get().microscopeMode === "ATTENTION"
          ? "layer"
          : `${get().microscopeMode.toLowerCase()}-layer`,
      );
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
    if (
      !Number.isInteger(token) ||
      !get().analysis ||
      token < 0 ||
      token >= get().analysis!.tokens.length
    )
      return;
    beginInteraction(
      get().microscopeMode === "SPACE" ? "trail-token" : "token",
    );
    set({
      selectedToken: token,
      ...(openArcs && get().microscopeMode === "ATTENTION"
        ? { visualizationMode: "ARCS" as const }
        : {}),
    });
  },
  hoverToken: (token) => set({ hoveredToken: token }),
  setMode: (mode) => {
    if (mode !== get().visualizationMode) {
      beginInteraction("mode");
      set({ visualizationMode: mode });
    }
  },
  setMicroscopeMode: (mode) => {
    if (mode !== get().microscopeMode) {
      beginInteraction("microscope-mode");
      set({ microscopeMode: mode });
    }
  },
  setSimilarityView: (mode) => {
    beginInteraction("similarity-view");
    set({ similarityView: mode });
  },
  setTrail: (enabled) => {
    beginInteraction("trail");
    set({ trail: enabled });
  },
  setCompare: (side, layer) => {
    if (Number.isInteger(layer) && layer >= 0 && layer <= 12) {
      beginInteraction("compare-layer");
      set(side === "from" ? { compareFrom: layer } : { compareTo: layer });
    }
  },
}));
