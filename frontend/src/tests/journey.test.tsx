import { readFileSync } from "node:fs";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { JourneyReady } from "../app/Journey";
import { usePlayback } from "../app/usePlayback";
import { useMicroscope } from "../state/microscope";
import { validateAnalysis } from "../data/validate";
import { parseLocalAnalysis } from "../data/local-analysis";
import type { JourneyAnalysisResult } from "../types/analysis";
const raw = readFileSync("public/fixtures/phase1b/showcase.json", "utf8");
const a = validateAnalysis(JSON.parse(raw)) as JourneyAnalysisResult;
const b = validateAnalysis(JSON.parse(readFileSync("public/fixtures/phase1b/stress-64.json", "utf8"))) as JourneyAnalysisResult;
function Player() { usePlayback(); return <JourneyReady analysis={useMicroscope.getState().analysis as JourneyAnalysisResult} />; }
beforeEach(() => {
  useMicroscope.setState({ analysis:a, status:"ready", localFilename:null, fixtureId:"showcase", selectedToken:2,
    microscopeMode:"JOURNEY", journeyStage:0, playing:false, speed:1, journeyTrail:true, fullTrail:false, cinematic:false, selectedHead:"AVG", showcaseStep:null });
});
afterEach(() => vi.useRealTimers());
it("requires a selected token, then renders real EMB and last-position diagnostics", () => {
  useMicroscope.setState({selectedToken:null}); render(<Player />);
  expect(screen.getByText("SELECT A TOKEN TO BEGIN JOURNEY")).toBeVisible();
  expect(screen.getByRole("button", {name:"Play"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button", {name:"Token 2: sat"}));
  expect(screen.getByTestId("journey-attention-na")).toHaveTextContent("ATTENTION NOT APPLICABLE");
  expect(screen.getByText("LOGIT LENS ESTIMATE")).toBeVisible();
  expect(screen.getByText(/LAST INPUT POSITION 5/)).toBeVisible();
  expect(screen.getAllByText("N/A")).toHaveLength(2);
});
it("all stages use exact coordinates and unchanged axes; OUT reuses L12 with genuine final ranking", () => {
  render(<Player />);
  const domain = screen.getByTestId("journey-space").getAttribute("data-domain");
  for(let stage=0;stage<14;stage++) {
    act(() => useMicroscope.getState().setJourneyStage(stage));
    expect(screen.getByTestId("journey-space")).toHaveAttribute("data-domain",domain);
    expect(screen.getAllByTestId("journey-node")[2]).toHaveAttribute("data-x",String(a.shared_pca.coordinates[Math.min(12,stage)][2][0]));
    expect(screen.getByTestId("journey-trail")).toHaveAttribute("data-stages",String(Math.min(stage,12)+1));
    const rows = stage===13 ? a.final_top_k : a.logit_lens_top_k[stage];
    rows.forEach((p,i)=>expect(screen.getAllByTestId("journey-prediction")[i]).toHaveAttribute("data-probability",String(p.probability)));
  }
  expect(screen.getByText("FINAL PREDICTION")).toBeVisible();
  expect(screen.getByText("FINAL REPRESENTATION: L12")).toBeVisible();
  expect(screen.getByTestId("journey-attention-na")).toHaveTextContent("ATTENTION COMPLETE AT L12");
});
it("Next/Previous, keyboard, reset and full-trail opt-in work without fetching", () => {
  const fetch = vi.fn();vi.stubGlobal("fetch",fetch);render(<Player />);
  fireEvent.click(screen.getByRole("button",{name:"Next"}));
  expect(useMicroscope.getState().journeyStage).toBe(1);
  fireEvent.click(screen.getByRole("button",{name:"Previous"}));
  fireEvent.keyDown(window,{key:"ArrowRight"});expect(useMicroscope.getState().journeyStage).toBe(1);
  fireEvent.keyDown(window,{key:"End"});expect(useMicroscope.getState().journeyStage).toBe(13);
  fireEvent.keyDown(window,{key:"Home"});expect(useMicroscope.getState().journeyStage).toBe(0);
  fireEvent.click(screen.getByLabelText("SHOW FULL TRAIL"));expect(screen.getByTestId("journey-trail")).toHaveAttribute("data-stages","13");
  fireEvent.keyDown(screen.getByLabelText("Playback speed"),{key:"ArrowRight"});expect(useMicroscope.getState().journeyStage).toBe(0);
  expect(fetch).not.toHaveBeenCalled();
});
it("900ms playback, bounded speeds and pause preserve data and head changes do not restart the timer", () => {
  vi.useFakeTimers();render(<Player />); const original = useMicroscope.getState().analysis;
  fireEvent.keyDown(window,{key:" "});act(()=>vi.advanceTimersByTime(899));expect(useMicroscope.getState().journeyStage).toBe(0);
  act(()=>vi.advanceTimersByTime(1));expect(useMicroscope.getState().journeyStage).toBe(1);
  act(()=>vi.advanceTimersByTime(600));fireEvent.click(screen.getByRole("button",{name:"H01"}));
  act(()=>vi.advanceTimersByTime(300));expect(useMicroscope.getState().journeyStage).toBe(2);
  fireEvent.change(screen.getByLabelText("Playback speed"),{target:{value:"2"}});
  act(()=>vi.advanceTimersByTime(450));expect(useMicroscope.getState().journeyStage).toBe(3);
  fireEvent.click(screen.getByRole("button",{name:"Pause"}));act(()=>vi.advanceTimersByTime(2000));expect(useMicroscope.getState().journeyStage).toBe(3);
  fireEvent.click(screen.getByRole("button",{name:"Reset"}));expect(useMicroscope.getState().journeyStage).toBe(0);
  expect(useMicroscope.getState().analysis).toBe(original);
  act(()=>useMicroscope.getState().setSpeed(100 as 2));expect(useMicroscope.getState().speed).toBe(2);
});
it("candidate chart preserves exact probability/logit values and provides a textual table", () => {
  render(<Player />);
  expect(screen.getAllByTestId("prediction-point")).toHaveLength(70);
  expect(screen.getAllByTestId("prediction-point")[7]).toHaveAttribute("data-value",String(a.prediction_evolution.candidates[0].probabilities[7]));
  fireEvent.change(screen.getByLabelText("Evolution metric"),{target:{value:"logits"}});
  expect(screen.getAllByTestId("prediction-point")[7]).toHaveAttribute("data-value",String(a.prediction_evolution.candidates[0].logits[7]));
  fireEvent.click(screen.getByLabelText(`Candidate ${a.final_top_k[0].token_id}`));expect(screen.getAllByTestId("prediction-point")).toHaveLength(56);
  expect(screen.getAllByRole("row",{hidden:true})).toHaveLength(6);
});
it("genuine 64-token import keeps all points, sparse labels and failed replacement retains Journey", async () => {
  const imported = parseLocalAnalysis(JSON.stringify(b)); useMicroscope.setState({analysis:imported,localFilename:"64.json",selectedToken:63,journeyStage:6});render(<Player />);
  expect(screen.getAllByTestId("journey-node")).toHaveLength(64);
  expect(screen.getByTestId("journey-space").querySelectorAll(".journey-point text").length).toBeLessThan(10);
  await expect(useMicroscope.getState().importLocal({name:"bad.json",size:1,text:async()=>"{"} as File)).rejects.toThrow();
  expect(useMicroscope.getState()).toMatchObject({analysis:imported,selectedToken:63,journeyStage:6,microscopeMode:"JOURNEY"});
});
it("showcase uses public sat, but requires and retains current imported selection", () => {
  useMicroscope.setState({selectedToken:null});useMicroscope.getState().startShowcase();expect(useMicroscope.getState().selectedToken).toBe(2);
  useMicroscope.setState({localFilename:"custom.json",selectedToken:null,showcaseStep:null});useMicroscope.getState().startShowcase();expect(useMicroscope.getState().showcaseStep).toBeNull();
  useMicroscope.setState({selectedToken:4});useMicroscope.getState().startShowcase();expect(useMicroscope.getState().selectedToken).toBe(4);
});
it.each(["missing", "position", "candidate", "OUT", "stage", "finite", "denominator"])("rejects corrupt evolution: %s", kind => {
  const v=JSON.parse(raw);
  if(kind==="missing") delete v.prediction_evolution;
  if(kind==="position") v.prediction_evolution.position=2;
  if(kind==="candidate") v.prediction_evolution.candidates[0].token_id=1;
  if(kind==="OUT") v.prediction_evolution.candidates[0].probabilities[13]=.99;
  if(kind==="stage") v.prediction_evolution.stages.pop();
  if(kind==="finite") v.prediction_evolution.candidates[0].logits[0]=Infinity;
  if(kind==="denominator") v.prediction_evolution.candidates[0].probabilities[0]*=2;
  expect(()=>validateAnalysis(v)).toThrow();
});
