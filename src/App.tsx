import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  api,
  type AttemptTrace,
  type CompleteResponse,
  type Metrics,
  type Overview,
  type PartOutput,
  type Policy,
  type PromptPart,
  type ScoreBreakdown,
  type StreamEvent,
} from "./api";
import { MarkdownBody } from "./markdown";
import { fmtINR, fmtINRCompact, usdToInr } from "./landingEconomics";

type Tab = "overview" | "baseline" | "playground" | "requests" | "registry";

const TAB_IDS: Tab[] = ["overview", "baseline", "playground", "requests", "registry"];

function tabFromParam(value: string | null): Tab | null {
  return value && (TAB_IDS as string[]).includes(value) ? (value as Tab) : null;
}
type Stage =
  | "idle"
  | "intake"
  | "classify"
  | "scoreboard"
  | "attempt"
  | "decompose"
  | "specialists"
  | "synthesize"
  | "quality"
  | "verdict";

const navItems: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "baseline", label: "Baseline" },
  { id: "playground", label: "Playground" },
  { id: "requests", label: "Requests" },
  { id: "registry", label: "Registry" },
];

const SINGLE_STAGES: Stage[] = ["intake", "classify", "scoreboard", "attempt", "quality", "verdict"];
const ORCHESTRA_STAGES: Stage[] = [
  "intake",
  "decompose",
  "specialists",
  "synthesize",
  "quality",
  "verdict",
];

