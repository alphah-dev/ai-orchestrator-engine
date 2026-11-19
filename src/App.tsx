import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  api,
  type EvalResult,
  type Metrics,
  type Overview,
  type StreamEvent,
} from "./api";
import ChatPlayground from "./ChatPlayground";
import { fmtINR, fmtINRCompact, usdToInr } from "./landingEconomics";

type Tab = "overview" | "baseline" | "playground" | "requests" | "registry";

type EvalProgress = {
  runId: string | null;
  index: number;
  total: number;
  promptIndex: number;
  promptCount: number;
  policy: string | null;
  taskType: string | null;
  promptPreview: string | null;
  status: string;
  lastModel: string | null;
  lastProvider: string | null;
  lastLatencyMs: number | null;
  lastCost: number | null;
  lastSuccess: boolean | null;
};

const TAB_IDS: Tab[] = ["overview", "baseline", "playground", "requests", "registry"];

function tabFromParam(value: string | null): Tab | null {
  return value && (TAB_IDS as string[]).includes(value) ? (value as Tab) : null;
}

const navItems: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "baseline", label: "Baseline" },
  { id: "playground", label: "Chat" },
  { id: "requests", label: "Requests" },
  { id: "registry", label: "Registry" },
];

function fmt(n: number, d = 4) {
  return n.toFixed(d);
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

const chartTooltipStyle = {
  background: "var(--panel)",
  border: "1px solid var(--rule)",
  borderRadius: 8,
  color: "var(--ink)",
  boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
} as const;

const chartHoverCursor = { fill: "rgba(92, 255, 176, 0.07)" };

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
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [evalProgress, setEvalProgress] = useState<EvalProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showFullCatalog, setShowFullCatalog] = useState(false);
  const [preferMotion, setPreferMotion] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPreferMotion(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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

  // Live Overview: poll every 5s while the tab is open (pause during eval).
  useEffect(() => {
    if (tab !== "overview" || busy) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => window.clearInterval(id);
  }, [tab, busy]);

  const taskChart = useMemo(() => {
    const map = new Map<string, { task: string; routed: number; baseline: number }>();
    for (const row of byTask) {
      const task = String(row.task_type);
      const cur = map.get(task) || { task, routed: 0, baseline: 0 };
      const costInr = usdToInr(Number(row.total_cost));
      if (row.policy === "routed" || row.policy === "orchestra") {
        cur.routed += costInr;
      } else if (row.policy === "baseline") {
        cur.baseline += costInr;
      }
      map.set(task, cur);
    }
    return [...map.values()];
  }, [byTask]);

  const liveSavedInr = useMemo(() => {
    if (!overview?.routed || !overview?.baseline) return 0;
    return Math.max(
      0,
      usdToInr(overview.baseline.total_cost) - usdToInr(overview.routed.total_cost),
    );
  }, [overview]);

  const overviewCostCompare = useMemo(() => {
    if (!overview?.routed || !overview?.baseline) return [];
    return [
      {
        name: "Total cost",
        routed: usdToInr(overview.routed.total_cost),
        baseline: usdToInr(overview.baseline.total_cost),
      },
    ];
  }, [overview]);

  const providerMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of byModel) {
      const n = Number(r.requests) || 0;
      if (n <= 0) continue;
      const provider = String(r.provider || "unknown");
      map.set(provider, (map.get(provider) || 0) + n);
    }
    return [...map.entries()]
      .map(([provider, requests]) => ({ provider, requests }))
      .sort((a, b) => b.requests - a.requests);
  }, [byModel]);

  const topModelsChart = useMemo(() => {
    return [...byModel]
      .filter((r) => Number(r.requests) > 0)
      .sort((a, b) => Number(b.requests) - Number(a.requests))
      .slice(0, 8)
      .map((r) => ({
        name: String(r.display_name || r.model).slice(0, 22),
        requests: Number(r.requests) || 0,
        cost: usdToInr(Number(r.total_cost) || 0),
      }));
  }, [byModel]);

  const trafficRows = useMemo(() => {
    if (showFullCatalog) return byModel;
    return byModel.filter((r) => Number(r.requests) > 0);
  }, [byModel, showFullCatalog]);

  const evalTaskChart = useMemo(() => {
    const map = new Map<string, { task: string; routed: number; baseline: number }>();
    for (const row of evalResult?.by_task || []) {
      const task = String(row.task_type);
      const cur = map.get(task) || { task, routed: 0, baseline: 0 };
      const costInr = usdToInr(Number(row.total_cost));
      if (row.policy === "routed" || row.policy === "orchestra") {
        cur.routed += costInr;
      } else if (row.policy === "baseline") {
        cur.baseline += costInr;
      }
      map.set(task, cur);
    }
    return [...map.values()];
  }, [evalResult?.by_task]);

  const evalCostCompare = useMemo(() => {
    if (!evalResult?.routed || !evalResult?.baseline) return [];
    return [
      {
        name: "Cost (INR)",
        routed: usdToInr(evalResult.routed.total_cost),
        baseline: usdToInr(evalResult.baseline.total_cost),
      },
    ];
  }, [evalResult]);

  const evalQualityCompare = useMemo(() => {
    if (!evalResult?.routed || !evalResult?.baseline) return [];
    return [
      {
        name: "Quality",
        routed: evalResult.routed.avg_quality,
        baseline: evalResult.baseline.avg_quality,
      },
      {
        name: "Success",
        routed: evalResult.routed.success_rate,
        baseline: evalResult.baseline.success_rate,
      },
    ];
  }, [evalResult]);

  const evalLatencyCompare = useMemo(() => {
    if (!evalResult?.routed || !evalResult?.baseline) return [];
    return [
      {
        name: "Latency (ms)",
        routed: evalResult.routed.avg_latency_ms,
        baseline: evalResult.baseline.avg_latency_ms,
      },
    ];
  }, [evalResult]);

  const evalSavedInr = useMemo(() => {
    if (!evalResult?.routed || !evalResult?.baseline) return 0;
    return Math.max(
      0,
      usdToInr(evalResult.baseline.total_cost) - usdToInr(evalResult.routed.total_cost),
    );
  }, [evalResult]);

  function applyEvalEvent(ev: StreamEvent) {
    const d = ev.data;
    if (ev.event === "started") {
      setEvalProgress({
        runId: String(d.run_id ?? ""),
        index: 0,
        total: Number(d.total_calls ?? 0),
        promptIndex: 0,
        promptCount: Number(d.prompt_count ?? 0),
        policy: null,
        taskType: null,
        promptPreview: null,
        status: String(d.status ?? "Starting eval…"),
        lastModel: null,
        lastProvider: null,
        lastLatencyMs: null,
        lastCost: null,
        lastSuccess: null,
      });
      return;
    }
    if (ev.event === "step") {
      setEvalProgress((prev) => ({
        runId: prev?.runId ?? null,
        index: Number(d.index ?? 0),
        total: Number(d.total ?? prev?.total ?? 0),
        promptIndex: Number(d.prompt_index ?? 0),
        promptCount: Number(d.prompt_count ?? prev?.promptCount ?? 0),
        policy: String(d.policy ?? ""),
        taskType: d.task_type != null ? String(d.task_type) : null,
        promptPreview: d.prompt_preview != null ? String(d.prompt_preview) : null,
        status: String(d.status ?? "Running…"),
        lastModel: prev?.lastModel ?? null,
        lastProvider: prev?.lastProvider ?? null,
        lastLatencyMs: prev?.lastLatencyMs ?? null,
        lastCost: prev?.lastCost ?? null,
        lastSuccess: prev?.lastSuccess ?? null,
      }));
      return;
    }
    if (ev.event === "step_done") {
      setEvalProgress((prev) => ({
        runId: prev?.runId ?? null,
        index: Number(d.index ?? prev?.index ?? 0),
        total: Number(d.total ?? prev?.total ?? 0),
        promptIndex: Number(d.prompt_index ?? prev?.promptIndex ?? 0),
        promptCount: Number(d.prompt_count ?? prev?.promptCount ?? 0),
        policy: String(d.policy ?? prev?.policy ?? ""),
        taskType: d.task_type != null ? String(d.task_type) : prev?.taskType ?? null,
        promptPreview: prev?.promptPreview ?? null,
        status: String(d.status ?? "Step done"),
        lastModel: d.model != null ? String(d.model) : null,
        lastProvider: d.provider != null ? String(d.provider) : null,
        lastLatencyMs: d.latency_ms != null ? Number(d.latency_ms) : null,
        lastCost: d.est_cost != null ? Number(d.est_cost) : null,
        lastSuccess: d.success != null ? Boolean(d.success) : null,
      }));
    }
  }

  async function onEval() {
    setBusy(true);
    setError(null);
    setEvalResult(null);
    setEvalProgress({
      runId: null,
      index: 0,
      total: 0,
      promptIndex: 0,
      promptCount: 0,
      policy: null,
      taskType: null,
      promptPreview: null,
      status: "Connecting to eval stream…",
      lastModel: null,
      lastProvider: null,
      lastLatencyMs: null,
      lastCost: null,
      lastSuccess: null,
    });
    setTab("baseline");
    try {
      // Cap fixture size for UI runs (full suite is 44×2 sequential LLM calls).
      const res = await api.runEvalStream(12, applyEvalEvent);
      setEvalResult(res);
      setEvalProgress(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "eval failed");
      setEvalProgress(null);
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Tab, string> = {
    overview: "Overview",
    baseline: "Baseline",
    playground: "Chat",
    requests: "Requests",
    registry: "Registry",
  };

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
            {busy && tab !== "playground" ? "Running eval…" : "Run eval"}
          </button>
        </div>
      </header>

      <main
        className={`main${tab === "playground" ? " main--chat" : ""}${tab === "overview" ? " main--overview" : ""}`}
      >
        {tab !== "playground" && tab !== "overview" && (
          <div className="main__head">
            <h1>{titles[tab]}</h1>
            {tab === "baseline" && (
              <p>
                {busy
                  ? "Eval in progress — comparing baseline vs routed on each fixture prompt."
                  : `Run the fixture suite against ${models?.baseline_model ?? "baseline"}.`}
              </p>
            )}
            {tab === "requests" && <p>Recent requests with cost (INR), latency, and quality.</p>}
            {tab === "registry" && <p>Model list and specialty strengths used for routing.</p>}
          </div>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {tab === "overview" && overview && (
          <div className="stack overview-dash">
            <div className="main__head overview-dash__head">
              <h1>Overview</h1>
              <p>
                Live ops vs locked baseline. Auto-refreshes every 5s.
                {overview.as_of ? <> Updated {new Date(overview.as_of).toLocaleTimeString()}.</> : null}
              </p>
            </div>

            <section className="overview-hero" aria-label="Live savings">
              {preferMotion && (
                <video
                  className="overview-hero__video"
                  src="/overview-hero.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  aria-hidden="true"
                />
              )}
              <div className="overview-hero__shade" aria-hidden="true" />
              <div className="overview-hero__content">
                <p className="overview-hero__eyebrow">Live savings vs locked baseline</p>
                <p className="overview-hero__value">
                  {liveSavedInr > 0 ? (
                    <>
                      Saved {fmtINR(liveSavedInr)}
                      {overview.cost_savings_vs_baseline != null && (
                        <span> ({pct(overview.cost_savings_vs_baseline)})</span>
                      )}
                    </>
                  ) : (
                    <>No savings yet — send Chat traffic</>
                  )}
                </p>
                <p className="overview-hero__note">
                  Routed is actual Chat spend. Baseline is list price of{" "}
                  <code>{models?.baseline_model ?? "baseline"}</code> on the same tokens.
                </p>
              </div>
            </section>

            <MetricStrip
              title="Routed / Orchestrator"
              m={overview.routed}
              savings={overview.cost_savings_vs_baseline}
            />
            <MetricStrip
              title={`Baseline (${models?.baseline_model ?? "locked"})`}
              m={overview.baseline}
            />

            <div className="overview-grid">
              <section className="block">
                <h2>Cost by task (INR)</h2>
                <div className="chart chart--tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={taskChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                      <XAxis
                        dataKey="task"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "var(--muted)", fontSize: 11 }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={52}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "var(--muted)", fontSize: 11 }}
                        tickFormatter={(v: number) => `₹${Number(v).toFixed(0)}`}
                      />
                      <Tooltip
                        cursor={chartHoverCursor}
                        contentStyle={chartTooltipStyle}
                        labelStyle={{ color: "var(--muted)", marginBottom: 4 }}
                        itemStyle={{ color: "var(--ink)" }}
                        formatter={(value: number, name: string) => [fmtINR(Number(value)), name]}
                      />
                      <Legend wrapperStyle={{ color: "var(--muted)", fontSize: 12 }} />
                      <Bar dataKey="routed" name="Routed" fill="var(--accent)" maxBarSize={28} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="baseline" name="Baseline" fill="var(--ink-soft)" maxBarSize={28} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="block">
                <h2>Cost head-to-head (INR)</h2>
                <div className="chart chart--tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overviewCostCompare} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} />
                      <YAxis
                        tick={{ fill: "var(--muted)", fontSize: 11 }}
                        tickFormatter={(v: number) => `₹${Number(v).toFixed(0)}`}
                      />
                      <Tooltip
                        cursor={chartHoverCursor}
                        contentStyle={chartTooltipStyle}
                        labelStyle={{ color: "var(--muted)", marginBottom: 4 }}
                        itemStyle={{ color: "var(--ink)" }}
                        formatter={(value: number, name: string) => [fmtINR(Number(value)), name]}
                      />
                      <Legend />
                      <Bar dataKey="routed" name="Routed" fill="var(--accent)" maxBarSize={56} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="baseline" name="Baseline" fill="var(--ink-soft)" maxBarSize={56} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="block">
                <h2>Provider mix (requests)</h2>
                <div className="chart chart--tall">
                  {providerMix.length === 0 ? (
                    <p className="muted" style={{ padding: 16 }}>
                      No live traffic yet.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={providerMix}
                        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 11 }} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="provider"
                          width={88}
                          tick={{ fill: "var(--muted)", fontSize: 12 }}
                        />
                        <Tooltip
                          cursor={chartHoverCursor}
                          contentStyle={chartTooltipStyle}
                          labelStyle={{ color: "var(--muted)", marginBottom: 4 }}
                          itemStyle={{ color: "var(--ink)" }}
                          formatter={(value: number) => [String(value), "Requests"]}
                        />
                        <Bar dataKey="requests" name="Requests" fill="var(--accent)" maxBarSize={22} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section className="block">
                <h2>Top models by traffic</h2>
                <div className="chart chart--tall">
                  {topModelsChart.length === 0 ? (
                    <p className="muted" style={{ padding: 16 }}>
                      No active models yet.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={topModelsChart}
                        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 11 }} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={120}
                          tick={{ fill: "var(--muted)", fontSize: 11 }}
                        />
                        <Tooltip
                          cursor={chartHoverCursor}
                          contentStyle={chartTooltipStyle}
                          labelStyle={{ color: "var(--muted)", marginBottom: 4 }}
                          itemStyle={{ color: "var(--ink)" }}
                          formatter={(value: number) => [String(value), "Requests"]}
                        />
                        <Bar dataKey="requests" name="Requests" fill="var(--accent)" maxBarSize={20} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>
            </div>

            <section className="block">
              <div className="block__head">
                <h2>Traffic by model</h2>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setShowFullCatalog((v) => !v)}
                >
                  {showFullCatalog ? "Active only" : "Show full catalog"}
                </button>
              </div>
              <p className="scope-note">
                {showFullCatalog
                  ? `Full live catalog (${byModel.length} models).`
                  : `Active models (${trafficRows.length} of ${byModel.length}).`}{" "}
                Mock / eval / retired traffic stays hidden.
              </p>
              <div className="table-scroll table-scroll--overview">
                <table className="wide">
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Provider</th>
                      <th>Requests</th>
                      <th>Cost</th>
                      <th>Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trafficRows.map((r) => (
                      <tr key={String(r.model)}>
                        <td className="mono">{String(r.display_name || r.model)}</td>
                        <td>{String(r.provider || "—")}</td>
                        <td>{String(r.requests)}</td>
                        <td>{moneyINR(Number(r.total_cost))}</td>
                        <td>
                          {Number(r.requests) > 0 ? `${String(r.avg_latency_ms)} ms` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {tab === "baseline" && (
          <div className="stack">
            {evalProgress && (
              <section className="eval-progress" aria-live="polite">
                <div className="eval-progress__head">
                  <h2>Eval progress</h2>
                  <span>
                    {evalProgress.total > 0
                      ? `${Math.min(evalProgress.index, evalProgress.total)} / ${evalProgress.total}`
                      : "…"}
                  </span>
                </div>
                <div
                  className="eval-progress__bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    evalProgress.total > 0
                      ? Math.round((evalProgress.index / evalProgress.total) * 100)
                      : 0
                  }
                >
                  <div className="eval-progress__track" aria-hidden="true">
                    <div
                      className="eval-progress__fill"
                      style={{
                        width: `${
                          evalProgress.total > 0
                            ? Math.min(100, (evalProgress.index / evalProgress.total) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
                <p className="eval-progress__status">{evalProgress.status}</p>
                {(evalProgress.policy || evalProgress.promptPreview) && (
                  <div className="eval-progress__now">
                    {evalProgress.policy && (
                      <p className="eval-progress__policy">
                        <strong>{evalProgress.policy}</strong>
                        {evalProgress.taskType ? <> · {evalProgress.taskType}</> : null}
                        {evalProgress.promptCount > 0 ? (
                          <>
                            {" "}
                            · prompt {evalProgress.promptIndex}/{evalProgress.promptCount}
                          </>
                        ) : null}
                      </p>
                    )}
                    {evalProgress.promptPreview && (
                      <p className="eval-progress__prompt">{evalProgress.promptPreview}</p>
                    )}
                  </div>
                )}
                {evalProgress.lastModel && (
                  <p className="eval-progress__last">
                    Last: <strong>{evalProgress.lastModel}</strong>
                    {evalProgress.lastProvider ? (
                      <span className="eval-progress__provider"> · {evalProgress.lastProvider}</span>
                    ) : null}
                    {evalProgress.lastLatencyMs != null ? <> · {evalProgress.lastLatencyMs} ms</> : null}
                    {evalProgress.lastCost != null ? <> · {moneyINR(evalProgress.lastCost)}</> : null}
                    {evalProgress.lastSuccess === false ? <> · failed</> : null}
                  </p>
                )}
              </section>
            )}
            {!evalResult && !evalProgress && (
              <div className="empty">
                <p>No evaluation yet. Run the fixture suite to compare cost, latency, and quality.</p>
                <button className="solid" disabled={busy} onClick={() => void onEval()} type="button">
                  Run eval
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

                {evalResult.cost_savings_vs_baseline != null && evalSavedInr > 0 && (
                  <section className="eval-savings" aria-label="Eval savings">
                    <p className="eval-savings__eyebrow">Matched fixture savings</p>
                    <p className="eval-savings__value">
                      Saved {fmtINR(evalSavedInr)}{" "}
                      <span>({pct(evalResult.cost_savings_vs_baseline)})</span>
                    </p>
                    <p className="eval-savings__note">
                      vs locked baseline <code>{models?.baseline_model ?? "baseline"}</code> on the same
                      prompts (list prices in INR).
                    </p>
                  </section>
                )}

                <div className="baseline-metrics">
                  <MetricStrip
                    title="Routed"
                    m={evalResult.routed}
                    savings={evalResult.cost_savings_vs_baseline}
                  />
                  <MetricStrip title="Baseline" m={evalResult.baseline} />
                </div>

                <div className="split baseline-charts">
                  <section className="block">
                    <h2>Cost (INR)</h2>
                    <div className="chart chart--baseline">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={evalCostCompare}
                          margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
                          barCategoryGap="28%"
                          barGap={8}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "var(--muted)", fontSize: 12 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            width={44}
                            tick={{ fill: "var(--muted)", fontSize: 11 }}
                            tickFormatter={(v: number) => `₹${Number(v).toFixed(0)}`}
                          />
                          <Tooltip
                            cursor={chartHoverCursor}
                            contentStyle={chartTooltipStyle}
                            labelStyle={{ color: "var(--muted)", marginBottom: 4 }}
                            itemStyle={{ color: "var(--ink)" }}
                            formatter={(value: number, name: string) => [fmtINR(Number(value)), name]}
                            allowEscapeViewBox={{ x: true, y: true }}
                          />
                          <Legend wrapperStyle={{ color: "var(--muted)", fontSize: 12, paddingTop: 4 }} />
                          <Bar
                            dataKey="routed"
                            name="Routed"
                            fill="var(--accent)"
                            maxBarSize={72}
                            radius={[4, 4, 0, 0]}
                            activeBar={{ fill: "var(--accent)", stroke: "var(--ink)", strokeWidth: 1 }}
                          />
                          <Bar
                            dataKey="baseline"
                            name="Baseline"
                            fill="var(--ink-soft)"
                            maxBarSize={72}
                            radius={[4, 4, 0, 0]}
                            activeBar={{ fill: "var(--ink-soft)", stroke: "var(--ink)", strokeWidth: 1 }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                  <section className="block">
                    <h2>Quality & success</h2>
                    <div className="chart chart--baseline">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={evalQualityCompare}
                          margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
                          barCategoryGap="22%"
                          barGap={6}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "var(--muted)", fontSize: 12 }}
                          />
                          <YAxis
                            domain={[0, 1]}
                            axisLine={false}
                            tickLine={false}
                            width={44}
                            tick={{ fill: "var(--muted)", fontSize: 11 }}
                            tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
                          />
                          <Tooltip
                            cursor={chartHoverCursor}
                            contentStyle={chartTooltipStyle}
                            labelStyle={{ color: "var(--muted)", marginBottom: 4 }}
                            itemStyle={{ color: "var(--ink)" }}
                            formatter={(value: number, name: string) => [
                              `${(Number(value) * 100).toFixed(1)}%`,
                              name,
                            ]}
                            allowEscapeViewBox={{ x: true, y: true }}
                          />
                          <Legend wrapperStyle={{ color: "var(--muted)", fontSize: 12, paddingTop: 4 }} />
                          <Bar
                            dataKey="routed"
                            name="Routed"
                            fill="var(--accent)"
                            maxBarSize={56}
                            radius={[4, 4, 0, 0]}
                            activeBar={{ fill: "var(--accent)", stroke: "var(--ink)", strokeWidth: 1 }}
                          />
                          <Bar
                            dataKey="baseline"
                            name="Baseline"
                            fill="var(--ink-soft)"
                            maxBarSize={56}
                            radius={[4, 4, 0, 0]}
                            activeBar={{ fill: "var(--ink-soft)", stroke: "var(--ink)", strokeWidth: 1 }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                </div>

                <div className="split baseline-charts">
                  <section className="block">
                    <h2>Avg latency</h2>
                    <div className="chart chart--baseline">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={evalLatencyCompare}
                          margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
                          barCategoryGap="28%"
                          barGap={8}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "var(--muted)", fontSize: 12 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            width={52}
                            tick={{ fill: "var(--muted)", fontSize: 11 }}
                            tickFormatter={(v: number) => `${Math.round(Number(v) / 1000)}k`}
                          />
                          <Tooltip
                            cursor={chartHoverCursor}
                            contentStyle={chartTooltipStyle}
                            labelStyle={{ color: "var(--muted)", marginBottom: 4 }}
                            itemStyle={{ color: "var(--ink)" }}
                            formatter={(value: number, name: string) => [
                              `${Number(value).toFixed(0)} ms`,
                              name,
                            ]}
                            allowEscapeViewBox={{ x: true, y: true }}
                          />
                          <Legend wrapperStyle={{ color: "var(--muted)", fontSize: 12, paddingTop: 4 }} />
                          <Bar
                            dataKey="routed"
                            name="Routed"
                            fill="var(--accent)"
                            maxBarSize={72}
                            radius={[4, 4, 0, 0]}
                            activeBar={{ fill: "var(--accent)", stroke: "var(--ink)", strokeWidth: 1 }}
                          />
                          <Bar
                            dataKey="baseline"
                            name="Baseline"
                            fill="var(--ink-soft)"
                            maxBarSize={72}
                            radius={[4, 4, 0, 0]}
                            activeBar={{ fill: "var(--ink-soft)", stroke: "var(--ink)", strokeWidth: 1 }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                  <section className="block">
                    <h2>Matched cost by task (INR)</h2>
                    <div className="chart chart--baseline">
                      {evalTaskChart.length === 0 ? (
                        <p className="muted" style={{ padding: 16 }}>
                          No per-task rows for this eval yet.
                        </p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={evalTaskChart}
                            margin={{ top: 12, right: 8, left: 0, bottom: 12 }}
                            barCategoryGap="18%"
                            barGap={6}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                            <XAxis
                              dataKey="task"
                              axisLine={false}
                              tickLine={false}
                              interval={0}
                              angle={-18}
                              textAnchor="end"
                              height={48}
                              tick={{ fill: "var(--muted)", fontSize: 11 }}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              width={44}
                              tick={{ fill: "var(--muted)", fontSize: 11 }}
                              tickFormatter={(v: number) => `₹${Number(v).toFixed(0)}`}
                            />
                            <Tooltip
                              cursor={chartHoverCursor}
                              contentStyle={chartTooltipStyle}
                              labelStyle={{ color: "var(--muted)", marginBottom: 4 }}
                              itemStyle={{ color: "var(--ink)" }}
                              formatter={(value: number, name: string) => [fmtINR(Number(value)), name]}
                              allowEscapeViewBox={{ x: true, y: true }}
                            />
                            <Legend wrapperStyle={{ color: "var(--muted)", fontSize: 12, paddingTop: 4 }} />
                            <Bar
                              dataKey="routed"
                              name="Routed"
                              fill="var(--accent)"
                              maxBarSize={40}
                              radius={[3, 3, 0, 0]}
                              activeBar={{ fill: "var(--accent)", stroke: "var(--ink)", strokeWidth: 1 }}
                            />
                            <Bar
                              dataKey="baseline"
                              name="Baseline"
                              fill="var(--ink-soft)"
                              maxBarSize={40}
                              radius={[3, 3, 0, 0]}
                              activeBar={{ fill: "var(--ink-soft)", stroke: "var(--ink)", strokeWidth: 1 }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </section>
                </div>

                {(evalResult.requests?.length ?? 0) > 0 && (
                  <section className="block">
                    <div className="block__head">
                      <h2>Eval requests</h2>
                      <span>{evalResult.requests?.length}</span>
                    </div>
                    <div className="table-scroll">
                      <table className="wide">
                        <thead>
                          <tr>
                            <th>Task</th>
                            <th>Policy</th>
                            <th>Model</th>
                            <th>Cost</th>
                            <th>Latency</th>
                            <th>Quality</th>
                            <th>OK</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evalResult.requests?.map((r) => (
                            <tr key={r.id}>
                              <td>{r.task_type}</td>
                              <td>{r.policy}</td>
                              <td className="mono">{r.model}</td>
                              <td>{moneyINR(Number(r.est_cost))}</td>
                              <td>{r.latency_ms} ms</td>
                              <td>{fmt(Number(r.quality_score), 3)}</td>
                              <td>{r.success ? "yes" : "no"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* Keep Chat mounted so in-flight streams + thread survive other tabs. */}
        <div
          className={tab === "playground" ? undefined : "tab-panel--hidden"}
          aria-hidden={tab !== "playground"}
        >
          <ChatPlayground onRefresh={() => void refresh()} />
        </div>

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
                    <th>List ₹ / 1K in</th>
                    <th>Latency</th>
                    <th>Code</th>
                    <th>Summary</th>
                    <th>Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {models.models.map((m) => {
                    const s = m.strengths as Record<string, number>;
                    const listIn = Number(m.input_cost_per_1k);
                    const freeTier = m.billable === false;
                    return (
                      <tr key={String(m.id)}>
                        <td className="mono">{String(m.display_name)}</td>
                        <td>{String(m.provider)}</td>
                        <td>
                          {listIn === 0
                            ? "₹0"
                            : `${fmtINRCompact(usdToInr(listIn))} / 1K`}
                          {freeTier ? " · free tier" : ""}
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
