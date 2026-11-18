/** Illustrative demo economics from models.yaml × fixed FX — not live billing. */

export const USD_TO_INR = 83;

export type ModelRate = {
  id: string;
  displayName: string;
  provider: string;
  inputUsdPer1k: number;
  outputUsdPer1k: number;
};

/** Mirrored from backend/config/models.yaml catalog rates (free-only). */
export const MODEL_RATES: ModelRate[] = [
  { id: "cf-gpt-oss-120b", displayName: "GPT-OSS 120B (Cloudflare)", provider: "cloudflare", inputUsdPer1k: 0.01, outputUsdPer1k: 0.05 },
  { id: "cf-gpt-oss-20b", displayName: "GPT-OSS 20B (Cloudflare)", provider: "cloudflare", inputUsdPer1k: 0.0001, outputUsdPer1k: 0.0005 },
  { id: "cf-llama-3.3-70b", displayName: "Llama 3.3 70B (Cloudflare)", provider: "cloudflare", inputUsdPer1k: 0.00029, outputUsdPer1k: 0.0022 },
  { id: "cf-llama-3.1-8b", displayName: "Llama 3.1 8B (Cloudflare)", provider: "cloudflare", inputUsdPer1k: 0.00005, outputUsdPer1k: 0.0002 },
  { id: "cf-qwen-coder-32b", displayName: "Qwen2.5 Coder 32B (Cloudflare)", provider: "cloudflare", inputUsdPer1k: 0.0002, outputUsdPer1k: 0.0008 },
  { id: "cf-kimi-code", displayName: "Kimi K2.7 Code (Cloudflare)", provider: "cloudflare", inputUsdPer1k: 0.0002, outputUsdPer1k: 0.0008 },
  { id: "cf-deepseek-r1", displayName: "DeepSeek R1 Distill Qwen 32B (Cloudflare)", provider: "cloudflare", inputUsdPer1k: 0.0002, outputUsdPer1k: 0.0008 },
  { id: "cf-qwq-32b", displayName: "QwQ 32B (Cloudflare)", provider: "cloudflare", inputUsdPer1k: 0.0002, outputUsdPer1k: 0.0008 },
  { id: "cf-qwen3.8-27b", displayName: "Qwen 3.8 27B (Cloudflare)", provider: "cloudflare", inputUsdPer1k: 0.0001, outputUsdPer1k: 0.0004 },
  { id: "cf-glm-5.3-flash", displayName: "GLM 5.3 Flash (Cloudflare)", provider: "cloudflare", inputUsdPer1k: 0.0001, outputUsdPer1k: 0.0004 },
  { id: "cf-mistral-small", displayName: "Mistral Small 3.1 24B (Cloudflare)", provider: "cloudflare", inputUsdPer1k: 0.00015, outputUsdPer1k: 0.0006 },
  { id: "cf-llama-vision", displayName: "Llama 3.2 11B Vision (Cloudflare)", provider: "cloudflare", inputUsdPer1k: 0.0002, outputUsdPer1k: 0.0008 },
  { id: "groq-gpt-oss-20b", displayName: "GPT-OSS 20B (Groq)", provider: "groq", inputUsdPer1k: 0.0001, outputUsdPer1k: 0.0005 },
  { id: "groq-gpt-oss-120b", displayName: "GPT-OSS 120B (Groq)", provider: "groq", inputUsdPer1k: 0.00015, outputUsdPer1k: 0.0006 },
  { id: "groq-qwen3-27b", displayName: "Qwen 3.8 27B (Groq)", provider: "groq", inputUsdPer1k: 0.0001, outputUsdPer1k: 0.0004 },
  { id: "gemini-3.5-flash-lite", displayName: "Gemini 3.5 Flash Lite", provider: "gemini", inputUsdPer1k: 0.00025, outputUsdPer1k: 0.0015 },
  { id: "or-nemotron-lightning-free", displayName: "Nemotron 3.5 Lightning (OpenRouter free)", provider: "openrouter", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "or-auto-free", displayName: "OpenRouter Free Router", provider: "openrouter", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "or-north-mini-code-free", displayName: "North Mini Code (OpenRouter free)", provider: "openrouter", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "ca-gemini-3-8-flash", displayName: "Gemini 3.8 Flash (CoArena)", provider: "coarena", inputUsdPer1k: 0.00075, outputUsdPer1k: 0.00375 },
  { id: "ca-gpt-6-luna", displayName: "GPT-6 Luna (CoArena)", provider: "coarena", inputUsdPer1k: 0.0001, outputUsdPer1k: 0.0005 },
  { id: "ca-deepseek-v4-1-flash", displayName: "DeepSeek V4.1 Flash (CoArena)", provider: "coarena", inputUsdPer1k: 0.00014, outputUsdPer1k: 0.00028 },
  { id: "co-command-a-plus", displayName: "Command A+ (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-command-a", displayName: "Command A (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-command-a-reasoning", displayName: "Command A Reasoning (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-command-a-translate", displayName: "Command A Translate (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-command-a-vision", displayName: "Command A Vision (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-command-r7b", displayName: "Command R7B (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-command-r7b-arabic", displayName: "Command R7B Arabic (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-command-r", displayName: "Command R (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-command-r-plus", displayName: "Command R+ (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-north-mini-code", displayName: "North Mini Code (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-north-small-translate", displayName: "North Small Translate (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-aya-expanse-32b", displayName: "Aya Expanse 32B (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-aya-vision-32b", displayName: "Aya Vision 32B (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-tiny-aya-earth", displayName: "Tiny Aya Earth (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-tiny-aya-fire", displayName: "Tiny Aya Fire (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-tiny-aya-global", displayName: "Tiny Aya Global (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
  { id: "co-tiny-aya-water", displayName: "Tiny Aya Water (Cohere)", provider: "cohere", inputUsdPer1k: 0.0, outputUsdPer1k: 0.0 },
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
  heavyModelId: "cf-gpt-oss-120b",
  orchestraMix: [
    { id: "cf-qwen-coder-32b", share: 0.18 },
    { id: "cf-llama-3.3-70b", share: 0.16 },
    { id: "cf-deepseek-r1", share: 0.12 },
    { id: "cf-glm-5.3-flash", share: 0.1 },
    { id: "cf-mistral-small", share: 0.1 },
    { id: "cf-qwen3.8-27b", share: 0.08 },
    { id: "cf-llama-3.1-8b", share: 0.08 },
    { id: "or-north-mini-code-free", share: 0.06 },
    { id: "ca-gemini-3-8-flash", share: 0.06 },
    { id: "gemini-3.5-flash-lite", share: 0.06 },
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
  qa: "cf-llama-3.3-70b",
  code: "cf-qwen-coder-32b",
  debug: "cf-qwen-coder-32b",
  math: "cf-qwen3.8-27b",
  reasoning: "cf-deepseek-r1",
  summarization: "gemini-3.5-flash-lite",
  creative: "ca-gpt-6-luna",
  translation: "co-command-a-translate",
  extraction: "cf-mistral-small",
  analysis: "cf-mistral-small",
  chat: "cf-llama-3.1-8b",
  vision: "co-command-a-vision",
};
