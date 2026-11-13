import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MODEL_RATES,
  SCENARIO,
  VOLUME_PRESETS,
  type VolumePresetKey,
  computeScenario,
  fmtINR,
  fmtTokens,
} from "./landingEconomics";

const PRESET_ORDER: VolumePresetKey[] = ["light", "demo", "heavy"];

export default function SavingsDashboard() {
  const [competitorId, setCompetitorId] = useState<string>(SCENARIO.heavyModelId);
  const [inputTokens, setInputTokens] = useState<number>(SCENARIO.inputTokens);
  const [outputTokens, setOutputTokens] = useState<number>(SCENARIO.outputTokens);

  const result = useMemo(
    () => computeScenario({ competitorId, inputTokens, outputTokens }),
    [competitorId, inputTokens, outputTokens],
  );

  const activePreset = PRESET_ORDER.find(
    (k) =>
      VOLUME_PRESETS[k].inputTokens === inputTokens &&
      VOLUME_PRESETS[k].outputTokens === outputTokens,
  );

  const chartData = [
    { name: "Always model", cost: Math.max(0, result.competitorInr), fill: "#8b949e" },
    { name: "Orchestrator mix", cost: Math.max(0, result.orchestraInr), fill: "#5cffb0" },
  ];

  const savePositive = result.savedInr >= 0;

  return (
    <div className="dash">
      <div className="dash__controls">
        <label className="dash__field">
          <span>Compare against</span>
          <select value={competitorId} onChange={(e) => setCompetitorId(e.target.value)}>
            {MODEL_RATES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
                {m.inputUsdPer1k === 0 && m.outputUsdPer1k === 0 ? " · Free" : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="dash__presets" role="group" aria-label="Volume presets">
          {PRESET_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              className={activePreset === key ? "dash__chip dash__chip--on" : "dash__chip"}
              onClick={() => {
                setInputTokens(VOLUME_PRESETS[key].inputTokens);
                setOutputTokens(VOLUME_PRESETS[key].outputTokens);
              }}
            >
              {VOLUME_PRESETS[key].label}
            </button>
          ))}
        </div>

        <label className="dash__field dash__field--slider">
          <span>
            Input tokens <strong>{fmtTokens(inputTokens)}</strong>
          </span>
          <input
            type="range"
            min={1_000_000}
            max={50_000_000}
            step={1_000_000}
            value={inputTokens}
            onChange={(e) => setInputTokens(Number(e.target.value))}
          />
        </label>

        <label className="dash__field dash__field--slider">
          <span>
            Output tokens <strong>{fmtTokens(outputTokens)}</strong>
          </span>
          <input
            type="range"
            min={500_000}
            max={20_000_000}
            step={500_000}
            value={outputTokens}
            onChange={(e) => setOutputTokens(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="dash__kpis">
        <div className="dash__kpi">
          <span className="dash__kpi-label">Always {result.competitorName}</span>
          <span className="dash__kpi-value">{fmtINR(result.competitorInr)}</span>
        </div>
        <div className="dash__kpi">
          <span className="dash__kpi-label">Orchestrator mix</span>
          <span className="dash__kpi-value dash__kpi-value--signal">{fmtINR(result.orchestraInr)}</span>
        </div>
        <div className={`dash__kpi dash__kpi--save${savePositive ? "" : " dash__kpi--warn"}`}>
          <span className="dash__kpi-label">{savePositive ? "You save" : "Orchestrator costs more"}</span>
          <span className="dash__kpi-value">
            {fmtINR(Math.abs(result.savedInr))}
            <small>
              {Number.isFinite(result.savedPct) ? ` ${result.savedPct.toFixed(0)}%` : ""}
            </small>
          </span>
        </div>
      </div>

      <div className="dash__chart" aria-label="Cost comparison chart">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="rgba(232,236,239,0.08)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#8b949e", fontSize: 11, fontFamily: "IBM Plex Mono" }}
              axisLine={{ stroke: "rgba(232,236,239,0.12)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#8b949e", fontSize: 11, fontFamily: "IBM Plex Mono" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `₹${Math.round(v)}`}
              width={48}
            />
            <Tooltip
              cursor={{ fill: "rgba(92,255,176,0.06)" }}
              contentStyle={{
                background: "#0d1114",
                border: "1px solid rgba(232,236,239,0.12)",
                borderRadius: 2,
                fontFamily: "IBM Plex Mono",
                fontSize: 12,
              }}
              labelStyle={{ color: "#8b949e" }}
              formatter={(value: number) => [fmtINR(value), "INR"]}
            />
            <Bar dataKey="cost" radius={[2, 2, 0, 0]} isAnimationActive animationDuration={450}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="dash__note">
        Demo estimate in INR for {fmtTokens(inputTokens)} input · {fmtTokens(outputTokens)} output tokens.
        Free-tier limits may still apply.
      </p>
    </div>
  );
}
