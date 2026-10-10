import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { JourneyAnalysisResult } from "../types/analysis";
import { useMicroscope } from "../state/microscope";
import { beginInteraction, commitInteraction, markFirstRender } from "../data/performance";
import { displayToken, getAttention, headLabel } from "../utils/attention";
import { rankRelationships } from "../utils/representation";
import { HeadSelector, TokenStrip } from "./LegacyViews";

export const stageName = (stage: number) => stage === 0 ? "EMB" : stage === 13 ? "OUT" : `L${String(stage).padStart(2, "0")}`;
const fixed = (n: number | null) => n === null ? "N/A" : n.toFixed(6);
const colors = ["#76ded5", "#dbb576", "#b0a2e2", "#80b6e4", "#dfa7b8"];

export function JourneyTimeline() {
  const { stage, playing, speed, token } = useMicroscope(useShallow((s) => ({ stage: s.journeyStage, playing: s.playing, speed: s.speed, token: s.selectedToken })));
  const s = useMicroscope.getState();
  return <section className="journey-transport" aria-label="Journey playback">
    <nav className="journey-timeline" aria-label="Journey stages">
      {Array.from({ length: 14 }, (_, i) => <button key={i} aria-label={`Journey stage ${stageName(i)}`} aria-current={stage === i ? "step" : undefined}
        aria-pressed={stage === i} disabled={token === null} onClick={() => s.setJourneyStage(i)}>
        <span>{i === 0 || i === 13 ? stageName(i) : String(i).padStart(2, "0")}</span><small>{i === 0 ? "RESIDUAL" : i === 13 ? "OUTPUT" : stage === i ? "CURRENT" : "BLOCK"}</small>
      </button>)}
    </nav>
    <div className="journey-playback-controls">
      <div><button onClick={() => s.stepJourney(-1)} disabled={token === null || stage === 0}>Previous</button>
        <button className="journey-play" onClick={s.togglePlayback} disabled={token === null} aria-pressed={playing}>{playing ? "Pause" : "Play"}</button>
        <button onClick={() => s.stepJourney(1)} disabled={token === null || stage === 13}>Next</button><button onClick={s.resetJourney} disabled={token === null}>Reset</button></div>
      <span className="journey-shortcuts">← / → STEP · SPACE PLAY · HOME / END</span>
      <label>Speed <select aria-label="Playback speed" value={speed} onChange={(e) => s.setSpeed(Number(e.target.value) as typeof speed)}>{[0.5, 1, 1.5, 2].map((v) => <option key={v} value={v}>{v}×</option>)}</select></label>
    </div>
  </section>;
}

