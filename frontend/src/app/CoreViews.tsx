import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useShallow } from "zustand/react/shallow";
import type { CoreAnalysisResult } from "../types/analysis";
import { isJourneyAnalysis } from "../types/analysis";
import { useMicroscope } from "../state/microscope";
import {
  commitInteraction,
  markFirstRender,
  diagnostics,
} from "../data/performance";
import {
  TokenStrip,
  LayerRail,
  HeadSelector,
  Heatmap,
  Arcs,
  Inspector,
  Predictions,
} from "./LegacyViews";
import { displayToken, getAttention, headLabel } from "../utils/attention";
import {
  layerName,
  similarityColor,
  rankRelationships,
  relationshipGeometry,
  projectedPoint,
  tokenTrail,
  projectedLabels,
} from "../utils/representation";
const fixed = (x: number) => x.toFixed(6);
const tokenText = (a: CoreAnalysisResult, i: number) =>
  displayToken(a.tokens[i].text);

export function SimilarityMatrix({
  analysis,
  layer,
}: {
  analysis: CoreAnalysisResult;
  layer: number;
}) {
  const matrix = analysis.hidden_similarity[layer],
    canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null),
    n = matrix.length;
  const [size, setSize] = useState(0),
    [cell, setCell] = useState({ q: 0, k: 0 }),
    [pointer, setPointer] = useState(false);
  const { selected, select, hover } = useMicroscope(
    useShallow((s) => ({
      selected: s.selectedToken,
      select: s.selectToken,
      hover: s.hoverToken,
    })),
  );
  useLayoutEffect(() => {
    const el = host.current!,
      update = () =>
        setSize(
          Math.max(
            100,
            Math.floor(Math.min(el.clientWidth - 120, el.clientHeight - 82)),
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
    const dpr = devicePixelRatio || 1;
    el.width = size * dpr;
    el.height = size * dpr;
    const ctx = el.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const step = size / n;
    for (let q = 0; q < n; q++)
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = similarityColor(matrix[q][k]);
        ctx.fillRect(k * step, q * step, step + 0.2, step + 0.2);
      }
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "#526c8033";
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
    ctx.strokeStyle = "#e4edf4";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      cell.k * step + 0.5,
      cell.q * step + 0.5,
      step - 1,
      step - 1,
    );
  }, [matrix, size, n, selected, cell]);
  const at = (e: React.MouseEvent) => {
    const b = canvas.current!.getBoundingClientRect();
    return {
      q: Math.min(
        n - 1,
        Math.max(0, Math.floor(((e.clientY - b.top) / b.height) * n)),
      ),
      k: Math.min(
        n - 1,
        Math.max(0, Math.floor(((e.clientX - b.left) / b.width) * n)),
      ),
    };
  };
  const step = n <= 12 ? 1 : 8;
  return (
    <div className="similarity-matrix" ref={host}>
      <div
        className="matrix-wrapper"
        style={{ width: size, height: size, marginLeft: 80, marginTop: 40 }}
      >
        <div className="axis-name key-axis">COMPARISON TOKEN →</div>
        <div className="axis-name query-axis">SOURCE TOKEN →</div>
        {analysis.tokens
          .filter((_, i) => i % step === 0 || i === n - 1)
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
          tabIndex={0}
          aria-label="Hidden-state similarity matrix. Arrow keys inspect; Enter selects source."
          onMouseMove={(e) => {
            setPointer(true);
            const c = at(e);
            setCell(c);
            hover(c.q);
          }}
          onMouseLeave={() => {
            hover(null);
            setPointer(false);
          }}
          onClick={(e) => select(at(e).q, false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              select(cell.q, false);
              return;
            }
            const d: Record<string, [number, number]> = {
              ArrowUp: [-1, 0],
              ArrowDown: [1, 0],
              ArrowLeft: [0, -1],
              ArrowRight: [0, 1],
            };
            if (d[e.key]) {
              setPointer(false);
              e.preventDefault();
              setCell({
                q: Math.max(0, Math.min(n - 1, cell.q + d[e.key][0])),
                k: Math.max(0, Math.min(n - 1, cell.k + d[e.key][1])),
              });
            }
          }}
        />
        {pointer && (
          <div
            className="matrix-tooltip"
            role="tooltip"
            style={{
              left: Math.min(
                size - 220,
                Math.max(0, ((cell.k + 1) * size) / n),
              ),
              top: Math.min(size - 60, ((cell.q + 1) * size) / n),
            }}
          >
            SOURCE {cell.q} {tokenText(analysis, cell.q)} · TARGET {cell.k}{" "}
            {tokenText(analysis, cell.k)}
            <br />
            {layerName(layer)} · COSINE SIMILARITY{" "}
            <strong>{fixed(matrix[cell.q][cell.k])}</strong>
          </div>
        )}
      </div>
      <div
        className="cell-readout similarity-readout"
        role="status"
        data-testid="similarity-cell"
      >
        <span>
          SOURCE {cell.q} {tokenText(analysis, cell.q)}
        </span>
        <span>
          TARGET {cell.k} {tokenText(analysis, cell.k)}
        </span>
        <span>{layerName(layer)}</span>
        <strong>COSINE {fixed(matrix[cell.q][cell.k])}</strong>
      </div>
    </div>
  );
}
function SimilarityGraph({
  analysis,
  layer,
}: {
  analysis: CoreAnalysisResult;
  layer: number;
}) {
  const { selected, select, hover } = useMicroscope(
      useShallow((s) => ({
        selected: s.selectedToken,
        select: s.selectToken,
        hover: s.hoverToken,
      })),
    ),
    [inspected, setInspected] = useState<number | null>(null);
  const geometry = useMemo(
    () =>
      selected === null
        ? []
        : relationshipGeometry(analysis.hidden_similarity[layer], selected),
    [analysis, layer, selected],
  );
  if (selected === null)
    return (
      <div className="core-empty">
        Select a token to inspect its relationships.
      </div>
    );
  return (
    <div className="graph-surface">
      <svg
        viewBox="0 0 1000 420"
        aria-label="Deterministic token relationship graph"
      >
        {geometry.map((p) => (
          <g key={p.key}>
            <line
              x1="500"
              y1="210"
              x2={p.x}
              y2={p.y}
              stroke={p.value < 0 ? "#a39adb" : "#74ddd9"}
              strokeDasharray={p.value < 0 ? "4 4" : undefined}
              strokeWidth={0.6 + Math.abs(p.value) * 2}
              opacity={0.25 + 0.5 * Math.abs(p.value)}
            />
            <g
              role="button"
              tabIndex={0}
              aria-label={`Relationship token ${p.key}: ${analysis.tokens[p.key].text.trim()}`}
              data-testid="relationship-node"
              data-x={p.x}
              data-y={p.y}
              onClick={() => select(p.key, false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(p.key, false);
                }
              }}
              onMouseEnter={() => {
                hover(p.key);
                setInspected(p.key);
              }}
              onMouseLeave={() => {
                hover(null);
                setInspected(null);
              }}
            >
              <circle cx={p.x} cy={p.y} r={4} fill={similarityColor(p.value)} />
              <title>{`${tokenText(analysis, p.key)} · ${layerName(layer)} · cosine ${fixed(p.value)}`}</title>
              {(analysis.tokens.length <= 12 ||
                p.key % 8 === 0 ||
                inspected === p.key) && (
                <text
                  x={p.x + (p.x < 500 ? -11 : 11)}
                  y={p.y + 4}
                  textAnchor={p.x < 500 ? "end" : "start"}
                >
                  {tokenText(analysis, p.key)}{" "}
                  <tspan fill="#8496a9">{fixed(p.value)}</tspan>
                </text>
              )}
            </g>
          </g>
        ))}
        <circle cx="500" cy="210" r="24" fill="#24271f" stroke="#d8af72" />
        <text x="500" y="214" textAnchor="middle" fill="#e9c992">
          {tokenText(analysis, selected)}
        </text>
      </svg>
      <div className="graph-note">
        Radius encodes a bounded monotonic cosine mapping, not physical
        distance. Negative edges are dashed.
      </div>
    </div>
  );
}
function Profiles({
  analysis,
  token,
}: {
  analysis: CoreAnalysisResult;
  token: number;
}) {
  const [read, setRead] = useState<number | null>(null),
    m = analysis.representation_magnitude.map((row) => row[token]),
    d = analysis.representation_delta.map((row) => row[token]);
  const maxM = Math.max(...m, 1e-12),
    maxD = Math.max(...d.filter((x): x is number => x !== null), 1e-12);
  return (
    <div className="profiles">
      <div className="section-label">REPRESENTATION MAGNITUDE</div>
      <svg viewBox="0 0 240 55" aria-label="Magnitude across all 13 layers">
        <polyline
          fill="none"
          stroke="#74ddd9"
          strokeWidth="1"
          points={m
            .map((v, i) => `${8 + i * 18.5},${43 - (v / maxM) * 34}`)
            .join(" ")}
        />
        {m.map((v, i) => (
          <circle
            key={i}
            cx={8 + i * 18.5}
            cy={43 - (v / maxM) * 34}
            r="2.5"
            fill="#74ddd9"
          >
            <title>{`${layerName(i)} · ${fixed(v)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="section-label">REPRESENTATION CHANGE</div>
      <div className="delta-strip">
        {d.slice(1).map((v, i) => (
          <button
            key={i}
            aria-label={`Inspect ${layerName(i)} to ${layerName(i + 1)} change`}
            onFocus={() => setRead(i + 1)}
            onMouseEnter={() => setRead(i + 1)}
            onClick={() => setRead(i + 1)}
            style={{ height: 8 + (v! / maxD) * 29 }}
          >
            <span className="sr-only">{fixed(v!)}</span>
          </button>
        ))}
      </div>
      <label className="profile-choice">
        Inspect layer
        <select
          aria-label="Profile layer"
          value={read ?? useMicroscope.getState().selectedLayer}
          onChange={(e) => setRead(Number(e.target.value))}
        >
          {m.map((_, i) => (
            <option key={i} value={i}>
              {layerName(i)}
            </option>
          ))}
        </select>
      </label>
      <p className="profile-readout" data-testid="profile-value">
        {layerName(read ?? useMicroscope.getState().selectedLayer)} · MAG{" "}
        {fixed(m[read ?? useMicroscope.getState().selectedLayer])}
        <br />
        CHANGE{" "}
        {d[read ?? useMicroscope.getState().selectedLayer] === null
          ? "N/A · EMB"
          : fixed(d[read ?? useMicroscope.getState().selectedLayer]!)}
      </p>
    </div>
  );
}
const CoreInspector = memo(function CoreInspector({
  analysis,
}: {
  analysis: CoreAnalysisResult;
}) {
  const { token, layer, mode } = useMicroscope(
      useShallow((s) => ({
        token: s.selectedToken,
        layer: s.selectedLayer,
        mode: s.microscopeMode,
      })),
    ),
    select = useMicroscope((s) => s.selectToken);
  const rankings = useMemo(
    () =>
      token === null
        ? []
        : rankRelationships(analysis.hidden_similarity[layer], token),
    [analysis, layer, token],
  );
  if (token === null)
    return (
      <aside className="inspector">
        <div className="section-label">TOKEN INSPECTOR</div>
        <div className="empty-inspector">
          <span className="crosshair">⌖</span>
          <p>Select an input token.</p>
          <small>Inspect internal representation relationships.</small>
        </div>
      </aside>
    );
  return (
    <aside className="inspector core-inspector">
      <div className="section-label">
        TOKEN INSPECTOR <span>POSITION {String(token).padStart(2, "0")}</span>
      </div>
      <h2>{tokenText(analysis, token)}</h2>
      <dl className="token-details">
        <dt>Raw BPE piece</dt>
        <dd>{analysis.tokens[token].piece}</dd>
        <dt>Token ID</dt>
        <dd>{analysis.tokens[token].id}</dd>
        <dt>Layer</dt>
        <dd>{layerName(layer)}</dd>
      </dl>
      <div className="metric">
        <span>Representation Magnitude</span>
        <strong data-testid="magnitude">
          {fixed(analysis.representation_magnitude[layer][token])}
        </strong>
        <small>L2 norm · raw residual stream</small>
      </div>
      <div className="metric violet">
        <span>Representation Change</span>
        <strong data-testid="delta">
          {layer === 0
            ? "N/A"
            : fixed(analysis.representation_delta[layer][token]!)}
        </strong>
        <small>
          {layer === 0
            ? "EMB has no predecessor"
            : `${layerName(layer - 1)} → ${layerName(layer)} · L2 distance`}
        </small>
      </div>
      {mode === "SIMILARITY" && (
        <>
          <div className="section-label">HIDDEN-STATE SIMILARITY</div>
          <p className="self-note">Self excluded · raw cosine descending</p>
          <ol className="relationship-ranking">
            {rankings.map((r) => (
              <li key={r.key}>
                <button onClick={() => select(r.key, false)}>
                  {String(r.key).padStart(2, "0")} {tokenText(analysis, r.key)}
                </button>
                <strong
                  data-testid="ranked-cosine"
                  style={{ color: r.value < 0 ? "#a39adb" : "#74ddd9" }}
                >
                  {fixed(r.value)}
                </strong>
              </li>
            ))}
          </ol>
        </>
      )}
      {mode === "SPACE" && (
        <div className="space-coordinate">
          <span>SHARED PCA POSITION</span>
          <p data-testid="selected-coordinate">
            PC1 {fixed(analysis.shared_pca.coordinates[layer][token][0])}
            <br />
            PC2 {fixed(analysis.shared_pca.coordinates[layer][token][1])}
          </p>
        </div>
      )}
      <Profiles analysis={analysis} token={token} />
      <p className="inspector-note">
        Magnitude is not importance.
        <br />
        Projected paths are not causal explanations.
      </p>
    </aside>
  );
});
function Space({
  analysis,
  compare = false,
}: {
  analysis: CoreAnalysisResult;
  compare?: boolean;
}) {
  const { layer, token, hovered, trail, from, to } = useMicroscope(
      useShallow((s) => ({
        layer: s.selectedLayer,
        token: s.selectedToken,
        hovered: s.hoveredToken,
        trail: s.trail,
        from: s.compareFrom,
        to: s.compareTo,
      })),
    ),
    select = useMicroscope((s) => s.selectToken),
    hover = useMicroscope((s) => s.hoverToken);
  const plot = useRef<SVGSVGElement>(null);
  const [viewport, setViewport] = useState({ width: 1000, height: 420 });
  useLayoutEffect(() => {
    const el = plot.current!;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setViewport({ width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // Resize the display mapping only; the data domain stays fixed across layers.
  const px = (x: number) =>
    60 + ((x - 88) / 824) * Math.max(1, viewport.width - 100);
  const py = (y: number) =>
    20 + ((y - 50) / 294) * Math.max(1, viewport.height - 65);
  const target = useMemo(
      () =>
        analysis.tokens.map((t) => projectedPoint(analysis, layer, t.position)),
      [analysis, layer],
    ),
    [points, setPoints] = useState(target),
    current = useRef(target),
    lastLayer = useRef(layer),
    [trailLayer, setTrailLayer] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (
      compare ||
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      lastLayer.current === layer
    ) {
      current.current = target;
      setPoints(target);
      lastLayer.current = layer;
      return;
    }
    const previous = current.current,
      start = performance.now();
    lastLayer.current = layer;
    let frame = 0;
    let last: number | null = null;
    let active = true;
    const tick = (now: number) => {
      if (!active) return;
      const workStarted = performance.now();
      const fraction = Math.max(0, Math.min(1, (now - start) / 240));
      const next = target.map((p, i) => ({
        ...p,
        x: previous[i].x + (p.x - previous[i].x) * fraction,
        y: previous[i].y + (p.y - previous[i].y) * fraction,
        pc1: previous[i].pc1 + (p.pc1 - previous[i].pc1) * fraction,
        pc2: previous[i].pc2 + (p.pc2 - previous[i].pc2) * fraction,
      }));
      current.current = next;
      setPoints(next);
      if (last !== null) diagnostics.animationFrames.push({
        kind: "space",
        frameMs: now - last,
        updateMs: performance.now() - workStarted,
      });
      last = now;
      if (fraction < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [target, layer, compare]);
  const path = token === null ? [] : tokenTrail(analysis, token),
    domain = analysis.shared_pca.axis_domain;
  const labels = analysis.tokens.length <= 12;
  const positions = projectedLabels(
    points.map((p) => ({ x: px(p.x), y: py(p.y) })),
    points
      .map((_, i) => i)
      .filter((i) => labels || token === i || hovered === i || i % 16 === 0),
    viewport.width,
    viewport.height,
  );
  return (
    <div className="space-surface">
      <svg
        ref={plot}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        aria-label="Shared-basis PCA representation space"
        data-testid="space-plot"
        data-domain={JSON.stringify(domain)}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const x = 88 + i * 206,
            y = 344 - i * 73.5;
          return (
            <g key={i}>
              <line
                x1={px(x)}
                x2={px(x)}
                y1={py(50)}
                y2={py(344)}
                stroke="#253440"
                strokeDasharray="2 5"
              />
              <line
                x1={px(88)}
                x2={px(912)}
                y1={py(y)}
                y2={py(y)}
                stroke="#253440"
                strokeDasharray="2 5"
              />
              <text
                x={px(x)}
                y={viewport.height - 28}
                textAnchor="middle"
                fill="#607b8e"
              >
                {(
                  domain[0][0] +
                  (i * (domain[0][1] - domain[0][0])) / 4
                ).toFixed(1)}
              </text>
              <text x="50" y={py(y) + 3} textAnchor="end" fill="#607b8e">
                {(
                  domain[1][0] +
                  (i * (domain[1][1] - domain[1][0])) / 4
                ).toFixed(1)}
              </text>
            </g>
          );
        })}
        <text
          x={viewport.width / 2}
          y={viewport.height - 8}
          textAnchor="middle"
          fill="#98acbb"
        >
          PC1 ·{" "}
          {(analysis.shared_pca.explained_variance_ratio[0] * 100).toFixed(2)}%
          explained variance
        </text>
        <text
          transform={`translate(14 ${viewport.height / 2}) rotate(-90)`}
          textAnchor="middle"
          fill="#98acbb"
        >
          PC2 ·{" "}
          {(analysis.shared_pca.explained_variance_ratio[1] * 100).toFixed(2)}%
        </text>
        {!compare && trail && token !== null && (
          <g>
            <polyline
              points={path.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")}
              fill="none"
              stroke="#d8af72"
              strokeWidth="1.2"
              opacity=".7"
            />
            {path.map((p) => (
              <g
                key={p.layer}
                onMouseEnter={() => setTrailLayer(p.layer)}
                onMouseLeave={() => setTrailLayer(null)}
              >
                <circle
                  data-testid="trail-point"
                  data-layer={p.layer}
                  data-pc1={p.pc1}
                  data-pc2={p.pc2}
                  cx={px(p.x)}
                  cy={py(p.y)}
                  r={p.layer === layer ? 5 : 3}
                  fill="#d8af72"
                />
                <title>{`${tokenText(analysis, token)} · ${layerName(p.layer)} · PC1 ${fixed(p.pc1)} · PC2 ${fixed(p.pc2)} · magnitude ${fixed(analysis.representation_magnitude[p.layer][token])} · change ${p.layer === 0 ? "N/A" : fixed(analysis.representation_delta[p.layer][token]!)}`}</title>
                {(p.layer === 0 || p.layer === 12 || p.layer === layer) && (
                  <text
                    x={px(p.x) + (p.layer === 12 ? 9 : -15)}
                    y={py(p.y) + (p.layer === 0 ? 22 : -14)}
                    textAnchor={p.layer === 12 ? "start" : "end"}
                    fill="#d8af72"
                  >
                    {layerName(p.layer)}
                  </text>
                )}
              </g>
            ))}
          </g>
        )}
        {compare && token !== null ? (
          <g>
            <line
              x1={px(path[from].x)}
              y1={py(path[from].y)}
              x2={px(path[to].x)}
              y2={py(path[to].y)}
              stroke="#8496a9"
              strokeDasharray="4 4"
            />
            {[from, to].map((l, i) => (
              <g key={i}>
                <circle
                  cx={px(path[l].x)}
                  cy={py(path[l].y)}
                  r="6"
                  fill={i ? "#d8af72" : "#74ddd9"}
                />
                <text
                  x={px(path[l].x) + 10}
                  y={py(path[l].y) - 10}
                  fill={i ? "#d8af72" : "#74ddd9"}
                >
                  {i ? "TO" : "FROM"} {layerName(l)}
                </text>
              </g>
            ))}
          </g>
        ) : (
          points.map((p, i) => (
            <g
              key={i}
              role="button"
              tabIndex={analysis.tokens.length <= 12 ? 0 : -1}
              aria-label={`Space token ${i}: ${analysis.tokens[i].text.trim()}`}
              data-testid="space-node"
              data-token={i}
              data-pc1={p.pc1}
              data-pc2={p.pc2}
              data-x={p.x}
              data-y={p.y}
              aria-pressed={token === i}
              onClick={() => select(i, false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(i, false);
                }
              }}
              onMouseEnter={() => hover(i)}
              onMouseLeave={() => hover(null)}
            >
              <circle
                cx={px(p.x)}
                cy={py(p.y)}
                r={token === i ? 6 : 3.5}
                fill={
                  token === i
                    ? "#d8af72"
                    : hovered === i
                      ? "#e4edf4"
                      : "#74ddd9"
                }
                stroke={token === i ? "#e9c992" : "none"}
              />
              {(labels || token === i || hovered === i || i % 16 === 0) && (
                <g>
                  <line
                    x1={px(p.x) + 4}
                    y1={py(p.y)}
                    x2={positions.get(i)!.x - 4}
                    y2={positions.get(i)!.y - 3}
                    stroke="#607b8e"
                    strokeWidth=".5"
                    opacity=".6"
                  />
                  <text
                    x={positions.get(i)!.x}
                    y={positions.get(i)!.y}
                    fill={token === i ? "#e9c992" : "#a9bccb"}
                  >
                    {tokenText(analysis, i)}
                    <tspan fill="#607b8e"> {i}</tspan>
                  </text>
                </g>
              )}
              <title>{`${tokenText(analysis, i)} · position ${i} · ${layerName(layer)} · PC1 ${fixed(p.pc1)} · PC2 ${fixed(p.pc2)}`}</title>
            </g>
          ))
        )}
      </svg>
      {!compare && (
        <div className="space-accessible">
          <label>
            Inspect token
            <select
              aria-label="Space token data"
              value={token ?? ""}
              onChange={(e) => select(Number(e.target.value), false)}
            >
              <option value="" disabled>
                Select…
              </option>
              {analysis.tokens.map((t) => (
                <option key={t.position} value={t.position}>
                  {t.position} {displayToken(t.text)}
                </option>
              ))}
            </select>
          </label>
          <details>
            <summary>
              All projected coordinates ({analysis.tokens.length})
            </summary>
            <ol>
              {analysis.tokens.map((t) => (
                <li key={t.position}>
                  {t.position} {displayToken(t.text)} · PC1{" "}
                  {fixed(analysis.shared_pca.coordinates[layer][t.position][0])}{" "}
                  · PC2{" "}
                  {fixed(analysis.shared_pca.coordinates[layer][t.position][1])}
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
      {trail && !compare && (
        <div className="trail-disclaimer">
          REPRESENTATION TRAIL · Successive layer projections; not a causal
          reasoning path.
          {trailLayer !== null && token !== null && (
            <span>
              {layerName(trailLayer)} · PC1 {fixed(path[trailLayer].pc1)} · PC2{" "}
              {fixed(path[trailLayer].pc2)} · MAG{" "}
              {fixed(analysis.representation_magnitude[trailLayer][token])} ·
              CHANGE{" "}
              {trailLayer === 0
                ? "N/A"
                : fixed(analysis.representation_delta[trailLayer][token]!)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
function Compare({ analysis }: { analysis: CoreAnalysisResult }) {
  const { token, from, to } = useMicroscope(
    useShallow((s) => ({
      token: s.selectedToken,
      from: s.compareFrom,
      to: s.compareTo,
    })),
  );
  if (token === null)
    return (
      <div className="core-empty">
        Select a token to compare its representations.
      </div>
    );
  const a = analysis.representation_magnitude[from][token],
    b = analysis.representation_magnitude[to][token];
  return (
    <div className="compare-surface">
      <div className="compare-metrics">
        <div>
          <span>REPRESENTATION MAGNITUDE</span>
          <strong>
            {fixed(a)} → {fixed(b)}
          </strong>
          <small data-testid="compare-magnitude-delta">Δ {fixed(b - a)}</small>
        </div>
        <div>
          <span>L2 CHANGE · FULL HIDDEN SPACE</span>
          <strong data-testid="compare-distance">
            {fixed(analysis.same_token_layer_distance[token][from][to])}
          </strong>
        </div>
        <div>
          <span>CROSS-LAYER COSINE</span>
          <strong data-testid="compare-cosine">
            {fixed(analysis.same_token_layer_similarity[token][from][to])}
          </strong>
        </div>
      </div>
      <Space analysis={analysis} compare />
      <div className="compare-coordinates" data-testid="compare-coordinates">
        PC1 / PC2 · {layerName(from)} (
        {analysis.shared_pca.coordinates[from][token].map(fixed).join(", ")}) →{" "}
        {layerName(to)} (
        {analysis.shared_pca.coordinates[to][token].map(fixed).join(", ")})
      </div>
      <details className="evolution-table">
        <summary>Token Evolution Matrix · 13 × 13 cosine values</summary>
        <table>
          <thead>
            <tr>
              <th>FROM / TO</th>
              {Array.from({ length: 13 }, (_, i) => (
                <th key={i}>{layerName(i)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.same_token_layer_similarity[token].map((row, i) => (
              <tr key={i}>
                <th>{layerName(i)}</th>
                {row.map((v, j) => (
                  <td
                    key={j}
                    style={{ background: similarityColor(v) }}
                    title={`${layerName(i)} → ${layerName(j)}: ${fixed(v)}`}
                  >
                    {v.toFixed(3)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
export function CoreReady({ analysis }: { analysis: CoreAnalysisResult }) {
  const { mode, layer, head, token, view, simView, trail, from, to } =
      useMicroscope(
        useShallow((s) => ({
          mode: s.microscopeMode,
          layer: s.selectedLayer,
          head: s.selectedHead,
          token: s.selectedToken,
          view: s.visualizationMode,
          simView: s.similarityView,
          trail: s.trail,
          from: s.compareFrom,
          to: s.compareTo,
        })),
      ),
    setMode = useMicroscope((s) => s.setMicroscopeMode),
    setView = useMicroscope((s) => s.setMode),
    setSim = useMicroscope((s) => s.setSimilarityView),
    setTrail = useMicroscope((s) => s.setTrail),
    setCompare = useMicroscope((s) => s.setCompare),
    setLayer = useMicroscope((s) => s.setLayer);
  const matrix = useMemo(
    () => (layer > 0 ? getAttention(analysis, layer, head) : null),
    [analysis, layer, head],
  );
  useLayoutEffect(
    () => commitInteraction(),
    [mode, layer, head, token, view, simView, trail, from, to],
  );
  useEffect(() => {
    const s = useMicroscope.getState();
    if (s.loadTimings) markFirstRender(s.loadTimings, s.renderStarted);
  }, [analysis]);
  const controls =
    mode === "ATTENTION" ? (
      <div className="mode-controls">
        {(["HEATMAP", "ARCS"] as const).map((v) => (
          <button
            key={v}
            aria-pressed={view === v}
            className={view === v ? "active" : ""}
            onClick={() => setView(v)}
          >
            {v}
          </button>
        ))}
      </div>
    ) : mode === "SIMILARITY" ? (
      <div className="mode-controls">
        {(["MATRIX", "GRAPH"] as const).map((v) => (
          <button
            key={v}
            aria-pressed={simView === v}
            className={simView === v ? "active" : ""}
            onClick={() => setSim(v)}
          >
            {v}
          </button>
        ))}
      </div>
    ) : mode === "SPACE" ? (
      <button
        className={trail ? "active" : ""}
        aria-pressed={trail}
        onClick={() => setTrail(!trail)}
      >
        TRAIL {trail ? "ON" : "OFF"}
      </button>
    ) : (
      <div className="compare-controls">
        {(["from", "to"] as const).map((side) => (
          <label key={side}>
            {side.toUpperCase()}
            <select
              aria-label={`Compare ${side.toUpperCase()} layer`}
              value={side === "from" ? from : to}
              onChange={(e) => setCompare(side, Number(e.target.value))}
            >
              {Array.from({ length: 13 }, (_, i) => (
                <option key={i} value={i}>
                  {layerName(i)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    );
  return (
    <>
      <section className="prompt-band">
        <div>
          <div className="section-label">{analysis.fixture.name === "local-import" ? "INPUT / LOCAL FILE · SOURCE NOT VERIFIED" : "INPUT / PUBLIC FIXTURE"}</div>
          <h1 title={analysis.fixture.public_prompt}>{analysis.fixture.public_prompt}</h1>
        </div>
        <div className="prompt-meta">
          <span>{analysis.tokens.length} TOKENS</span>
          <span>13 REPRESENTATION STATES</span>
          <span>{analysis.fixture.name === "local-import" ? "SCHEMA VALIDATED" : "REAL GPT-2 OUTPUT"}</span>
        </div>
      </section>
      <TokenStrip analysis={analysis} />
      <main className="workspace core-workspace">
        <LayerRail allowEmbedding={mode !== "ATTENTION"} />
        <section className="attention-panel core-panel">
          <nav className="microscope-modes" aria-label="Microscope modes">
            {(["ATTENTION", "SIMILARITY", "SPACE", "COMPARE", ...(isJourneyAnalysis(analysis) ? ["JOURNEY" as const] : [])] as const).map(
              (m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={mode === m ? "active" : ""}
                >
                  {m}
                </button>
              ),
            )}
          </nav>
          <div className="panel-heading">
            <div>
              <div className="section-label">
                {mode === "ATTENTION"
                  ? "ATTENTION EXPLORER"
                  : mode === "SIMILARITY"
                    ? "HIDDEN-STATE SIMILARITY"
                    : mode === "SPACE"
                      ? "SHARED-BASIS 2D PCA"
                      : "SAME TOKEN / TWO LAYERS"}
              </div>
              <h2>
                {mode === "COMPARE"
                  ? `${layerName(from)} → ${layerName(to)}`
                  : layer === 0
                    ? "Embedding"
                    : `Layer ${String(layer).padStart(2, "0")}`}{" "}
                <span>
                  {mode === "ATTENTION"
                    ? `/ ${headLabel(head)}`
                    : mode === "SIMILARITY"
                      ? "/ cosine similarity"
                      : mode === "SPACE"
                        ? "/ representation space"
                        : "/ representation comparison"}
                </span>
              </h2>
            </div>
            {controls}
          </div>
          <HeadSelector disabled={mode !== "ATTENTION" || layer === 0} />
          <div className="view-area">
            {mode === "ATTENTION" ? (
              matrix ? (
                view === "HEATMAP" ? (
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
                )
              ) : (
                <div className="core-empty">
                  EMB has no attention matrix. Select Layer 01–12.
                </div>
              )
            ) : mode === "SIMILARITY" ? (
              simView === "MATRIX" ? (
                <SimilarityMatrix analysis={analysis} layer={layer} />
              ) : (
                <SimilarityGraph analysis={analysis} layer={layer} />
              )
            ) : mode === "SPACE" ? (
              <Space analysis={analysis} />
            ) : (
              <Compare analysis={analysis} />
            )}
          </div>
          <div className="visualization-footer">
            <span>
              {mode === "ATTENTION"
                ? "REAL CAUSAL ATTENTION"
                : mode === "SIMILARITY"
                  ? "RAW COSINE · SIGN PRESERVED"
                  : mode === "SPACE"
                    ? "ONE PCA BASIS · FIXED GLOBAL AXES"
                    : "FULL HIDDEN-SPACE METRICS · SHARED 2D PROJECTION"}
            </span>
            {mode === "SIMILARITY" ? (
              <div className="color-legend signed-legend">
                <span>−1</span>
                <i />
                <span>0</span>
                <i />
                <span>+1</span>
              </div>
            ) : mode === "SPACE" ? (
              <label className="layer-scrubber">
                LAYER{" "}
                <input
                  type="range"
                  aria-label="Representation layer scrubber"
                  min="0"
                  max="12"
                  value={layer}
                  onChange={(e) => setLayer(Number(e.target.value))}
                />
                {layerName(layer)}
              </label>
            ) : (
              <span>
                {mode === "ATTENTION"
                  ? "HEADS AFFECT ATTENTION ONLY"
                  : "FROM / TO INCLUDES EMB"}
              </span>
            )}
          </div>
        </section>
        {mode === "ATTENTION" && matrix ? (
          <div className="attention-inspector-stack">
            <Inspector analysis={analysis} matrix={matrix} />
            {token !== null && (
              <div className="attention-profiles">
                <Profiles analysis={analysis} token={token} />
              </div>
            )}
          </div>
        ) : (
          <CoreInspector analysis={analysis} />
        )}
      </main>
      <Predictions analysis={analysis} />
    </>
  );
}
export function CoreInformation({ close }: { close: () => void }) {
  const localFilename = useMicroscope((s) => s.localFilename);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current!.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog className="info-dialog" ref={dialog} onCancel={close}>
      <div className="dialog-header">
        <h2>About this instrument</h2>
        <button aria-label="Close information" onClick={close}>
          ×
        </button>
      </div>
      <p>
        {localFilename ? "LOCAL ANALYSIS · 使用者選擇的本機 JSON。數值與格式已檢查，但檔案來源、模型權重與推論真實性未經獨立驗證。檔案不會上傳或持久儲存。" : <>
        GENERATED FROM REAL GPT-2 OUTPUT — NOT MOCK DATA. SHOWCASE FIXTURE /
        REAL FORWARD PASS. These are previously computed offline results, not
        browser inference.
        </>}
      </p>
      <p>
        ATTENTION · Attention weights show attention allocation across token
        positions and are not a complete causal explanation. AVG is the
        arithmetic mean of 12 heads.
      </p>
      <p>
        SIMILARITY · Hidden-state similarity is cosine similarity between
        internal vector representations. Signed cosine is preserved; negative is
        not an error.
      </p>
      <p>
        SPACE · Representation Space is a 2D PCA projection of high-dimensional
        hidden states using one shared PCA basis fitted across the analyzed
        layers/tokens. PC1/PC2 are statistical axes without assigned semantic
        meanings.
      </p>
      <p>
        PCA uses independent axes in the retained per-layer field; this SPACE
        view exclusively uses the new shared basis and fixed global axes.
      </p>
      <p>
        TRAIL · The representation trail connects successive layer projections
        of the same token in a shared PCA basis. It shows projected
        representation change, not a causal reasoning path.
      </p>
      <p>
        MAGNITUDE · L2 norm, not importance. CHANGE · L2 distance between
        consecutive representations. COMPARE · Cross-layer cosine compares two
        representations of the same token; L2 change uses full hidden vectors,
        not projected 2D displacement.
      </p>
      <p>
        Manual transitions interpolate between real projected states. They do
        not infer a physical route between layers. The relationship graph radius
        is a display mapping, not a hidden-space distance.
      </p>
      <p>
        Final prediction uses full-vocabulary softmax; top-10 is not
          renormalized. Intermediate Logit Lens values are diagnostic projections through the model's final normalization and LM head. They are not the model's literal intermediate decision process. JOURNEY keeps next-token diagnostics at the last input position, separate from the selected representation token. OUT uses genuine final logits and reuses the L12 representation; it is not Layer 13.
      </p>
      <p className="revision">
        GPT-2 · 607a30d783dfa663caf39e06633721c8d4cfcd7e
        <br />
        {localFilename ? "Analysis schema 0.2.0 · local file import" : "Analysis schema 0.2.0 · fixture generator 1.1.0"}
      </p>
    </dialog>
  );
}
