import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useShallow } from "zustand/react/shallow";
import { useMicroscope } from "../state/microscope";
import { commitInteraction, markFirstRender } from "../data/performance";
import {
  displayToken,
  getAttention,
  headLabel,
  strongestTargets,
  weightColor,
} from "../utils/attention";
import type { AnalysisResult } from "../types/analysis";

const number = (value: number) => value.toFixed(6);
export const TokenStrip = memo(function TokenStrip({
  analysis,
}: {
  analysis: AnalysisResult;
}) {
  const { selectedToken, hoveredToken, selectToken, hoverToken } =
    useMicroscope(
      useShallow((s) => ({
        selectedToken: s.selectedToken,
        hoveredToken: s.hoveredToken,
        selectToken: s.selectToken,
        hoverToken: s.hoverToken,
      })),
    );
  return (
    <section className="tokens-band" aria-label="Input tokens">
      <div className="section-label">
        TOKEN SEQUENCE <span>{analysis.tokens.length} BPE TOKENS</span>
      </div>
      <div className="token-strip">
        {analysis.tokens.map((t) => (
          <button
            key={t.position}
            className={`token ${selectedToken === t.position ? "selected" : ""} ${hoveredToken === t.position ? "hovered" : ""}`}
            aria-label={`Token ${t.position}: ${t.text.trim()}`}
            aria-pressed={selectedToken === t.position}
            onClick={() => selectToken(t.position)}
            onMouseEnter={() => hoverToken(t.position)}
            onMouseLeave={() => hoverToken(null)}
          >
            <span className="token-index">
              {String(t.position).padStart(2, "0")}
            </span>
            <span className="token-text">{displayToken(t.text)}</span>
            <span className="token-id">{t.id}</span>
          </button>
        ))}
      </div>
    </section>
  );
});
export function LayerRail({
  allowEmbedding = false,
}: { allowEmbedding?: boolean } = {}) {
  const layer = useMicroscope((s) => s.selectedLayer),
    setLayer = useMicroscope((s) => s.setLayer);
  return (
    <nav className="layer-rail" aria-label="Transformer layers">
      <div className="section-label">LAYERS</div>
      <button
        disabled={!allowEmbedding}
        aria-label={allowEmbedding ? "Embedding layer" : "EMB"}
        aria-pressed={layer === 0}
        className={layer === 0 ? "active" : ""}
        onClick={() => setLayer(0)}
        title="Embedding has no attention matrix"
      >
        EMB
      </button>
      {Array.from({ length: 12 }, (_, i) => (
        <button
          key={i}
          aria-label={`Layer ${i + 1}`}
          aria-pressed={layer === i + 1}
          className={layer === i + 1 ? "active" : ""}
          onClick={() => setLayer(i + 1)}
        >
          {String(i + 1).padStart(2, "0")}
          {layer === i + 1 && <span className="active-mark">●</span>}
        </button>
      ))}
    </nav>
  );
}
export function HeadSelector({
  disabled = false,
}: { disabled?: boolean } = {}) {
  const head = useMicroscope((s) => s.selectedHead),
    setHead = useMicroscope((s) => s.setHead);
  return (
    <div className="head-controls" role="group" aria-label="Attention heads">
      {(["AVG", ...Array.from({ length: 12 }, (_, i) => i)] as const).map(
        (h) => (
          <button
            disabled={disabled}
            key={h}
            aria-pressed={head === h}
            className={head === h ? "active" : ""}
            onClick={() => setHead(h)}
          >
            {headLabel(h)}
          </button>
        ),
      )}
    </div>
  );
}
interface ViewProps {
  analysis: AnalysisResult;
  matrix: number[][];
  layer: number;
  head: string;
}
export function Heatmap({ analysis, matrix, layer, head }: ViewProps) {
  const canvas = useRef<HTMLCanvasElement>(null),
    container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0),
    [cell, setCell] = useState<{ q: number; k: number } | null>(null),
    [pointer, setPointer] = useState(false);
  const selected = useMicroscope((s) => s.selectedToken),
    select = useMicroscope((s) => s.selectToken);
  const hovered = useMicroscope((s) => s.hoveredToken);
  const hoverToken = useMicroscope((s) => s.hoverToken);
  const n = matrix.length;
  useLayoutEffect(() => {
    const el = container.current!;
    const update = () =>
      setSize(
        Math.max(
          100,
          Math.floor(Math.min(el.clientWidth - 105, el.clientHeight - 72)),
        ),
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el || !size) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.round(size * dpr);
    el.height = Math.round(size * dpr);
    const ctx = el.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const step = size / n;
    for (let q = 0; q < n; q++)
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = weightColor(matrix[q][k]);
        ctx.fillRect(k * step, q * step, step + 0.2, step + 0.2);
      }
    ctx.strokeStyle = "rgba(120,160,185,.13)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(size, i * step);
      ctx.stroke();
    }
    if (selected !== null) {
      ctx.strokeStyle = "#d8af72";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0.75, selected * step + 0.75, size - 1.5, step - 1.5);
    }
    if (hovered !== null) {
      ctx.strokeStyle = "#74ddd9";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, hovered * step + 0.5, size - 1, step - 1);
    }
    if (cell) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        cell.k * step + 0.75,
        cell.q * step + 0.75,
        step - 1.5,
        step - 1.5,
      );
    }
  }, [matrix, n, size, selected, cell, hovered]);
  function at(x: number, y: number) {
    const r = canvas.current!.getBoundingClientRect();
    return {
      q: Math.min(n - 1, Math.max(0, Math.floor(((y - r.top) / r.height) * n))),
      k: Math.min(n - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * n))),
    };
  }
  const labelStep = n <= 12 ? 1 : Math.ceil(n / 8);
  return (
    <div className="heatmap-container" ref={container}>
      <div
        className="matrix-wrapper"
        style={{ width: size, height: size, marginLeft: 75, marginTop: 35 }}
      >
        <div className="axis-name key-axis">KEY POSITION →</div>
        <div className="axis-name query-axis">QUERY POSITION →</div>
        {analysis.tokens
          .filter((_, i) => i % labelStep === 0 || i === n - 1)
          .map((t) => (
            <div key={t.position}>
              <span
                className="matrix-x"
                style={{ left: ((t.position + 0.5) / n) * size }}
              >
                {n > 12 ? t.position : displayToken(t.text)}
              </span>
              <span
                className="matrix-y"
                style={{ top: ((t.position + 0.5) / n) * size }}
              >
                {n > 12 ? t.position : displayToken(t.text)}
              </span>
            </div>
          ))}
        <canvas
          ref={canvas}
          style={{ width: size, height: size }}
          aria-label={`Attention heatmap, ${n} by ${n} cells. Layer ${layer}, ${head}. Arrow keys inspect cells; Enter selects query.`}
          tabIndex={0}
          onMouseMove={(e) => {
            setPointer(true);
            const target = at(e.clientX, e.clientY);
            setCell(target);
            hoverToken(target.q);
          }}
          onMouseLeave={() => {
            setPointer(false);
            setCell(null);
            hoverToken(null);
          }}
          onFocus={() => {
            setPointer(false);
            setCell((c) => c ?? { q: 0, k: 0 });
          }}
          onClick={(e) => {
            const c = at(e.clientX, e.clientY);
            setCell(c);
            select(c.q, false);
          }}
          onKeyDown={(e) => {
            const c = cell ?? { q: 0, k: 0 };
            if (e.key === "Enter") {
              select(c.q, false);
              return;
            }
            const d: { [k: string]: [number, number] } = {
              ArrowUp: [-1, 0],
              ArrowDown: [1, 0],
              ArrowLeft: [0, -1],
              ArrowRight: [0, 1],
            };
            if (d[e.key]) {
              e.preventDefault();
              setPointer(false);
              setCell({
                q: Math.max(0, Math.min(n - 1, c.q + d[e.key][0])),
                k: Math.max(0, Math.min(n - 1, c.k + d[e.key][1])),
              });
            }
          }}
        />
        {pointer && cell && (
          <div
            className="matrix-tooltip"
            role="tooltip"
            style={{
              left: Math.min(
                size - 180,
                Math.max(0, ((cell.k + 1) * size) / n),
              ),
              top: Math.min(size - 55, ((cell.q + 1) * size) / n),
            }}
          >
            L{String(layer).padStart(2, "0")} / {head} · Q {cell.q} → K {cell.k}
            <strong>{number(matrix[cell.q][cell.k])}</strong>
          </div>
        )}
      </div>
      <div className="cell-readout" role="status" data-testid="cell-readout">
        {cell ? (
          <>
            <span>
              L{String(layer).padStart(2, "0")} / {head}
            </span>
            <span>
              Q {cell.q} {displayToken(analysis.tokens[cell.q].text)} → K{" "}
              {cell.k} {displayToken(analysis.tokens[cell.k].text)}
            </span>
            <strong>{number(matrix[cell.q][cell.k])}</strong>
            <span>
              {cell.k > cell.q
                ? "CAUSAL MASK · FUTURE KEY"
                : "ATTENTION WEIGHT"}
            </span>
          </>
        ) : (
          <span>
            Hover a cell or focus the matrix to inspect its exact value.
          </span>
        )}
      </div>
    </div>
  );
}
export function Arcs({ analysis, matrix, layer, head }: ViewProps) {
  const selected = useMicroscope((s) => s.selectedToken),
    select = useMicroscope((s) => s.selectToken),
    hover = useMicroscope((s) => s.hoverToken);
  const hovered = useMicroscope((s) => s.hoveredToken),
    scroll = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ width: 760, height: 390 });
  useLayoutEffect(() => {
    const el = scroll.current!;
    const update = () =>
      setArea({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [edge, setEdge] = useState<number | null>(null);
  const edges = useMemo(
    () => (selected === null ? [] : strongestTargets(matrix, selected)),
    [matrix, selected],
  );
  const n = analysis.tokens.length,
    width = n > 12 ? Math.max(area.width, n * 64) : Math.max(400, area.width),
    height = Math.max(100, area.height),
    x = (i: number) => 55 + (i * (width - 110)) / Math.max(1, n - 1),
    base = height - 65;
  return (
    <div className="arc-container">
      <div className="arc-caption">
        {selected === null
          ? "Select a token to trace its attention."
          : `QUERY ${String(selected).padStart(2, "0")} · ${displayToken(analysis.tokens[selected].text)} → TOP ${edges.length} CAUSAL TARGETS`}
      </div>
      <div className="arc-scroll" ref={scroll}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width, minWidth: width }}
          aria-label="Selected query attention arcs"
        >
          <line x1="25" x2={width - 25} y1={base} y2={base} stroke="#263745" />
          {edges.map(({ key: position, weight }) => {
            const a = x(selected!),
              b = x(position),
              self = position === selected;
            const path = self
              ? `M ${a - 7} ${base - 14} C ${a - 55} ${Math.max(10, base - 110)}, ${a + 55} ${Math.max(10, base - 110)}, ${a + 7} ${base - 14}`
              : `M ${a} ${base - 14} Q ${(a + b) / 2} ${Math.max(8, base - 50 - Math.min(220, Math.abs(a - b) * 0.45))} ${b} ${base - 14}`;
            return (
              <g
                key={position}
                onMouseEnter={() => setEdge(position)}
                onMouseLeave={() => setEdge(null)}
              >
                <path
                  d={path}
                  fill="none"
                  stroke={self ? "#a39adb" : "#74ddd9"}
                  strokeWidth={0.8 + 7 * weight}
                  opacity={0.2 + 0.8 * weight}
                  data-query={selected!}
                  data-key={position}
                  data-weight={weight}
                  data-testid="attention-arc"
                />
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={18}
                >
                  <title>{`L${layer} ${head} · Q ${selected} → K ${position} · ${number(weight)}`}</title>
                </path>
                <circle cx={b} cy={base - 14} r={3} fill="#74ddd9" />
              </g>
            );
          })}
          {analysis.tokens.map((t) => (
            <g
              key={t.position}
              className="arc-token"
              tabIndex={0}
              role="button"
              aria-label={`Arc token ${t.position}: ${t.text.trim()}`}
              onClick={() => select(t.position)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(t.position);
                }
              }}
              onMouseEnter={() => hover(t.position)}
              onMouseLeave={() => hover(null)}
            >
              <circle
                cx={x(t.position)}
                cy={base}
                r={selected === t.position ? 7 : 4}
                fill={
                  selected === t.position
                    ? "#d8af72"
                    : hovered === t.position
                      ? "#74ddd9"
                      : "#607b8e"
                }
              />
              <text
                x={x(t.position)}
                y={base + 29}
                textAnchor="middle"
                fill={selected === t.position ? "#e9c992" : "#c8d8e3"}
              >
                {n > 12 ? t.position : displayToken(t.text)}
              </text>
              <text
                className="arc-index"
                x={x(t.position)}
                y={base + 50}
                textAnchor="middle"
              >
                {n > 12
                  ? displayToken(t.text)
                  : String(t.position).padStart(2, "0")}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="cell-readout" role="status">
        {edge !== null && selected !== null
          ? `L${String(layer).padStart(2, "0")} / ${head} · Q ${selected} → K ${edge} · ${number(matrix[selected][edge])}`
          : "Width = 0.8 + 7w · opacity = 0.2 + 0.8w · positive weights only"}
      </div>
    </div>
  );
}
export const Inspector = memo(function Inspector({
  analysis,
  matrix,
}: {
  analysis: AnalysisResult;
  matrix: number[][];
}) {
  const selected = useMicroscope((s) => s.selectedToken),
    layer = useMicroscope((s) => s.selectedLayer);
  const token = selected === null ? null : analysis.tokens[selected];
  const targets = useMemo(
    () => (selected === null ? [] : strongestTargets(matrix, selected)),
    [matrix, selected],
  );
  return (
    <aside className="inspector">
      <div className="section-label">
        TOKEN INSPECTOR{" "}
        <span>
          {token
            ? `POSITION ${String(token.position).padStart(2, "0")}`
            : "NO SELECTION"}
        </span>
      </div>
      {token ? (
        <>
          <h2>{displayToken(token.text)}</h2>
          <dl className="token-details">
            <dt>Raw BPE piece</dt>
            <dd data-testid="raw-piece">{token.piece}</dd>
            <dt>Display text</dt>
            <dd>{displayToken(token.text)}</dd>
            <dt>Token ID</dt>
            <dd>{token.id}</dd>
            <dt>Position</dt>
            <dd>{token.position}</dd>
          </dl>
          <div className="metric">
            <span>Representation Magnitude</span>
            <strong data-testid="magnitude">
              {number(analysis.representation_magnitude[layer][token.position])}
            </strong>
            <small>
              L{String(layer).padStart(2, "0")} · L2 norm of raw residual stream
            </small>
          </div>
          <div className="metric violet">
            <span>Representation Change</span>
            <strong data-testid="delta">
              {number(analysis.representation_delta[layer][token.position]!)}
            </strong>
            <small>
              {layer === 1 ? "EMB" : `L${String(layer - 1).padStart(2, "0")}`} →
              L{String(layer).padStart(2, "0")} · L2 distance
            </small>
          </div>
          <div className="section-label targets-title">
            STRONGEST ATTENTION TARGETS
          </div>
          <ol className="targets">
            {targets.map((t) => (
              <li key={t.key}>
                <span className="target-position">
                  {String(t.key).padStart(2, "0")}
                </span>
                <span>{displayToken(analysis.tokens[t.key].text)}</span>
                <strong>{number(t.weight)}</strong>
                <div style={{ width: `${t.weight * 100}%` }} />
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="empty-inspector">
          <span className="crosshair">⌖</span>
          <p>Select an input token.</p>
          <small>
            Inspect its representation and strongest attention targets.
          </small>
        </div>
      )}
      <p className="inspector-note">
        Magnitude is not importance.
        <br />
        Attention is not a complete explanation.
      </p>
    </aside>
  );
});
export const Predictions = memo(function Predictions({
  analysis,
}: {
  analysis: AnalysisResult;
}) {
  return (
    <section className="prediction-panel">
      <div className="prediction-heading">
        <div className="section-label">FINAL NEXT-TOKEN PREDICTION</div>
        <span>TOP 10 / 50,257</span>
        <small>Full-vocabulary softmax · final position</small>
      </div>
      <div className="predictions">
        {analysis.final_top_k.map((p, i) => (
          <div className="prediction" key={p.token_id} data-testid="prediction">
            <div>
              <span className="rank">{String(i + 1).padStart(2, "0")}</span>
              <strong>{displayToken(p.token)}</strong>
              <span>{(p.probability * 100).toFixed(3)}%</span>
            </div>
            <div className="probability-track">
              <div
                style={{ width: `${p.probability * 100}%` }}
                data-probability={p.probability}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});
export function Information({ close }: { close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current!.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={close} className="info-dialog">
      <div className="dialog-header">
        <h2>About this instrument</h2>
        <button onClick={close} aria-label="Close information">
          ×
        </button>
      </div>
      <p>SHOWCASE FIXTURE · REAL FORWARD PASS</p>
      <p>
        GENERATED FROM REAL GPT-2 OUTPUT — NOT MOCK DATA. This browser displays
        previously computed, pinned local GPT-2 results. It does not run
        inference.
      </p>
      <p>
        12 transformer blocks · 12 attention heads · 768 dimensions ·
        124,439,808 parameters. Attention axes: layer / head / query / key. AVG
        is the arithmetic mean of all 12 heads.
      </p>
      <p>
        Attention weights are not a complete causal explanation. Magnitude is
        not importance. Representation Change is an L2 distance between adjacent
        raw residual streams.
      </p>
      <p>
        PCA uses independent axes per layer; coordinates cannot prove a
        shared-space trajectory. Logit Lens is a diagnostic projection of the
        final input position, not an actual intermediate prediction. These two
        views are deferred.
      </p>
      <p>
        Final probabilities use the full 50,257-token vocabulary; top-10 bars
        retain their original probability.
      </p>
      <p className="revision">
        GPT-2 revision
        <br />
        607a30d783dfa663caf39e06633721c8d4cfcd7e
        <br />
        Analysis schema 0.1.1 · fixture generator 1.0.0
      </p>
    </dialog>
  );
}
export function Ready({ analysis }: { analysis: AnalysisResult }) {
  const { layer, head, mode, token } = useMicroscope(
    useShallow((s) => ({
      layer: s.selectedLayer,
      head: s.selectedHead,
      mode: s.visualizationMode,
      token: s.selectedToken,
    })),
  );
  const setMode = useMicroscope((s) => s.setMode);
  const matrix = useMemo(
    () => getAttention(analysis, layer, head),
    [analysis, layer, head],
  );
  useLayoutEffect(() => {
    commitInteraction();
  }, [layer, head, mode, token]);
  useEffect(() => {
    const s = useMicroscope.getState();
    if (s.loadTimings) markFirstRender(s.loadTimings, s.renderStarted);
  }, [analysis]);
  return (
    <>
      <section className="prompt-band">
        <div>
          <div className="section-label">INPUT / PUBLIC FIXTURE</div>
          <h1>{analysis.fixture.public_prompt}</h1>
        </div>
        <div className="prompt-meta">
          <span>{analysis.tokens.length} TOKENS</span>
          <span>12 LAYERS × 12 HEADS</span>
          <span>CAUSAL ATTENTION</span>
        </div>
      </section>
      <TokenStrip analysis={analysis} />
      <main className="workspace">
        <LayerRail />
        <section className="attention-panel">
          <div className="panel-heading">
            <div>
              <div className="section-label">ATTENTION EXPLORER</div>
              <h2>
                Layer {String(layer).padStart(2, "0")}{" "}
                <span>/ {headLabel(head)}</span>
              </h2>
            </div>
            <div
              className="mode-controls"
              role="group"
              aria-label="Visualization mode"
            >
              {(["HEATMAP", "ARCS"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={mode === m ? "active" : ""}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <HeadSelector />
          <div className="view-area">
            {mode === "HEATMAP" ? (
              <Heatmap
                analysis={analysis}
                matrix={matrix}
                layer={layer}
                head={headLabel(head)}
              />
            ) : (
              <Arcs
                analysis={analysis}
                matrix={matrix}
                layer={layer}
                head={headLabel(head)}
              />
            )}
          </div>
          <div className="visualization-footer">
            <span>
              {mode === "HEATMAP"
                ? "KEYS → / QUERIES ↓ · ALL CELLS VISIBLE"
                : "SELECTED QUERY · TOP 5 LEGAL KEYS"}
            </span>
            <div className="color-legend">
              <span>0</span>
              <i />
              <span>1</span>
              <small>
                {mode === "HEATMAP" ? "FIXED WEIGHT SCALE" : "EDGE WEIGHT"}
              </small>
            </div>
          </div>
        </section>
        <Inspector analysis={analysis} matrix={matrix} />
      </main>
      <Predictions analysis={analysis} />
    </>
  );
}
