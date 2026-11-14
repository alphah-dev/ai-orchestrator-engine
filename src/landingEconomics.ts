/** Illustrative demo economics from models.yaml × fixed FX — not live billing. */

export const USD_TO_INR = 83;

export type ModelRate = {
  id: string;
  displayName: string;
  provider: string;
  inputUsdPer1k: number;
  outputUsdPer1k: number;
};

/** Mirrored from backend/config/models.yaml catalog rates. */
export const MODEL_RATES: ModelRate[] = [
  {
    id: "groq-gpt-oss-20b",
    displayName: "GPT-OSS 20B (Groq)",
    provider: "groq",
    inputUsdPer1k: 0.0001,
    outputUsdPer1k: 0.0005,
  },
  {
    id: "groq-gpt-oss-120b",
    displayName: "GPT-OSS 120B (Groq)",
    provider: "groq",
    inputUsdPer1k: 0.00015,
    outputUsdPer1k: 0.0006,
  },
  {
    id: "groq-qwen3-27b",
    displayName: "Qwen 3.8 27B (Groq)",
    provider: "groq",
    inputUsdPer1k: 0.0001,
    outputUsdPer1k: 0.0004,
  },
  {
    id: "gemini-3.5-flash-lite",
    displayName: "Gemini 3.5 Flash Lite",
    provider: "gemini",
    inputUsdPer1k: 0.00025,
    outputUsdPer1k: 0.0015,
  },
  {
    id: "gemini-3.5-flash",
    displayName: "Gemini 3.5 Flash",
    provider: "gemini",
    inputUsdPer1k: 0.0005,
    outputUsdPer1k: 0.003,
  },
  {
    id: "gemini-3.6-flash",
    displayName: "Gemini 3.6 Flash",
    provider: "gemini",
    inputUsdPer1k: 0.00075,
    outputUsdPer1k: 0.00375,
  },
  {
    id: "nvidia-llama-3.2-11b",
    displayName: "Llama 3.2 11B Vision (NVIDIA)",
    provider: "nvidia",
    inputUsdPer1k: 0.00005,
    outputUsdPer1k: 0.00008,
  },
  {
    id: "nvidia-glm-5.3-flash",
    displayName: "GLM 5.3 Flash (NVIDIA)",
    provider: "nvidia",
    inputUsdPer1k: 0.0001,
    outputUsdPer1k: 0.0004,
  },
  {
    id: "or-lfm-2.5-free",
    displayName: "LFM 2.5 2.6B (OpenRouter free)",
    provider: "openrouter",
    inputUsdPer1k: 0.0,
    outputUsdPer1k: 0.0,
  },
  {
    id: "or-nemotron-lightning-free",
    displayName: "Nemotron 3.5 Lightning (OpenRouter free)",
    provider: "openrouter",
    inputUsdPer1k: 0.0,
    outputUsdPer1k: 0.0,
  },
  {
    id: "or-auto-free",
    displayName: "OpenRouter Free Router",
    provider: "openrouter",
    inputUsdPer1k: 0.0,
    outputUsdPer1k: 0.0,
  },
  {
    id: "or-laguna-xs-free",
    displayName: "Laguna XS 2.1 (OpenRouter free)",
    provider: "openrouter",
    inputUsdPer1k: 0.0,
    outputUsdPer1k: 0.0,
  },
  {
    id: "or-north-mini-code-free",
    displayName: "North Mini Code (OpenRouter free)",
    provider: "openrouter",
    inputUsdPer1k: 0.0,
    outputUsdPer1k: 0.0,
  },
  {
    id: "or-laguna-s-free",
    displayName: "Laguna S 2.1 (OpenRouter free)",
    provider: "openrouter",
    inputUsdPer1k: 0.0,
    outputUsdPer1k: 0.0,
  },
  // CoArena: vendor list rates (free tier covers the call; overview still shows list cost)
  { id: "ca-claude-opus-5-5", displayName: "Claude Opus 5.5 (CoArena)", provider: "coarena", inputUsdPer1k: 0.004, outputUsdPer1k: 0.02 },
  { id: "ca-claude-sonnet-5-5", displayName: "Claude Sonnet 5.5 (CoArena)", provider: "coarena", inputUsdPer1k: 0.002, outputUsdPer1k: 0.01 },
  { id: "ca-claude-fable-5", displayName: "Claude Fable 5 (CoArena)", provider: "coarena", inputUsdPer1k: 0.01, outputUsdPer1k: 0.05 },
  { id: "ca-claude-fable-5-1", displayName: "Claude Fable 5.1 (CoArena)", provider: "coarena", inputUsdPer1k: 0.01, outputUsdPer1k: 0.05 },
  { id: "ca-claude-fable-5-2", displayName: "Claude Fable 5.2 (CoArena)", provider: "coarena", inputUsdPer1k: 0.008, outputUsdPer1k: 0.04 },
  { id: "ca-claude-haiku-5-5", displayName: "Claude Haiku 5.5 (CoArena)", provider: "coarena", inputUsdPer1k: 0.0001, outputUsdPer1k: 0.0005 },
  { id: "ca-deepseek-v4-1-flash", displayName: "DeepSeek V4.1 Flash (CoArena)", provider: "coarena", inputUsdPer1k: 0.00014, outputUsdPer1k: 0.00028 },
  { id: "ca-glm-5-3-flash", displayName: "GLM 5.3 Flash (CoArena)", provider: "coarena", inputUsdPer1k: 0.0001, outputUsdPer1k: 0.0004 },
  { id: "ca-gemini-3-8-flash", displayName: "Gemini 3.8 Flash (CoArena)", provider: "coarena", inputUsdPer1k: 0.00075, outputUsdPer1k: 0.00375 },
  { id: "ca-gemini-4-argon", displayName: "Gemini 4 Argon (CoArena)", provider: "coarena", inputUsdPer1k: 0.002, outputUsdPer1k: 0.01 },
  { id: "ca-gemini-4-carbon", displayName: "Gemini 4 Carbon (CoArena)", provider: "coarena", inputUsdPer1k: 0.002, outputUsdPer1k: 0.01 },
  { id: "ca-gpt-6-1-terra", displayName: "GPT-6.1 Terra (CoArena)", provider: "coarena", inputUsdPer1k: 0.001, outputUsdPer1k: 0.005 },
  { id: "ca-gpt-6-1-sol", displayName: "GPT-6.1 Sol (CoArena)", provider: "coarena", inputUsdPer1k: 0.002, outputUsdPer1k: 0.01 },
  { id: "ca-gpt-6-astra", displayName: "GPT-6 Astra (CoArena)", provider: "coarena", inputUsdPer1k: 0.01, outputUsdPer1k: 0.05 },
  { id: "ca-gpt-6-luna", displayName: "GPT-6 Luna (CoArena)", provider: "coarena", inputUsdPer1k: 0.0001, outputUsdPer1k: 0.0005 },
  { id: "ca-grok-4-7", displayName: "Grok 4.7 (CoArena)", provider: "coarena", inputUsdPer1k: 0.003, outputUsdPer1k: 0.015 },
  { id: "ca-kimi-k3-1-pro", displayName: "Kimi K3.1 Pro (CoArena)", provider: "coarena", inputUsdPer1k: 0.0012, outputUsdPer1k: 0.006 },
  { id: "ca-mimo-v2-6-pro", displayName: "MiMo V2.6 Pro (CoArena)", provider: "coarena", inputUsdPer1k: 0.0004, outputUsdPer1k: 0.002 },
  { id: "ca-minimax-m3-1-flash", displayName: "MiniMax M3.1 Flash (CoArena)", provider: "coarena", inputUsdPer1k: 0.00015, outputUsdPer1k: 0.0006 },
  { id: "ca-hy4", displayName: "Hy4 (CoArena)", provider: "coarena", inputUsdPer1k: 0.001, outputUsdPer1k: 0.004 },
];