export function JourneySpace({ analysis, token, stage }: { analysis: JourneyAnalysisResult; token: number; stage: number }) {
  const { trail, full } = useMicroscope(useShallow((s) => ({ trail: s.journeyTrail, full: s.fullTrail })));
  const layer = Math.min(stage, 12), d = analysis.shared_pca.axis_domain;
  const x = (v: number) => 65 + (v - d[0][0]) / (d[0][1] - d[0][0]) * 880;
  const y = (v: number) => 285 - (v - d[1][0]) / (d[1][1] - d[1][0]) * 250;
  const select = useMicroscope((s) => s.selectToken);
  const trace = analysis.shared_pca.coordinates.slice(0, full ? 13 : layer + 1).map((row) => row[token]);
  return <section className="journey-space">
    <div className="journey-subheading"><div><span className="section-label">SHARED-BASIS REPRESENTATION SPACE</span><h2>{stage === 13 ? "FINAL REPRESENTATION: L12" : `${stageName(stage)} · selected token`}</h2></div>
      <div className="journey-trail-controls"><label><input type="checkbox" checked={trail} onChange={(e) => useMicroscope.getState().setJourneyTrail(e.target.checked, full)} /> TRAIL</label>
        <label><input type="checkbox" checked={full} disabled={!trail} onChange={(e) => useMicroscope.getState().setJourneyTrail(trail, e.target.checked)} /> SHOW FULL TRAIL</label></div></div>
    <svg className="journey-space-svg" viewBox="0 0 1000 330" role="img" aria-label="Journey shared PCA position" data-testid="journey-space" data-domain={JSON.stringify(d)}>
      {[0, 1, 2, 3, 4].map((i) => <g key={i} className="journey-grid"><line x1="65" x2="945" y1={35 + i * 62.5} y2={35 + i * 62.5} /><line x1={65 + i * 220} x2={65 + i * 220} y1="35" y2="285" />
        <text x="55" y={39 + i * 62.5} textAnchor="end">{(d[1][1] - i / 4 * (d[1][1] - d[1][0])).toFixed(1)}</text><text x={65 + i * 220} y="305" textAnchor="middle">{(d[0][0] + i / 4 * (d[0][1] - d[0][0])).toFixed(1)}</text></g>)}
      <text className="journey-axis" x="500" y="326" textAnchor="middle">PC1 · {(analysis.shared_pca.explained_variance_ratio[0] * 100).toFixed(2)}% explained variance</text>
      <text className="journey-axis" transform="translate(14 160) rotate(-90)" textAnchor="middle">PC2 · {(analysis.shared_pca.explained_variance_ratio[1] * 100).toFixed(2)}%</text>
      {trail && <polyline data-testid="journey-trail" data-stages={trace.length} points={trace.map((p) => `${x(p[0])},${y(p[1])}`).join(" ")} className="journey-trace" />}
      {trail && trace.map((p, i) => <circle key={`trail-${i}`} cx={x(p[0])} cy={y(p[1])} r="2" className="journey-trace-dot"><title>{stageName(i)}: {fixed(p[0])}, {fixed(p[1])}</title></circle>)}
      {analysis.tokens.map((t) => {
        const p = analysis.shared_pca.coordinates[layer][t.position], selected = token === t.position;
        return <g key={t.position} data-testid="journey-node" data-position={t.position} data-x={p[0]} data-y={p[1]} className={selected ? "journey-point selected" : "journey-point"} tabIndex={0}
          role="button" aria-label={`Journey token ${t.position}: ${displayToken(t.text)}`} onClick={() => select(t.position, false)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); select(t.position, false); } }}>
          <circle cx={x(p[0])} cy={y(p[1])} r={selected ? 7 : 3} />
          {(selected || t.position % Math.max(1, Math.ceil(analysis.tokens.length / 6)) === 0) && <text x={x(p[0]) + 11} y={y(p[1]) - 10}>{displayToken(t.text)} {selected ? "← SELECTED" : t.position}</text>}
          <title>{t.position}: {t.text} · PC1 {fixed(p[0])}, PC2 {fixed(p[1])}</title>
        </g>;
      })}
    </svg>
    <div className="journey-space-note">PC1 {fixed(analysis.shared_pca.coordinates[layer][token][0])} · PC2 {fixed(analysis.shared_pca.coordinates[layer][token][1])} · ONE BASIS / FIXED AXES</div>
    <p className="journey-disclaimer">Projected representation change, not a causal reasoning path. {stage === 13 && "OUT is output projection, not Layer 13."}</p>
  </section>;
}

export function JourneySignals({ analysis, token, stage }: { analysis: JourneyAnalysisResult; token: number; stage: number }) {
  const head = useMicroscope((s) => s.selectedHead), layer = Math.min(stage, 12);
  const attention = useMemo(() => stage > 0 && stage < 13 ? getAttention(analysis, layer, head)[token]
    .map((weight, i) => ({ weight, i })).sort((a, b) => b.weight - a.weight || a.i - b.i).slice(0, 3) : null, [analysis, layer, head, token, stage]);
  const similar = useMemo(() => rankRelationships(analysis.hidden_similarity[layer], token).slice(0, 3), [analysis, layer, token]);
  const metrics = [
    ["MAGNITUDE · L2 NORM", analysis.representation_magnitude[layer][token]],
    [stage === 13 ? "CHANGE · L11 → L12" : "CHANGE · PREVIOUS RESIDUAL", analysis.representation_delta[layer][token]],
    ["COSINE TO EMB", analysis.same_token_layer_similarity[token][layer][0]],
    [stage === 13 ? "COSINE TO L11" : "COSINE TO PREVIOUS", layer === 0 ? null : analysis.same_token_layer_similarity[token][layer][layer - 1]],
    ["COSINE TO FINAL L12", analysis.same_token_layer_similarity[token][layer][12]],
  ] as const;
  return <aside className="journey-signals"><div className="section-label">SELECTED TOKEN JOURNEY · POSITION {token}</div>
    <h2>{displayToken(analysis.tokens[token].text)}</h2><div className="journey-stage-readout">{stageName(stage)} <span>{stage === 13 ? "OUTPUT PROJECTION · representation L12" : stage === 0 ? "EMBEDDING RESIDUAL" : "TRANSFORMER BLOCK"}</span></div>
    <dl>{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{fixed(value)}</dd></div>)}</dl>
    <section><div className="journey-subheading"><h3>TOP ATTENTION · {headLabel(head)} · TOP 3</h3></div><HeadSelector disabled={stage === 0 || stage === 13} />
      {attention ? <ol className="journey-relationships">{attention.map(({ weight, i }) => <li key={i}><span>{i} · {displayToken(analysis.tokens[i].text)}</span><strong>{fixed(weight)}</strong></li>)}</ol>
        : <p data-testid="journey-attention-na" className="journey-na">{stage === 0 ? "ATTENTION NOT APPLICABLE" : "ATTENTION COMPLETE AT L12 · N/A AT OUT"}</p>}</section>
    <section><h3>TOP HIDDEN-STATE SIMILARITIES</h3><small>Raw cosine descending · SELF = {fixed(analysis.hidden_similarity[layer][token][token])}</small>
      <ol className="journey-relationships">{similar.map((r) => <li key={r.key}><span>{r.key} · {displayToken(analysis.tokens[r.key].text)}</span><strong>{fixed(r.value)}</strong></li>)}</ol></section>
  </aside>;
}

