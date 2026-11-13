export const API_BASE = import.meta.env.VITE_API_URL || "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export type Metrics = {
  requests: number;
  total_cost: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  avg_quality: number;
  success_rate: number;
  fallback_rate: number;
};

export type Overview = {
  routed: Metrics;
  baseline: Metrics;
  cost_savings_vs_baseline: number | null;
};

export type AttemptTrace = {
  index: number;
  model: string;
  provider: string;
  outcome: "success" | "error" | "low_confidence";
  reason: string | null;
  latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  est_cost: number;
  part_id?: string | null;
};

export type ScoreBreakdown = {
  id: string;
  provider: string;
  display_name: string;
  strength: number;
  cost_norm: number;
  latency_norm: number;
  score: number;
  eligible: boolean;
  reject_reason: string | null;
};

export type PromptPart = {
  id: string;
  text: string;
  task_type: string;
  rationale: string;
};

export type PartOutput = {
  part_id: string;
  task_type: string;
  text: string;
  model: string;
  provider: string;
  success: boolean;
  tokens_in: number;
  tokens_out: number;
  est_cost: number;
  latency_ms: number;
  attempts: AttemptTrace[];
  ranked: string[];
  scoreboard: ScoreBreakdown[];
  error: string | null;
};

export type Policy = "orchestra" | "routed" | "baseline";

export type CompleteResponse = {
  output: string;
  task_type: string;
  model: string;
  provider: string;
  policy: string;
  tokens_in: number;
  tokens_out: number;
  est_cost: number;
  latency_ms: number;
  success: boolean;
  fallback_used: boolean;
  fallback_from: string | null;
  quality_score: number | null;
  quality_label?: string;
  ranked: string[];
  attempts: AttemptTrace[];
  scoreboard: ScoreBreakdown[];
  parts?: PromptPart[];
  part_outputs?: PartOutput[];
  synthesis_method?: "stitch" | "none";
};

export type StreamEventName =
  | "classified"
  | "ranked"
  | "attempt_start"
  | "attempt_end"
  | "decomposed"
  | "part_ranked"
  | "part_attempt_start"
  | "part_attempt_end"
  | "part_done"
  | "synthesized"
  | "quality"
  | "final";

export type StreamEvent = {
  event: StreamEventName | string;
  data: Record<string, unknown>;
};

export const api = {
  overview: () => req<Overview>("/v1/stats/overview"),
  byModel: () => req<Array<Record<string, string | number>>>("/v1/stats/by-model"),
  byTask: () => req<Array<Record<string, string | number>>>("/v1/stats/by-task"),
  requests: () => req<Array<Record<string, unknown>>>("/v1/requests?limit=80"),
  models: () =>
    req<{
      baseline_model: string;
      weights: Record<string, number>;
      models: Array<Record<string, unknown>>;
      quality_label?: string;
    }>("/v1/models"),
  latestEval: () => req<Overview & { id: string | null; prompt_count?: number }>("/v1/eval/latest"),
  runEval: (limit?: number) =>
    req<Overview & { id: string; prompt_count: number }>("/v1/eval/run", {
      method: "POST",
      body: JSON.stringify({ limit: limit ?? null }),
    }),
  complete: (prompt: string, policy: Policy) =>
    req<CompleteResponse>("/v1/complete", {
      method: "POST",
      body: JSON.stringify({ prompt, policy }),
    }),
  /**
   * Consume NDJSON stage events from /v1/complete/stream.
   * Falls back to non-stream complete + synthetic events if streaming fails.
   */
  async completeStream(
    prompt: string,
    policy: Policy,
    onEvent: (ev: StreamEvent) => void,
    opts?: { replayDelayMs?: number },
  ): Promise<CompleteResponse> {
    const delay = async (ms: number) => {
      if (ms > 0) await new Promise((r) => setTimeout(r, ms));
    };
    try {
      const res = await fetch(`${API_BASE}/v1/complete/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, policy }),
      });
      if (!res.ok || !res.body) {
        throw new Error((await res.text()) || res.statusText);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let final: CompleteResponse | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parsed = JSON.parse(trimmed) as StreamEvent;
          onEvent(parsed);
          if (parsed.event === "final") {
            final = parsed.data as unknown as CompleteResponse;
          }
        }
      }
      if (buffer.trim()) {
        const parsed = JSON.parse(buffer.trim()) as StreamEvent;
        onEvent(parsed);
        if (parsed.event === "final") {
          final = parsed.data as unknown as CompleteResponse;
        }
      }
      if (!final) throw new Error("stream ended without final event");
      return final;
    } catch {
      const beat = opts?.replayDelayMs ?? 320;
      const result = await api.complete(prompt, policy);
      const events: StreamEvent[] = [];
      if (policy === "orchestra" && (result.parts?.length || 0) > 0) {
        events.push({
          event: "decomposed",
          data: { parts: result.parts || [], count: result.parts?.length || 0 },
        });
        for (const partOut of result.part_outputs || []) {
          events.push({
            event: "part_ranked",
            data: {
              part_id: partOut.part_id,
              task_type: partOut.task_type,
              candidates: partOut.scoreboard || [],
            },
          });
          for (const attempt of partOut.attempts || []) {
            events.push({
              event: "part_attempt_start",
              data: {
                part_id: partOut.part_id,
                index: attempt.index,
                model: attempt.model,
                provider: attempt.provider,
              },
            });
            events.push({
              event: "part_attempt_end",
              data: { ...attempt, part_id: partOut.part_id } as unknown as Record<string, unknown>,
            });
          }
          events.push({
            event: "part_done",
            data: partOut as unknown as Record<string, unknown>,
          });
        }
        events.push({
          event: "synthesized",
          data: {
            synthesis_method: result.synthesis_method || "stitch",
            output_preview: (result.output || "").slice(0, 280),
            part_count: result.parts?.length || 0,
          },
        });
      } else {
        events.push({ event: "classified", data: { task_type: result.task_type, hint: null } });
        events.push({
          event: "ranked",
          data: { task_type: result.task_type, candidates: result.scoreboard || [] },
        });
        for (const attempt of result.attempts || []) {
          events.push({
            event: "attempt_start",
            data: { index: attempt.index, model: attempt.model, provider: attempt.provider },
          });
          events.push({ event: "attempt_end", data: attempt as unknown as Record<string, unknown> });
        }
      }
      events.push({
        event: "quality",
        data: {
          quality_score: result.quality_score,
          quality_label: result.quality_label || "heuristic quality proxy",
          success: result.success,
        },
      });
      events.push({ event: "final", data: result as unknown as Record<string, unknown> });
      for (const ev of events) {
        onEvent(ev);
        await delay(beat);
      }
      return result;
    }
  },
};
