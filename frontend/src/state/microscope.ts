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
import { isJourneyAnalysis } from "../types/analysis";
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
  journeyStage: number;
  playing: boolean;
  speed: 0.5 | 1 | 1.5 | 2;
  journeyTrail: boolean;
  fullTrail: boolean;
  cinematic: boolean;
  showcaseStep: number | null;
  setJourneyStage: (stage: number) => void;
  stepJourney: (delta: number) => void;
  advanceJourney: () => void;
  togglePlayback: () => void;
  resetJourney: () => void;
  setSpeed: (speed: 0.5 | 1 | 1.5 | 2) => void;
  setJourneyTrail: (enabled: boolean, full?: boolean) => void;
  setCinematic: (enabled: boolean) => void;
  startShowcase: () => void;
  stopPlayback: () => void;
  advanceShowcase: () => void;
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
const journeyDefaults = { journeyStage: 0, playing: false, speed: 1 as const, journeyTrail: true, fullTrail: false, cinematic: false, showcaseStep: null };
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
  ...journeyDefaults,
  compareFrom: 3,
  compareTo: 9,
  loadTimings: null,
  renderStarted: 0,
  load: async (id, source = fixtureSource) => {
    activeSource = source;
    const ticket = ++request;
    set({ fixtureId: id, localFilename: null, status: "loading", error: null, analysis: null, ...journeyDefaults });
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
        ...journeyDefaults,
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
        trail: false, compareFrom: 3, compareTo: 9, loadTimings: null, renderStarted: performance.now(), ...journeyDefaults });
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
    if (mode === "JOURNEY" && (!get().analysis || !isJourneyAnalysis(get().analysis!))) return;
    if (mode !== get().microscopeMode) {
      beginInteraction("microscope-mode");
      set({ microscopeMode: mode, playing: false, showcaseStep: null });
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
  setJourneyStage: (stage) => {
    if (!Number.isInteger(stage) || stage < 0 || stage > 13) return;
    beginInteraction("journey-stage");
    set({ journeyStage: stage, playing: false, showcaseStep: null });
  },
  stepJourney: (delta) => get().setJourneyStage(Math.max(0, Math.min(13, get().journeyStage + delta))),
  advanceJourney: () => {
    beginInteraction("journey-play-step");
    const next = Math.min(13, get().journeyStage + 1);
    set({ journeyStage: next, playing: next < 13 });
  },
  togglePlayback: () => {
    const s = get();
    if (s.selectedToken === null || !s.analysis || !isJourneyAnalysis(s.analysis)) return;
    set({ playing: !s.playing, journeyStage: !s.playing && s.journeyStage === 13 ? 0 : s.journeyStage, showcaseStep: null });
  },
  resetJourney: () => get().setJourneyStage(0),
  setSpeed: (speed) => { if ([0.5, 1, 1.5, 2].includes(speed)) set({ speed }); },
  setJourneyTrail: (enabled, full = false) => { beginInteraction("journey-trail"); set({ journeyTrail: enabled, fullTrail: full }); },
  setCinematic: (cinematic) => { beginInteraction("cinematic"); set({ cinematic }); },
  stopPlayback: () => set({ playing: false, showcaseStep: null }),
  startShowcase: () => {
    const s = get(), a = s.analysis;
    if (!a || !isJourneyAnalysis(a)) return;
    const publicSat = !s.localFilename && s.fixtureId === "showcase" && a.tokens[2]?.id === 3332;
    const token = publicSat ? 2 : s.selectedToken;
    if (token === null) return;
    beginInteraction("showcase");
    set({ selectedToken: token, selectedLayer: 1, selectedHead: "AVG", microscopeMode: "ATTENTION", visualizationMode: "ARCS",
      showcaseStep: 0, playing: false, journeyStage: 0, cinematic: true, trail: true, journeyTrail: true, fullTrail: false });
  },
  advanceShowcase: () => {
    const step = get().showcaseStep;
    if (step === null) return;
    beginInteraction("showcase-step");
    if (step === 0) set({ selectedLayer: 6, showcaseStep: 1 });
    else if (step === 1) set({ selectedLayer: 12, showcaseStep: 2 });
    else if (step === 2) set({ microscopeMode: "SIMILARITY", similarityView: "MATRIX", showcaseStep: 3 });
    else if (step === 3) set({ microscopeMode: "SPACE", selectedLayer: 6, trail: true, showcaseStep: 4 });
    else if (step === 4) set({ microscopeMode: "JOURNEY", journeyStage: 0, playing: true, showcaseStep: 5 });
    else set({ journeyStage: 13, playing: false, showcaseStep: null });
  },
}));