export function PredictionEvolution({ analysis, stage }: { analysis: JourneyAnalysisResult; stage: number }) {
  const [metric, setMetric] = useState<"probabilities" | "logits">("probabilities");
  const [visible, setVisible] = useState<number[]>([0, 1, 2, 3, 4]);
  const evolution = analysis.prediction_evolution;
  const entries = stage === 13 ? analysis.final_top_k : analysis.logit_lens_top_k[stage];
  const domain = useMemo(() => {
    const values = evolution.candidates.flatMap((c) => c[metric]);
    const min = metric === "probabilities" ? 0 : Math.min(...values), max = Math.max(...values);
    return [min, max > min ? max + (max - min) * 0.08 : min + 1];
  }, [evolution, metric]);
  const x = (s: number) => 55 + s * 51, y = (v: number) => 162 - (v - domain[0]) / (domain[1] - domain[0]) * 140;
  const label = (v: number) => metric === "probabilities" ? `${(v * 100).toFixed(2)}%` : v.toFixed(2);
  useLayoutEffect(() => commitInteraction(), [metric, visible]);
  return <section className="prediction-evolution" data-testid="prediction-evolution">
    <div className="journey-subheading"><div><div className="section-label">NEXT-TOKEN DIAGNOSTIC EVOLUTION · LAST INPUT POSITION {evolution.position}</div>
      <h2>{stage === 13 ? "FINAL PREDICTION" : "LOGIT LENS ESTIMATE"} <span>· {stageName(stage)}</span></h2></div>
      <label>Chart metric <select aria-label="Evolution metric" value={metric} onChange={(e) => { beginInteraction("prediction-chart"); setMetric(e.target.value as typeof metric); }}><option value="probabilities">LOGIT LENS PROBABILITY</option><option value="logits">LOGIT SCORE</option></select></label></div>
    <div className="prediction-evolution-content"><div className="prediction-chart-section">
      <div className="prediction-candidates">{evolution.candidates.map((c, i) => <label key={c.token_id} style={{ color: colors[i] }}><input type="checkbox" aria-label={`Candidate ${c.token_id}`} checked={visible.includes(i)}
        onChange={(e) => { beginInteraction("prediction-candidates"); setVisible((old) => e.target.checked ? [...old, i] : old.length > 1 ? old.filter((v) => v !== i) : old); }} />{i + 1} · {displayToken(c.token)}</label>)}</div>
      <svg className="prediction-chart" viewBox="0 0 770 195" role="img" aria-label="Fixed final candidates across Logit Lens stages and output" data-testid="prediction-chart" data-domain={JSON.stringify(domain)}>
        {[0, 1, 2, 3].map((i) => <g key={i} className="journey-grid"><line x1="55" x2="718" y1={22 + i * 140 / 3} y2={22 + i * 140 / 3} /><text x="49" y={26 + i * 140 / 3} textAnchor="end">{label(domain[1] - i / 3 * (domain[1] - domain[0]))}</text></g>)}
        <line x1={x(stage)} x2={x(stage)} y1="15" y2="164" className="prediction-focus" />
        {evolution.stages.map((s, i) => <text className="journey-axis" key={s} x={x(i)} y="183" textAnchor="middle">{s}</text>)}
        {evolution.candidates.map((c, i) => visible.includes(i) && <g key={c.token_id}><polyline className="prediction-line" stroke={colors[i]} strokeDasharray={i === 0 ? undefined : `${7 - i} ${i + 1}`} points={c[metric].map((v, s) => `${x(s)},${y(v)}`).join(" ")} />
          {c[metric].map((v, s) => <circle key={s} data-testid="prediction-point" data-candidate={c.token_id} data-stage={s} data-value={v} cx={x(s)} cy={y(v)} r={stage === s ? 4 : 2} fill={colors[i]}><title>{stageName(s)} · {c.token} · {metric === "probabilities" ? "PROBABILITY" : "LOGIT SCORE"}: {v.toPrecision(12)}</title></circle>)}</g>)}
      </svg>
      <details className="prediction-table"><summary>Exact candidate values · selected stage {stageName(stage)}</summary><table><thead><tr><th>Candidate</th><th>Token ID</th><th>Logit score</th><th>Full-vocabulary probability</th></tr></thead><tbody>{evolution.candidates.map((c) => <tr key={c.token_id}><td>{displayToken(c.token)}</td><td>{c.token_id}</td><td>{c.logits[stage].toPrecision(12)}</td><td>{c.probabilities[stage].toPrecision(12)}</td></tr>)}</tbody></table></details>
    </div><div className="prediction-ranking"><div className="section-label">TOP 10 · FULL-VOCABULARY SOFTMAX</div><div className="prediction-ranking-rows">
      {entries.map((p, i) => <div className="prediction-ranking-row" key={p.token_id} style={{ transform: `translateY(${i * 20}px)` }} data-testid="journey-prediction" data-token-id={p.token_id} data-probability={p.probability}>
        <span>{String(i + 1).padStart(2, "0")} · {displayToken(p.token)}</span><strong>{(p.probability * 100).toFixed(6)}%</strong><i style={{ width: `${p.probability * 100}%` }} /></div>)}
    </div></div></div>
    <p className="journey-disclaimer">EMB–L12: diagnostic projections through final ln_f and LM head, not the model’s literal intermediate decision process. OUT: genuine final logits. Position {evolution.position} ({displayToken(analysis.tokens[evolution.position].text)}) predicts the next token; it is independent of the selected representation token. Probabilities use all 50,257 vocabulary entries, without top-k renormalization.</p>
  </section>;
}