function fmt(n: number, d = 4) {
  return n.toFixed(d);
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

/** Backend costs are USD; display as INR (catalog FX). */
function moneyINR(usd: number, digits = 2) {
  const inr = usdToInr(Number(usd) || 0);
  if (inr === 0) return "₹0";
  if (inr < 0.01) return fmtINR(inr, Math.max(digits, 4));
  return fmtINR(inr, digits);
}

function MetricStrip({
  title,
  m,
  savings,
}: {
  title: string;
  m: Metrics;
  savings?: number | null;
}) {
  const successCount = Math.round(m.success_rate * m.requests);
  return (
    <section className="metric-strip">
      <div className="metric-strip__title">
        <h2>{title}</h2>
        {savings != null && <span className="savings">{pct(savings)} cheaper than baseline</span>}
      </div>
      <dl className="metric-strip__row">
        <div>
          <dt>Requests</dt>
          <dd>{m.requests}</dd>
        </div>
        <div>
          <dt>Total cost (INR)</dt>
          <dd>{moneyINR(m.total_cost)}</dd>
        </div>
        <div>
          <dt>Avg latency</dt>
          <dd>
            {m.avg_latency_ms}
            <span>ms</span>
          </dd>
        </div>
        <div>
          <dt>Quality</dt>
          <dd>{fmt(m.avg_quality, 3)}</dd>
        </div>
        <div>
          <dt>Success</dt>
          <dd>
            {pct(m.success_rate)}
            <span className="count">
              ({successCount}/{m.requests})
            </span>
          </dd>
        </div>
        <div>
          <dt>Fallback</dt>
          <dd>{pct(m.fallback_rate)}</dd>
        </div>
      </dl>
    </section>
  );
}

type TheaterState = {
  stage: Stage;
  policy: Policy | null;
  taskType: string | null;
  scoreboard: ScoreBreakdown[];
  attempts: AttemptTrace[];
  activeModel: string | null;
  qualityScore: number | null;
  qualityLabel: string;
  result: CompleteResponse | null;
  replayNote: string | null;
  parts: PromptPart[];
  partOutputs: PartOutput[];
  activePartId: string | null;
  synthPreview: string | null;
};

const emptyTheater = (): TheaterState => ({
  stage: "idle",
  policy: null,
  taskType: null,
  scoreboard: [],
  attempts: [],
  activeModel: null,
  qualityScore: null,
  qualityLabel: "heuristic quality proxy",
  result: null,
  replayNote: null,
  parts: [],
  partOutputs: [],
  activePartId: null,
  synthPreview: null,
});

export default function App() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => tabFromParam(searchParams.get("tab")) ?? "overview");
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const next = tabFromParam(searchParams.get("tab"));
    if (next) setTab(next);
  }, [searchParams]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [byModel, setByModel] = useState<Array<Record<string, string | number>>>([]);
  const [byTask, setByTask] = useState<Array<Record<string, string | number>>>([]);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [models, setModels] = useState<{
    baseline_model: string;
    weights: Record<string, number>;
    models: Array<Record<string, unknown>>;
    quality_label?: string;
  } | null>(null);
  const [evalResult, setEvalResult] = useState<(Overview & { id: string | null; prompt_count?: number }) | null>(null);
  const [prompt, setPrompt] = useState(
    "1) Write a Python function that reverses a string without slicing.\n\n2) Which number is larger, 9.11 or 9.8? Explain briefly.\n\n3) Define TCP vs UDP in one short paragraph.\n\n4) End with a four-line haiku about API routing.",
  );
  const [theater, setTheater] = useState<TheaterState>(emptyTheater);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setError(null);
    try {
      const [o, m, t, r, md, ev] = await Promise.all([
        api.overview(),
        api.byModel(),
        api.byTask(),
        api.requests(),
        api.models(),
        api.latestEval(),
      ]);
      setOverview(o);
      setByModel(m);
      setByTask(t);
      setRequests(r);
      setModels(md);
      setEvalResult(ev.id ? ev : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const taskChart = useMemo(() => {
    const map = new Map<string, { task: string; routed: number; baseline: number }>();
    for (const row of byTask) {
      const task = String(row.task_type);
      const cur = map.get(task) || { task, routed: 0, baseline: 0 };
      if (row.policy === "routed") cur.routed = usdToInr(Number(row.total_cost));
      else cur.baseline = usdToInr(Number(row.total_cost));
      map.set(task, cur);
    }
    return [...map.values()];
  }, [byTask]);

  function applyStreamEvent(ev: StreamEvent) {
    setTheater((prev) => {
      const next = { ...prev };
      if (ev.event === "decomposed") {
        next.stage = "decompose";
        next.parts = (ev.data.parts as PromptPart[]) || [];
        next.taskType = next.parts.map((p) => p.task_type).join("+") || null;
      } else if (ev.event === "part_ranked") {
        next.stage = "specialists";
        next.activePartId = String(ev.data.part_id || "");
        next.scoreboard = (ev.data.candidates as ScoreBreakdown[]) || [];
      } else if (ev.event === "part_attempt_start") {
        next.stage = "specialists";
        next.activePartId = String(ev.data.part_id || prev.activePartId || "");
        next.activeModel = String(ev.data.model || "");
      } else if (ev.event === "part_attempt_end") {
        next.stage = "specialists";
        const attempt = ev.data as unknown as AttemptTrace;
        next.attempts = [
          ...prev.attempts.filter(
            (a) => !(a.index === attempt.index && (a.part_id || "") === (attempt.part_id || "")),
          ),
          attempt,
        ].sort((a, b) => a.index - b.index || String(a.part_id).localeCompare(String(b.part_id)));
        next.activeModel = attempt.model;
        next.activePartId = attempt.part_id || prev.activePartId;
      } else if (ev.event === "part_done") {
        next.stage = "specialists";
        const partOut = ev.data as unknown as PartOutput;
        next.partOutputs = [
          ...prev.partOutputs.filter((p) => p.part_id !== partOut.part_id),
          partOut,
        ];
        next.activePartId = partOut.part_id;
        next.activeModel = partOut.model;
      } else if (ev.event === "synthesized") {
        next.stage = "synthesize";
        next.synthPreview = String(ev.data.output_preview || "");
      } else if (ev.event === "classified") {
        next.stage = "classify";
        next.taskType = String(ev.data.task_type || "");
      } else if (ev.event === "ranked") {
        next.stage = "scoreboard";
        next.scoreboard = (ev.data.candidates as ScoreBreakdown[]) || [];
      } else if (ev.event === "attempt_start") {
        next.stage = "attempt";
        next.activeModel = String(ev.data.model || "");
      } else if (ev.event === "attempt_end") {
        next.stage = "attempt";
        const attempt = ev.data as unknown as AttemptTrace;
        next.attempts = [...prev.attempts.filter((a) => a.index !== attempt.index), attempt].sort(
          (a, b) => a.index - b.index,
        );
        next.activeModel = attempt.model;
      } else if (ev.event === "quality") {
        next.stage = "quality";
        next.qualityScore = (ev.data.quality_score as number | null) ?? null;
        next.qualityLabel = String(ev.data.quality_label || "heuristic quality proxy");
      } else if (ev.event === "final") {
        next.stage = "verdict";
        next.result = ev.data as unknown as CompleteResponse;
        next.activeModel = String((ev.data as CompleteResponse).model || "");
        const final = ev.data as unknown as CompleteResponse;
        if (final.parts?.length) next.parts = final.parts;
        if (final.part_outputs?.length) next.partOutputs = final.part_outputs;
      }
      return next;
    });
  }

  async function onComplete(policy: Policy) {
    setBusy(true);
    setError(null);
    setPaused(false);
    setTheater({ ...emptyTheater(), stage: "intake", policy, replayNote: null });
    try {
      await new Promise((r) => setTimeout(r, paused ? 0 : 280 / speed));
      const result = await api.completeStream(
        prompt,
        policy,
        (ev) => {
          applyStreamEvent(ev);
        },
        { replayDelayMs: 320 / speed },
      );
      setTheater((prev) => ({
        ...prev,
        stage: "verdict",
        result,
        parts: result.parts || prev.parts,
        partOutputs: result.part_outputs || prev.partOutputs,
      }));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "complete failed");
      setTheater(emptyTheater());
    } finally {
      setBusy(false);
    }
  }

  async function onEval() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.runEval();
      setEvalResult(res);
      setTab("baseline");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "eval failed");
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Tab, string> = {
    overview: "Overview",
    baseline: "Baseline",
    playground: "Routing theater",
    requests: "Requests",
    registry: "Registry",
  };

  const stageList =
    theater.policy === "orchestra" || (!theater.policy && theater.parts.length > 0)
      ? ORCHESTRA_STAGES
      : SINGLE_STAGES;
  const stageIndex = Math.max(0, stageList.indexOf(theater.stage === "idle" ? "intake" : theater.stage));
  const eligibleBoard = theater.scoreboard.filter((s) => s.eligible);
  const topScore = eligibleBoard[0]?.score;
  const isOrchestra = theater.policy === "orchestra" || (theater.result?.policy === "orchestra");

  return (
    <div className="app" data-theme={darkMode ? "dark" : "light"}>
      <header className="top">
        <div className="top__brand">
          <Link to="/" className="logo" style={{ textDecoration: "none", color: "inherit" }}>
            <img className="logo-icon" src="/orchestrator-mark.svg" alt="" width={22} height={22} />
            <span>Orchestrator</span>
          </Link>
        </div>
        <nav className="top__nav" aria-label="Main">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : undefined}
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="top__actions">
          <button className="ghost" onClick={() => setDarkMode(!darkMode)} type="button">
            {darkMode ? "Light" : "Dark"}
          </button>
          <button className="solid" disabled={busy} onClick={() => void onEval()} type="button">
            {busy && tab !== "playground" ? "Working…" : "Run eval"}
          </button>
        </div>
      </header>

      <main className="main">
        <div className="main__head">
          <h1>{titles[tab]}</h1>
          {tab === "overview" && <p>Live traffic summary: routed vs baseline cost, latency, and success.</p>}
          {tab === "baseline" && <p>Run the fixture suite against {models?.baseline_model ?? "baseline"}.</p>}
          {tab === "playground" && (
            <p>
              Route splits a mixed prompt into specialty tasks, picks a model for each, then stitches one
              answer. Single route keeps the one-model path.
            </p>
          )}
          {tab === "requests" && <p>Recent requests with cost (INR), latency, and quality.</p>}
          {tab === "registry" && <p>Model list and specialty strengths used for routing.</p>}
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {tab === "overview" && overview && (
          <div className="stack">
            <p className="scope-note">Scope: historical operational traffic (not a matched-fixture eval run).</p>
            <MetricStrip title="Routed" m={overview.routed} savings={overview.cost_savings_vs_baseline} />
            <MetricStrip title="Baseline" m={overview.baseline} />
            <div className="split">
              <section className="block">
                <h2>Cost by task (INR)</h2>
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={taskChart} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                      <XAxis dataKey="task" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "var(--muted)", fontSize: 11 }}
                        tickFormatter={(v: number) => `₹${Number(v).toFixed(2)}`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--panel)",
                          border: "1px solid var(--rule)",
                          borderRadius: 2,
                          color: "var(--ink)",
                        }}
                        formatter={(value: number) => [fmtINR(Number(value)), "INR"]}
                      />
                      <Legend wrapperStyle={{ color: "var(--muted)", fontSize: 12 }} />
                      <Bar dataKey="routed" name="Routed" fill="var(--accent)" maxBarSize={26} />
                      <Bar dataKey="baseline" name="Baseline" fill="var(--ink-soft)" maxBarSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="block">
                <h2>Traffic by model</h2>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Requests</th>
                        <th>Cost</th>
                        <th>Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byModel.map((r) => (
                        <tr key={String(r.model)}>
                          <td className="mono">{String(r.model)}</td>
                          <td>{String(r.requests)}</td>
                          <td>{moneyINR(Number(r.total_cost))}</td>
                          <td>{String(r.avg_latency_ms)} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        )}

        {tab === "baseline" && (
          <div className="stack">
            {!evalResult && (
              <div className="empty">
                <p>No evaluation yet. Run the fixture suite to compare cost, latency, and quality.</p>
                <button className="solid" disabled={busy} onClick={() => void onEval()} type="button">
                  {busy ? "Working…" : "Run eval"}
                </button>
              </div>
            )}
            {evalResult?.routed && (
              <>
                <p className="meta-line">
                  Eval run <code>{evalResult.id}</code>
                  {evalResult.prompt_count != null && <> · {evalResult.prompt_count} prompts</>}
                  {" · "}
                  quality = simple score (not ground truth)
                </p>
                <MetricStrip title="Routed" m={evalResult.routed} savings={evalResult.cost_savings_vs_baseline} />
                <MetricStrip title="Baseline" m={evalResult.baseline} />
              </>
            )}
          </div>
        )}

        {tab === "playground" && (
          <section className="theater">
            <div className="theater__controls">
              <div className="composer theater-composer">
                <textarea
                  aria-label="Prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Prompt to route…"
                  disabled={busy}
                />
                <div className="composer__bar">
                  <div className="speed-controls">
                    <button
                      type="button"
                      className={`ghost${paused ? " active-toggle" : ""}`}
                      onClick={() => setPaused((p) => !p)}
                      disabled={!busy}
                    >
                      {paused ? "Resume" : "Pause"}
                    </button>
                    <button type="button" className={`ghost${speed === 1 ? " active-toggle" : ""}`} onClick={() => setSpeed(1)}>
                      1x
                    </button>
                    <button type="button" className={`ghost${speed === 2 ? " active-toggle" : ""}`} onClick={() => setSpeed(2)}>
                      2x
                    </button>
                  </div>
                  <div className="composer__actions">
                    <button className="ghost" disabled={busy} onClick={() => void onComplete("baseline")} type="button">
                      Baseline
                    </button>
                    <button
                      className="ghost"
                      disabled={busy || !prompt.trim()}
                      onClick={() => void onComplete("routed")}
                      type="button"
                    >
                      Single route
                    </button>
                    <button
                      className="solid"
                      disabled={busy || !prompt.trim()}
                      onClick={() => void onComplete("orchestra")}
                      type="button"
                    >
                      {busy ? "Routing…" : "Route"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pipeline" aria-live="polite">
              {stageList.map((s, i) => (
                <div
                  key={s}
                  className={`pipe-station${stageIndex >= i && theater.stage !== "idle" ? " lit" : ""}${
                    theater.stage === s ? " current" : ""
                  }`}
                >
                  <span className="pipe-dot" />
                  <span className="pipe-label">{s}</span>
                </div>
              ))}
              {theater.stage !== "idle" && (
                <div
                  className="packet"
                  style={{
                    ["--packet-x" as string]: `${(stageIndex / (stageList.length - 1)) * 100}%`,
                    animationDuration: `${0.45 / speed}s`,
                  }}
                  title="Request packet"
                />
              )}
            </div>

            {isOrchestra ? (
              <div className="theater-grid orchestra-mode">
                <section className="block theater-panel">
                  <h2>Decompose</h2>
                  {theater.parts.length ? (
                    <ul className="part-list">
                      {theater.parts.map((p) => (
                        <li
                          key={p.id}
                          className={theater.activePartId === p.id ? "part-active" : undefined}
                        >
                          <span className="task-pill">{p.task_type}</span>
                          <span className="mono">{p.id}</span>
                          <span className="muted tiny">{p.rationale}</span>
                          <p className="part-snip">{p.text.slice(0, 140)}{p.text.length > 140 ? "…" : ""}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Waiting for decomposition…</p>
                  )}
                </section>

                <section className="block theater-panel scoreboard-panel">
                  <h2>Specialist scoreboard</h2>
                  <p className="formula">
                    {theater.activePartId
                      ? `Active part ${theater.activePartId} · score = 0.65·strength − 0.20·costₙ − 0.15·latₙ`
                      : "score = 0.65·strength − 0.20·cost_norm − 0.15·latency_norm"}
                  </p>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Model</th>
                          <th>Str</th>
                          <th>Costₙ</th>
                          <th>Latₙ</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(theater.scoreboard.length ? theater.scoreboard : []).slice(0, 8).map((row) => (
                          <tr
                            key={row.id}
                            className={`${row.eligible ? "" : "dim"} ${
                              row.eligible && row.score === topScore ? "winner" : ""
                            } ${theater.activeModel === row.id ? "active-row" : ""}`}
                          >
                            <td className="mono">{row.display_name || row.id}</td>
                            <td>{row.eligible ? fmt(row.strength, 2) : "—"}</td>
                            <td>{row.eligible ? fmt(row.cost_norm, 2) : "—"}</td>
                            <td>{row.eligible ? fmt(row.latency_norm, 2) : "—"}</td>
                            <td className="mono">{row.eligible ? fmt(row.score, 3) : "—"}</td>
                          </tr>
                        ))}
                        {!theater.scoreboard.length && (
                          <tr>
                            <td colSpan={5} className="muted">
                              Scoreboard fills when a part is ranked…
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="block theater-panel cascade-panel">
                  <h2>Specialist cascade</h2>
                  <div className="cascade">
                    {theater.partOutputs.map((po) => (
                      <div key={po.part_id} className={`cascade-row outcome-${po.success ? "success" : "error"}`}>
                        <span className="cascade-idx">{po.part_id}</span>
                        <span className="task-pill">{po.task_type}</span>
                        <span className="mono">{po.model}</span>
                        <span className={`badge badge-${po.success ? "success" : "error"}`}>
                          {po.success ? "success" : "failed"}
                        </span>
                        <span className="muted">{po.latency_ms} ms</span>
                      </div>
                    ))}
                    {theater.attempts
                      .filter((a) => !theater.partOutputs.some((p) => p.part_id === a.part_id && p.success))
                      .map((a) => (
                        <div key={`${a.part_id}-${a.index}-${a.model}`} className={`cascade-row outcome-${a.outcome}`}>
                          <span className="cascade-idx">{a.part_id || `#${a.index + 1}`}</span>
                          <span className="mono">{a.model}</span>
                          <span className={`badge badge-${a.outcome}`}>{a.outcome.replace("_", " ")}</span>
                        </div>
                      ))}
                    {!theater.partOutputs.length && !theater.attempts.length && (
                      <p className="muted">Specialists appear as each part is attempted.</p>
                    )}
                  </div>
                </section>

                <section className="block theater-panel">
                  <h2>Synthesize / quality</h2>
                  <p className="proxy-label">{theater.qualityLabel}</p>
                  {theater.synthPreview && (
                    <p className="muted tiny">Stitch preview: {theater.synthPreview.slice(0, 120)}…</p>
                  )}
                  <div className="gauge">
                    <div
                      className="gauge__fill"
                      style={{ width: `${Math.max(0, Math.min(100, (theater.qualityScore ?? 0) * 100))}%` }}
                    />
                  </div>
                  <p className="gauge__value">
                    {theater.qualityScore == null ? "—" : fmt(theater.qualityScore, 3)}
                    <span> / 1.0 proxy</span>
                  </p>
                </section>
              </div>
            ) : (
              <div className={`theater-grid${theater.result?.policy === "baseline" ? " baseline-mode" : ""}`}>
                <section className="block theater-panel">
                  <h2>Classify</h2>
                  {theater.taskType ? (
                    <p className="task-pill">{theater.taskType}</p>
                  ) : (
                    <p className="muted">Waiting for classification…</p>
                  )}
                  {theater.result?.policy === "baseline" && (
                    <p className="lock-note">Baseline policy — single locked model, no fallbacks.</p>
                  )}
                </section>

                <section className="block theater-panel scoreboard-panel">
                  <h2>Scoreboard</h2>
                  <p className="formula">score = 0.65·strength − 0.20·cost_norm − 0.15·latency_norm</p>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Model</th>
                          <th>Str</th>
                          <th>Costₙ</th>
                          <th>Latₙ</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(theater.scoreboard.length ? theater.scoreboard : []).slice(0, 8).map((row) => (
                          <tr
                            key={row.id}
                            className={`${row.eligible ? "" : "dim"} ${
                              row.eligible && row.score === topScore ? "winner" : ""
                            } ${theater.activeModel === row.id ? "active-row" : ""}`}
                          >
                            <td className="mono">
                              {row.display_name || row.id}
                              {!row.eligible && row.reject_reason ? (
                                <span className="reject"> · {row.reject_reason}</span>
                              ) : null}
                            </td>
                            <td>{row.eligible ? fmt(row.strength, 2) : "—"}</td>
                            <td>{row.eligible ? fmt(row.cost_norm, 2) : "—"}</td>
                            <td>{row.eligible ? fmt(row.latency_norm, 2) : "—"}</td>
                            <td className="mono">{row.eligible ? fmt(row.score, 3) : "—"}</td>
                          </tr>
                        ))}
                        {!theater.scoreboard.length && (
                          <tr>
                            <td colSpan={5} className="muted">
                              Scoreboard fills after ranking…
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="block theater-panel cascade-panel">
                  <h2>Attempt cascade</h2>
                  <div className="cascade">
                    {(theater.attempts.length
                      ? theater.attempts
                      : theater.activeModel
                        ? [
                            {
                              index: 0,
                              model: theater.activeModel,
                              provider: "",
                              outcome: "success" as const,
                              reason: null,
                              latency_ms: 0,
                              tokens_in: 0,
                              tokens_out: 0,
                              est_cost: 0,
                            },
                          ]
                        : []
                    ).map((a) => (
                      <div key={`${a.index}-${a.model}`} className={`cascade-row outcome-${a.outcome}`}>
                        <span className="cascade-idx">#{a.index + 1}</span>
                        <span className="mono">{a.model}</span>
                        <span className={`badge badge-${a.outcome}`}>{a.outcome.replace("_", " ")}</span>
                        {a.reason && <span className="reason">{a.reason}</span>}
                        {a.latency_ms > 0 && <span className="muted">{a.latency_ms} ms</span>}
                      </div>
                    ))}
                    {!theater.attempts.length && !theater.activeModel && (
                      <p className="muted">Attempts appear as each model is tried.</p>
                    )}
                  </div>
                </section>

                <section className="block theater-panel">
                  <h2>Quality gate</h2>
                  <p className="proxy-label">{theater.qualityLabel}</p>
                  <div className="gauge">
                    <div
                      className="gauge__fill"
                      style={{ width: `${Math.max(0, Math.min(100, (theater.qualityScore ?? 0) * 100))}%` }}
                    />
                  </div>
                  <p className="gauge__value">
                    {theater.qualityScore == null ? "—" : fmt(theater.qualityScore, 3)}
                    <span> / 1.0 proxy</span>
                  </p>
                  <p className="muted tiny">Simple quality score — not ground-truth accuracy.</p>
                </section>
              </div>
            )}

            {theater.result && (
              <section className="block verdict answer-panel">
                <h2>Answer</h2>
                <p className="muted tiny">Theater stage: verdict</p>
                <div className="verdict__meta">
                  <span className="mono">{theater.result.policy}</span>
                  {theater.result.policy !== "orchestra" && (
                    <>
                      <span className="mono">{theater.result.model}</span>
                      <span>{theater.result.provider}</span>
                    </>
                  )}
                  <span>{theater.result.success ? "success" : "failed"}</span>
                  <span>{moneyINR(theater.result.est_cost)}</span>
                  <span>{theater.result.latency_ms} ms</span>
                  {theater.result.synthesis_method && theater.result.synthesis_method !== "none" && (
                    <span className="badge badge-success">synth={theater.result.synthesis_method}</span>
                  )}
                  {theater.result.fallback_used && (
                    <span className="badge badge-error">fallback used</span>
                  )}
                </div>
                {theater.result.policy === "orchestra" && !!theater.result.part_outputs?.length ? (
                  <>
                    <p className="rank-line">
                      specialists {(theater.result.ranked || []).join(" → ") || "—"}
                    </p>
                    <div className="answer-cards">
                      {theater.result.part_outputs.map((po) => (
                        <article key={po.part_id} className={`answer-card${po.success ? "" : " answer-card--fail"}`}>
                          <header className="answer-card__head">
                            <span className="task-pill">{po.task_type}</span>
                            <span className="mono">{po.part_id}</span>
                            <span className="mono">{po.model}</span>
                            <span className="muted">{po.provider}</span>
                            <span className={`badge badge-${po.success ? "success" : "error"}`}>
                              {po.success ? "success" : "failed"}
                            </span>
                            <span className="muted">{po.latency_ms} ms</span>
                          </header>
                          <div className="answer-card__body">
                            {po.success ? (
                              <MarkdownBody text={po.text} />
                            ) : (
                              <p className="muted">{po.error || "Specialist failed."}</p>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="answer-single">
                    {theater.result.success ? (
                      <MarkdownBody text={theater.result.output} />
                    ) : (
                      <p className="muted">
                        No usable output. Check API keys or inspect attempt reasons above.
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}

            {theater.stage === "idle" && (
              <div className="empty play-empty">
                <p>
                  Enter a mixed prompt and press Route to watch decompose → specialists → stitch.
                </p>
              </div>
            )}
          </section>
        )}

        {tab === "requests" && (
          <section className="block">
            <div className="block__head">
              <h2>Recent requests</h2>
              <span>{requests.length}</span>
            </div>
            <div className="table-scroll">
              <table className="wide">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Task</th>
                    <th>Policy</th>
                    <th>Model</th>
                    <th>Cost</th>
                    <th>Latency</th>
                    <th>Quality</th>
                    <th>Prompt</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={String(r.id)}>
                      <td>{String(r.id)}</td>
                      <td>{String(r.task_type)}</td>
                      <td>{String(r.policy)}</td>
                      <td className="mono">
                        {String(r.model)}
                        {r.fallback_used ? " *" : ""}
                      </td>
                      <td>{moneyINR(Number(r.est_cost))}</td>
                      <td>{String(r.latency_ms)} ms</td>
                      <td>{r.quality_score == null ? "—" : fmt(Number(r.quality_score), 2)}</td>
                      <td className="clip">{String(r.prompt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "registry" && models && (
          <section className="block">
            <div className="block__head">
              <h2>Models</h2>
              <span>Baseline · {models.baseline_model}</span>
            </div>
            <p className="weights">
              Weights — quality {models.weights.quality}, cost {models.weights.cost}, latency {models.weights.latency}
              {" · "}
              {models.quality_label || "heuristic quality proxy"}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Provider</th>
                    <th>Input ₹ / 1K</th>
                    <th>Latency</th>
                    <th>Code</th>
                    <th>Summary</th>
                    <th>Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {models.models.map((m) => {
                    const s = m.strengths as Record<string, number>;
                    return (
                      <tr key={String(m.id)}>
                        <td className="mono">{String(m.display_name)}</td>
                        <td>{String(m.provider)}</td>
                        <td>
                          {Number(m.input_cost_per_1k) === 0
                            ? "Free"
                            : `${fmtINRCompact(usdToInr(Number(m.input_cost_per_1k)))} / 1K`}
                        </td>
                        <td>{String(m.typical_latency_ms)} ms</td>
                        <td>{s.code}</td>
                        <td>{s.summarization}</td>
                        <td>{s.reasoning}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
