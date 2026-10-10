import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMicroscope } from "../state/microscope";
import { Ready, Information } from "./LegacyViews";
import { CoreReady, CoreInformation } from "./CoreViews";
import { isCoreAnalysis, isJourneyAnalysis } from "../types/analysis";
import { fixtureSource, coreFixtureSource, legacyFixtureSource } from "../data/source";
import { JourneyReady } from "./Journey";
import { usePlayback } from "./usePlayback";
import { LocalAnalysisDialog } from "./LocalAnalysisDialog";
export function App() {
  const { analysis, status, error, fixtureId, localFilename, load, retry, mode, cinematic, showcase, token } = useMicroscope(
    useShallow((s) => ({
      analysis: s.analysis,
      status: s.status,
      error: s.error,
      fixtureId: s.fixtureId,
      localFilename: s.localFilename,
      load: s.load,
      retry: s.retry,
      mode: s.microscopeMode, cinematic: s.cinematic, showcase: s.showcaseStep, token: s.selectedToken,
    })),
  );
  const [info, setInfo] = useState(false);
  const [localDialog, setLocalDialog] = useState(false);
  const legacy = new URLSearchParams(location.search).get("legacy") === "1";
  const core = new URLSearchParams(location.search).get("core") === "1";
  const recording = new URLSearchParams(location.search).get("recording") === "1";
  const source = legacy ? legacyFixtureSource : core ? coreFixtureSource : fixtureSource;
  usePlayback();
  useEffect(() => {
    void load(
      new URLSearchParams(location.search).get("fixture") === "stress-64"
        ? "stress-64"
        : "showcase",
      source,
    );
  }, [load]);
  useEffect(() => {
    if (recording && status === "ready" && analysis && isJourneyAnalysis(analysis)) {
      useMicroscope.setState({ selectedToken: fixtureId === "showcase" && !localFilename ? 2 : analysis.tokens.length - 1,
        microscopeMode: "JOURNEY", journeyStage: 6, selectedHead: "AVG", cinematic: true, playing: false, showcaseStep: null, journeyTrail: true, fullTrail: false });
    }
  }, [analysis, recording]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : document.body;
      if (
        target.closest("canvas,input,select,dialog") ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
      )
        return;
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const s = useMicroscope.getState();
        if (s.microscopeMode === "JOURNEY") return;
        s.setLayer(
          Math.max(
            s.microscopeMode === "ATTENTION" ? 1 : 0,
            Math.min(12, s.selectedLayer + (e.key === "ArrowDown" ? 1 : -1)),
          ),
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <div className={`app${cinematic ? " cinematic" : ""}${recording ? " recording" : ""}`}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-symbol">N</span>
          <div>
            PROJECT NEURON<small>AI NEURAL NETWORK MICROSCOPE</small>
          </div>
        </div>
        <div className="header-right">
          {analysis && isJourneyAnalysis(analysis) && <>
            <button className="cinematic-control" aria-pressed={cinematic} onClick={() => useMicroscope.getState().setCinematic(!cinematic)}>CINEMATIC</button>
            <button className="showcase-control" disabled={localFilename !== null || fixtureId !== "showcase" ? token === null : false} onClick={() => showcase === null ? useMicroscope.getState().startShowcase() : useMicroscope.getState().stopPlayback()}>{showcase === null ? "PLAY SHOWCASE" : "STOP SHOWCASE"}</button>
          </>}
          <span className="fixture-badge">
            <i />
            {localFilename ? "LOCAL ANALYSIS" : "SHOWCASE FIXTURE"}
          </span>
          <span className="forward-label">{localFilename ? "SOURCE NOT VERIFIED" : "REAL FORWARD PASS"}</span>
          <label className="fixture-choice">
            <span className="sr-only">Fixture</span>
            <select
              aria-label="Fixture"
              className={localFilename ? "local-source-choice" : undefined}
              value={localFilename ? "local" : fixtureId}
              onChange={(e) => {
                if (e.target.value === "import") setLocalDialog(true);
                else if (e.target.value !== "local") void load(e.target.value as "showcase" | "stress-64", source);
              }}
            >
              <option value="showcase">6-token showcase</option>
              <option value="stress-64">64-token stress</option>
              {localFilename && <option value="local">Local: {localFilename}</option>}
              {!legacy && <option value="import">載入 JSON…</option>}
            </select>
          </label>
          <button
            className="info-button"
            onClick={() => setInfo(true)}
            aria-label="Information"
          >
            i
          </button>
        </div>
      </header>
      {status === "ready" && analysis ? (
        legacy ? (
          <Ready analysis={analysis} />
        ) : isCoreAnalysis(analysis) ? (
          <>{localFilename && !isJourneyAnalysis(analysis) && <p className="older-schema-notice">This analysis was generated with an older schema. Re-run the current CLI to use Journey and Prediction Evolution. 四種原有模式仍可使用。</p>}{mode === "JOURNEY" && isJourneyAnalysis(analysis) ? <JourneyReady analysis={analysis} /> : <CoreReady analysis={analysis} />}</>
        ) : (
          <main className="status-panel">
            <p role="alert">
              SCHEMA 0.2.0 REQUIRED · Regenerate the real public fixtures.
            </p>
          </main>
        )
      ) : (
        <main className="status-panel" aria-live="polite">
          <div className="section-label">
            {status === "error"
              ? "ANALYSIS UNAVAILABLE"
              : "LOADING REAL FIXTURE"}
          </div>
          <h1>
            {status === "error"
              ? "The analysis could not be displayed."
              : "Loading and validating GPT-2 output…"}
          </h1>
          {error && <p role="alert">{error}</p>}
          {status === "error" && <button onClick={retry}>Retry fixture</button>}
        </main>
      )}
      <footer className="app-footer">
        <span>
          GPT-2 · {localFilename ? `IMPORTED ${analysis?.metadata.device.toUpperCase()} ANALYSIS` : "LOCAL CPU INFERENCE"} · SCHEMA {analysis?.metadata.analysis_version ?? (legacy ? "0.1.1" : core ? "0.2.0" : "0.3.0")}
        </span>
        <span>ATTENTION IS A SIGNAL, NOT A COMPLETE EXPLANATION</span>
        <span>{legacy ? "PHASE 0.5" : analysis && isJourneyAnalysis(analysis) ? "PHASE 1B" : "PHASE 1A"}</span>
      </footer>
      {info &&
        (legacy ? (
          <Information close={() => setInfo(false)} />
        ) : (
          <CoreInformation close={() => setInfo(false)} />
        ))}
      {localDialog && <LocalAnalysisDialog close={() => setLocalDialog(false)} />}
    </div>
  );
}
