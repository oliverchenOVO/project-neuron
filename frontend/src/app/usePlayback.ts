import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMicroscope } from "../state/microscope";

export function usePlayback() {
  const { playing, stage, speed, showcase, status } = useMicroscope(useShallow((s) => ({
    playing: s.playing, stage: s.journeyStage, speed: s.speed, showcase: s.showcaseStep, status: s.status,
  })));
  useEffect(() => {
    if (status !== "ready" || document.hidden || (!playing && showcase === null)) return;
    const inJourney = showcase === null || showcase === 5;
    const timer = window.setTimeout(() => {
      const s = useMicroscope.getState();
      if (showcase === 5 && stage === 13) s.advanceShowcase();
      else if (inJourney) s.advanceJourney();
      else s.advanceShowcase();
    }, inJourney && stage !== 13 ? 900 / speed : 1800);
    return () => clearTimeout(timer);
  }, [playing, stage, speed, showcase, status]);
  useEffect(() => {
    const visibility = () => { if (document.hidden) useMicroscope.getState().stopPlayback(); };
    const keyboard = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : document.body;
      if (target.closest("input,textarea,select,dialog,[contenteditable=true]") || e.altKey || e.ctrlKey || e.metaKey) return;
      const s = useMicroscope.getState();
      if (e.key === "Escape") { s.stopPlayback(); s.setCinematic(false); return; }
      if (s.microscopeMode !== "JOURNEY") return;
      if (s.selectedToken === null) return;
      if (e.key === "ArrowLeft") s.stepJourney(-1);
      else if (e.key === "ArrowRight") s.stepJourney(1);
      else if (e.key === "Home") s.resetJourney();
      else if (e.key === "End") s.setJourneyStage(13);
      else if (e.key === " " && !target.closest("button")) s.togglePlayback();
      else return;
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("visibilitychange", visibility); window.removeEventListener("keydown", keyboard); };
  }, []);
}