export function JourneyReady({ analysis }: { analysis: JourneyAnalysisResult }) {
  const { token, stage, head, trail, full, cinematic } = useMicroscope(useShallow((s) => ({ token: s.selectedToken, stage: s.journeyStage, head: s.selectedHead, trail: s.journeyTrail, full: s.fullTrail, cinematic: s.cinematic })));
  useLayoutEffect(() => commitInteraction(), [token, stage, head, trail, full, cinematic]);
  useEffect(() => { const s = useMicroscope.getState(); if (s.loadTimings) markFirstRender(s.loadTimings, s.renderStarted); }, [analysis]);
  return <main className="journey-workspace"><div className="journey-heading"><div><span className="section-label">LAYER JOURNEY · EMB → TRANSFORMER BLOCKS 01–12 → OUTPUT PROJECTION</span>
    <h1>TOKEN REPRESENTATION JOURNEY</h1><p>{analysis.fixture.public_prompt}</p></div><nav className="microscope-modes" aria-label="Microscope modes">{(["ATTENTION", "SIMILARITY", "SPACE", "COMPARE", "JOURNEY"] as const).map(m => <button key={m} aria-pressed={m === "JOURNEY"} onClick={() => useMicroscope.getState().setMicroscopeMode(m)}>{m}</button>)}</nav></div>
    <TokenStrip analysis={analysis} />
    <JourneyTimeline />
    {token === null ? <div className="journey-empty"><h2>SELECT A TOKEN TO BEGIN JOURNEY</h2><p>Choose a token above. Representation signals follow your selection; next-token diagnostics always use the last input position.</p></div> : <>
      <div className="journey-central"><JourneySpace analysis={analysis} token={token} stage={stage} /><JourneySignals analysis={analysis} token={token} stage={stage} /></div>
      <PredictionEvolution key={analysis.fixture.public_prompt} analysis={analysis} stage={stage} />
    </>}
  </main>;
}