export const VOLUME_PRESETS = {
  light: { inputTokens: 2_000_000, outputTokens: 500_000, label: "Light" },
  demo: { inputTokens: 10_000_000, outputTokens: 3_000_000, label: "Demo" },
  heavy: { inputTokens: 30_000_000, outputTokens: 10_000_000, label: "Heavy" },
} as const;

export type VolumePresetKey = keyof typeof VOLUME_PRESETS;

/** Default demo monthly volume + always-heavy competitor + orchestra mix shares. */
export const SCENARIO = {
  inputTokens: VOLUME_PRESETS.demo.inputTokens,
  outputTokens: VOLUME_PRESETS.demo.outputTokens,
  heavyModelId: "groq-gpt-oss-120b",
  orchestraMix: [
    { id: "or-north-mini-code-free", share: 0.22 },
    { id: "or-laguna-s-free", share: 0.12 },
    { id: "gemini-3.6-flash", share: 0.18 },
    { id: "or-nemotron-lightning-free", share: 0.15 },
    { id: "nvidia-glm-5.3-flash", share: 0.1 },
    { id: "gemini-3.5-flash", share: 0.08 },
    { id: "or-lfm-2.5-free", share: 0.05 },
    { id: "nvidia-llama-3.2-11b", share: 0.05 },
    { id: "groq-gpt-oss-20b", share: 0.05 },
  ] as Array<{ id: string; share: number }>,
};

export function usdToInr(usd: number): number {
  return usd * USD_TO_INR;
}

export function rateInrPer1k(usdPer1k: number): number {
  return usdToInr(usdPer1k);
}

export function fmtINR(amount: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

export function fmtINRCompact(amount: number): string {
  if (amount === 0) return "₹0";
  if (amount < 0.01) return fmtINR(amount, 4);
  return fmtINR(amount, 2);
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** Display helper for rate cells: Free badge vs ₹/1K + ₹/1M. */
export function formatRateCell(usdPer1k: number): { free: boolean; per1k: string; per1m: string } {
  if (usdPer1k === 0) {
    return { free: true, per1k: "₹0", per1m: "Free" };
  }
  const inr1k = rateInrPer1k(usdPer1k);
  const inr1m = inr1k * 1000;
  return {
    free: false,
    per1k: fmtINRCompact(inr1k),
    per1m: `${fmtINRCompact(inr1m)} / 1M`,
  };
}

function costUsdForVolume(
  inputUsdPer1k: number,
  outputUsdPer1k: number,
  inputTokens: number,
  outputTokens: number,
): number {
  return (inputTokens / 1000) * inputUsdPer1k + (outputTokens / 1000) * outputUsdPer1k;
}

export function findRate(id: string): ModelRate {
  const row = MODEL_RATES.find((m) => m.id === id);
  if (!row) throw new Error(`Unknown model rate id: ${id}`);
  return row;
}

export type ScenarioInput = {
  inputTokens: number;
  outputTokens: number;
  competitorId: string;
};

export type ScenarioResult = {
  inputTokens: number;
  outputTokens: number;
  fx: number;
  competitorId: string;
  competitorName: string;
  competitorInr: number;
  orchestraInr: number;
  savedInr: number;
  savedPct: number;
  /** @deprecated use competitorName */
  heavyName: string;
  /** @deprecated use competitorInr */
  heavyInr: number;
};

export function computeScenario(input: Partial<ScenarioInput> = {}): ScenarioResult {
  const inputTokens = input.inputTokens ?? SCENARIO.inputTokens;
  const outputTokens = input.outputTokens ?? SCENARIO.outputTokens;
  const competitorId = input.competitorId ?? SCENARIO.heavyModelId;

  const competitor = findRate(competitorId);
  const competitorUsd = costUsdForVolume(
    competitor.inputUsdPer1k,
    competitor.outputUsdPer1k,
    inputTokens,
    outputTokens,
  );

  let orchestraUsd = 0;
  for (const slice of SCENARIO.orchestraMix) {
    const m = findRate(slice.id);
    orchestraUsd += costUsdForVolume(
      m.inputUsdPer1k,
      m.outputUsdPer1k,
      inputTokens * slice.share,
      outputTokens * slice.share,
    );
  }

  const competitorInr = usdToInr(competitorUsd);
  const orchestraInr = usdToInr(orchestraUsd);
  const savedInr = competitorInr - orchestraInr;
  const savedPct = competitorInr > 0 ? (savedInr / competitorInr) * 100 : orchestraInr === 0 ? 0 : -100;

  return {
    inputTokens,
    outputTokens,
    fx: USD_TO_INR,
    competitorId,
    competitorName: competitor.displayName,
    competitorInr,
    orchestraInr,
    savedInr,
    savedPct,
    heavyName: competitor.displayName,
    heavyInr: competitorInr,
  };
}

/** Default demo scenario (Demo preset vs GPT-OSS 120B). */
export function computeMonthlyScenario(): ScenarioResult {
  return computeScenario();
}

export function modelRowsInr() {
  return MODEL_RATES.map((m) => {
    const input = formatRateCell(m.inputUsdPer1k);
    const output = formatRateCell(m.outputUsdPer1k);
    return {
      ...m,
      inputInrPer1k: rateInrPer1k(m.inputUsdPer1k),
      outputInrPer1k: rateInrPer1k(m.outputUsdPer1k),
      free: input.free && output.free,
      inputDisplay: input,
      outputDisplay: output,
    };
  });
}

/** Map specialty home labels to a primary catalog model id for task detail strip. */
export const TASK_HOME_MODEL_ID: Record<string, string> = {
  qa: "gemini-3.6-flash",
  code: "or-north-mini-code-free",
  debug: "or-north-mini-code-free",
  math: "nvidia-glm-5.3-flash",
  reasoning: "groq-gpt-oss-120b",
  summarization: "gemini-3.6-flash",
  creative: "gemini-3.5-flash",
  translation: "groq-qwen3-27b",
  extraction: "or-laguna-s-free",
  analysis: "or-nemotron-lightning-free",
  chat: "or-lfm-2.5-free",
  vision: "nvidia-llama-3.2-11b",
};
