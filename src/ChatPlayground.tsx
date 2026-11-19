import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  api,
  type AttemptTrace,
  type ChatTurn,
  type CompleteResponse,
  type PartOutput,
  type Policy,
  type PromptPart,
  type ScoreBreakdown,
  type StreamEvent,
} from "./api";
import {
  createConversation,
  loadChatStore,
  saveChatStore,
  upsertActiveConversation,
  type ChatStore,
  type Conversation,
  type StoredChatMessage,
} from "./chatSession";
import { fmtINR, usdToInr } from "./landingEconomics";
import { MarkdownBody } from "./markdown";
import { OrchestraAnswer } from "./OrchestraAnswer";

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

type ChatMessage = StoredChatMessage;

type RouteState = {
  stage: Stage;
  policy: Policy | null;
  taskType: string | null;
  scoreboard: ScoreBreakdown[];
  attempts: AttemptTrace[];
  activeModel: string | null;
  activeProvider: string | null;
  diversityApplied: boolean;
  qualityScore: number | null;
  parts: PromptPart[];
  partOutputs: PartOutput[];
  activePartId: string | null;
  synthPreview: string | null;
  result: CompleteResponse | null;
};

const SINGLE_STAGES: Stage[] = ["intake", "classify", "scoreboard", "attempt", "quality", "verdict"];
const ORCHESTRA_STAGES: Stage[] = [
  "intake",
  "decompose",
  "specialists",
  "synthesize",
  "quality",
  "verdict",
];

const STAGE_SHORT: Record<Stage, string> = {
  idle: "…",
  intake: "In",
  classify: "Class",
  scoreboard: "Rank",
  attempt: "Call",
  decompose: "Split",
  specialists: "Run",
  synthesize: "Stitch",
  quality: "QA",
  verdict: "Done",
};

const STARTERS = [
  {
    label: "Full orchestra",
    text: [
      "Hey — need a full ops brief in one reply.",
      "",
      "1) What is HTTP/2 in one plain sentence?",
      "2) Write a Python function `median(nums: list[float]) -> float` that returns the median (handle even length).",
      "3) Fix this bug and explain the root cause: `def safe_div(a,b): return a/b` crashes when b is 0.",
      "4) Which is larger, 9.11 or 9.9? Show the comparison step by step.",
      "5) Think step by step: why does routing mixed prompts to specialists usually beat one heavy model on cost?",
      "6) TL;DR the previous reasoning point in ≤20 words.",
      "7) Write a four-line haiku about load balancers.",
      "8) Translate to Hindi: \"Specialist routing cuts spend without cutting quality.\"",
      "9) Extract as JSON with keys name, role, city from: \"Asha Patel is a backend engineer in Bengaluru.\"",
      "10) Analyze pros and cons of SQLite vs Postgres for a student capstone API (3 bullets each).",
      "11) Describe how you would read a dashboard screenshot that shows latency spikes at 14:00 — what visual cues matter?",
      "12) End with one friendly closing sentence as if chatting with a teammate.",
    ].join("\n"),
  },
  {
    label: "Code + math",
    text: "Write a Python function that reverses a string without slicing.\n\nWhich number is larger, 9.11 or 9.8? Explain briefly.",
  },
  {
    label: "Translate + summarize",
    text: "Translate this to Hindi: \"Routing saves money when prompts mix skills.\"\n\nThen summarize the idea in one sentence.",
  },
  {
    label: "Debug + explain",
    text: "Fix this: `def add(a,b): return a-b` — it should add.\n\nThen explain why the bug was easy to miss.",
  },
];

const MODE_OPTIONS: Array<{ id: Policy; label: string; hint: string }> = [
  { id: "orchestra", label: "Orchestrator", hint: "Split → specialists → stitch" },
  { id: "routed", label: "Single route", hint: "One ranked model" },
  { id: "baseline", label: "Baseline", hint: "Locked baseline model" },
];

function moneyINR(usd: number, digits = 2) {
  const inr = usdToInr(Number(usd) || 0);
  if (inr === 0) return "₹0";
  if (inr < 0.01) return fmtINR(inr, Math.max(digits, 4));
  return fmtINR(inr, digits);
}

function fmt(n: number, d = 3) {
  return n.toFixed(d);
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function modelDisplayName(route: RouteState, modelId?: string | null): string {
  const id = modelId || route.activeModel;
  if (!id) return "";
  const row = route.scoreboard.find((s) => s.id === id);
  if (row?.display_name) return row.display_name;
  const fromPart = route.partOutputs.find((p) => p.model === id);
  if (fromPart) return fromPart.model;
  return id;
}

function whyWorking(route: RouteState, policy: Policy): string {
  const mode = route.policy || policy;
  const activePart = route.parts.find((p) => p.id === route.activePartId);
  const task = activePart?.task_type || route.taskType || "this task";
  const modelId = route.activeModel;
  const row = modelId ? route.scoreboard.find((s) => s.id === modelId) : undefined;
  const eligibleTop = route.scoreboard.find((s) => s.eligible);
  const strength = row?.strength ?? eligibleTop?.strength;

  const bits: string[] = [];
  if (mode === "baseline") {
    bits.push(`Locked baseline model for ${task}.`);
  } else if (mode === "routed" || mode === "orchestra") {
    if (strength != null) {
      bits.push(`Strongest ${task} fit (strength ${fmt(strength, 2)}) among eligible models.`);
    } else {
      bits.push(`Top-ranked for ${task} under ${mode}.`);
    }
  }
  if (route.diversityApplied) {
    bits.push("Also preferred a different provider so one stack doesn’t win every part.");
  }
  if (activePart?.rationale?.trim()) {
    const cue = activePart.rationale.trim();
    bits.push(`Cue: ${cue.length > 90 ? `${cue.slice(0, 87)}…` : cue}`);
  }
  return bits.join(" ") || "Routing in progress.";
}

function progressFromRoute(
  route: RouteState,
  policy: Policy,
): { percent: number; label: string } {
  const effectivePolicy = route.policy || policy;
  const isOrchestra = effectivePolicy === "orchestra";
  const stages = isOrchestra ? ORCHESTRA_STAGES : SINGLE_STAGES;
  const stage = route.stage === "idle" ? "intake" : route.stage;
  const stageIndex = Math.max(0, stages.indexOf(stage));
  const stageShare = stageIndex / Math.max(1, stages.length - 1);
  const display = modelDisplayName(route);

  if (route.stage === "verdict" || route.result) {
    return { percent: 100, label: "Done" };
  }

  let percent: number;
  if (isOrchestra) {
    const totalParts = route.parts.length;
    const doneParts = route.partOutputs.length;
    if (totalParts === 0) {
      percent = Math.round(10 + 15 * stageShare);
    } else if (stage === "specialists" || stage === "decompose") {
      percent = Math.round(25 + 65 * (doneParts / totalParts));
    } else if (stage === "synthesize") {
      percent = 92;
    } else if (stage === "quality") {
      percent = 96;
    } else {
      percent = Math.round(25 + 65 * (doneParts / Math.max(totalParts, 1)));
    }
  } else {
    percent = Math.round(100 * stageShare);
  }

  if (route.stage !== "idle") {
    percent = Math.max(5, Math.min(95, percent));
  }

  const activePart = route.parts.find((p) => p.id === route.activePartId);
  let label = "Working…";
  if (stage === "intake") label = "Taking in prompt…";
  else if (stage === "decompose") label = "Decomposing…";
  else if (stage === "specialists") {
    const done = route.partOutputs.length;
    const total = route.parts.length || "?";
    const task = activePart?.task_type || route.taskType || "specialists";
    label = display
      ? `Running specialists ${done}/${total} · ${task} · ${display}`
      : `Running specialists ${done}/${total} · ${task}`;
  } else if (stage === "synthesize") label = "Stitching…";
  else if (stage === "quality") label = "Almost done…";
  else if (stage === "classify") label = "Classifying…";
  else if (stage === "scoreboard") label = "Ranking models…";
  else if (stage === "attempt") {
    label = display ? `Calling ${display}…` : "Calling model…";
  }

  return { percent, label };
}

function ThinkingIndicator({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`chat__thinking${compact ? " chat__thinking--compact" : ""}`} aria-live="polite">
      <svg
        className="chat__thinking-icon"
        viewBox="0 0 24 24"
        width={compact ? 16 : 20}
        height={compact ? 16 : 20}
        aria-hidden="true"
        focusable="false"
      >
        <circle className="chat__thinking-trail chat__thinking-trail--a" cx="5.2" cy="19.2" r="1.15" />
        <circle className="chat__thinking-trail chat__thinking-trail--b" cx="7.6" cy="16.4" r="1.55" />
        <path
          className="chat__thinking-cloud"
          d="M9.2 15.6c-1.7 0-3.1-1.2-3.1-2.9 0-1.2.7-2.2 1.7-2.7.2-2.1 2-3.7 4.2-3.7 1.8 0 3.3 1.1 3.9 2.6.4-.2.9-.3 1.4-.3 1.7 0 3.1 1.3 3.1 3 0 1.6-1.3 2.9-2.9 3H9.2z"
        />
        <circle className="chat__thinking-spark" cx="13.2" cy="11.4" r="1.1" />
      </svg>
      <span className="chat__thinking-label">Thinking</span>
      <span className="chat__thinking-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

function ChatNowWorking({
  route,
  policy,
  withThinking = true,
}: {
  route: RouteState;
  policy: Policy;
  withThinking?: boolean;
}) {
  const name = modelDisplayName(route);
  if (!name || route.stage === "idle" || route.stage === "verdict" || route.result) {
    return null;
  }
  if (
    route.stage !== "specialists" &&
    route.stage !== "attempt" &&
    route.stage !== "scoreboard" &&
    route.stage !== "decompose"
  ) {
    return null;
  }
  return (
    <div className="chat__now">
      {withThinking ? (
        <div className="chat__now-head">
          <ThinkingIndicator compact />
        </div>
      ) : null}
      <p className="chat__now-model">
        <strong>Working:</strong> {name}
        {route.activeProvider ? <span className="chat__now-provider"> · {route.activeProvider}</span> : null}
      </p>
      <p className="chat__now-why">{whyWorking(route, policy)}</p>
    </div>
  );
}

function ChatProgress({
  percent,
  label,
  route,
  policy,
  showThinking = false,
}: {
  percent: number;
  label: string;
  route?: RouteState;
  policy?: Policy;
  showThinking?: boolean;
}) {
  return (
    <div className="chat__progress-wrap">
      {showThinking ? <ThinkingIndicator /> : null}
      <div
        className="chat__progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
      >
        <div className="chat__progress-track" aria-hidden="true">
          <div className="chat__progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="chat__progress-label">
          {label} · {percent}%
        </p>
      </div>
      {route && policy ? (
        <ChatNowWorking route={route} policy={policy} withThinking={!showThinking} />
      ) : null}
    </div>
  );
}

const emptyRoute = (): RouteState => ({
  stage: "idle",
  policy: null,
  taskType: null,
  scoreboard: [],
  attempts: [],
  activeModel: null,
  activeProvider: null,
  diversityApplied: false,
  qualityScore: null,
  parts: [],
  partOutputs: [],
  activePartId: null,
  synthPreview: null,
  result: null,
});

function applyStreamEvent(prev: RouteState, ev: StreamEvent): RouteState {
  const next = { ...prev };
  if (ev.event === "decomposed") {
    next.stage = "decompose";
    next.parts = (ev.data.parts as PromptPart[]) || [];
    next.taskType = next.parts.map((p) => p.task_type).join("+") || null;
  } else if (ev.event === "part_ranked") {
    next.stage = "specialists";
    next.activePartId = String(ev.data.part_id || "");
    next.scoreboard = (ev.data.candidates as ScoreBreakdown[]) || [];
    next.activeModel = String(ev.data.preferred_model || ev.data.model || prev.activeModel || "");
    next.activeProvider = String(ev.data.preferred_provider || ev.data.provider || prev.activeProvider || "");
    next.diversityApplied = Boolean(ev.data.diversity_applied);
  } else if (ev.event === "part_attempt_start") {
    next.stage = "specialists";
    next.activePartId = String(ev.data.part_id || prev.activePartId || "");
    next.activeModel = String(ev.data.model || prev.activeModel || "");
    next.activeProvider = String(ev.data.provider || prev.activeProvider || "");
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
    next.activeProvider = attempt.provider || prev.activeProvider;
    next.activePartId = attempt.part_id || prev.activePartId;
  } else if (ev.event === "part_done") {
    next.stage = "specialists";
    const partOut = ev.data as unknown as PartOutput;
    next.partOutputs = [...prev.partOutputs.filter((p) => p.part_id !== partOut.part_id), partOut];
    next.activePartId = partOut.part_id;
    next.activeModel = partOut.model;
    next.activeProvider = partOut.provider || prev.activeProvider;
  } else if (ev.event === "synthesized") {
    next.stage = "synthesize";
    next.synthPreview = String(ev.data.output_preview || "");
  } else if (ev.event === "classified") {
    next.stage = "classify";
    next.taskType = String(ev.data.task_type || "");
  } else if (ev.event === "ranked") {
    next.stage = "scoreboard";
    next.scoreboard = (ev.data.candidates as ScoreBreakdown[]) || [];
    const top = next.scoreboard.find((s) => s.eligible);
    if (top) {
      next.activeModel = top.id;
      next.activeProvider = top.provider;
    }
  } else if (ev.event === "attempt_start") {
    next.stage = "attempt";
    next.activeModel = String(ev.data.model || "");
    next.activeProvider = String(ev.data.provider || prev.activeProvider || "");
  } else if (ev.event === "attempt_end") {
    next.stage = "attempt";
    const attempt = ev.data as unknown as AttemptTrace;
    next.attempts = [...prev.attempts.filter((a) => a.index !== attempt.index), attempt].sort(
      (a, b) => a.index - b.index,
    );
    next.activeModel = attempt.model;
    next.activeProvider = attempt.provider || prev.activeProvider;
  } else if (ev.event === "quality") {
    next.stage = "quality";
    next.qualityScore = (ev.data.quality_score as number | null) ?? null;
  } else if (ev.event === "final") {
    next.stage = "verdict";
    next.result = ev.data as unknown as CompleteResponse;
    next.activeModel = String((ev.data as CompleteResponse).model || "");
    next.activeProvider = String((ev.data as CompleteResponse).provider || "");
    const final = ev.data as unknown as CompleteResponse;
    if (final.parts?.length) next.parts = final.parts;
    if (final.part_outputs?.length) next.partOutputs = final.part_outputs;
  }
  return next;
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === "AbortError") ||
    (e instanceof Error && e.name === "AbortError")
  );
}

function formatChatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ChatPlayground({ onRefresh }: { onRefresh?: () => void }) {
  const initial = useMemo(() => loadChatStore(), []);
  const activeInitial =
    initial.conversations.find((c) => c.id === initial.activeId) || initial.conversations[0];

  const [store, setStore] = useState<ChatStore>(initial);
  const [messages, setMessages] = useState<ChatMessage[]>(activeInitial?.messages ?? []);
  const [draft, setDraft] = useState("");
  const [policy, setPolicy] = useState<Policy>(activeInitial?.policy ?? "orchestra");
  const [modeOpen, setModeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteState>(emptyRoute);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSpecialists, setShowSpecialists] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef(store.activeId);

  const stageList = policy === "orchestra" || route.policy === "orchestra" ? ORCHESTRA_STAGES : SINGLE_STAGES;
  const stageIndex = Math.max(0, stageList.indexOf(route.stage === "idle" ? "intake" : route.stage));
  const eligibleBoard = route.scoreboard.filter((s) => s.eligible);
  const topScore = eligibleBoard[0]?.score;
  const modeLabel = MODE_OPTIONS.find((m) => m.id === policy)?.label ?? "Orchestrator";
  const progress = useMemo(() => progressFromRoute(route, policy), [route, policy]);

  const conversations = useMemo(
    () =>
      [...store.conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [store.conversations],
  );

  useEffect(() => {
    activeIdRef.current = store.activeId;
  }, [store.activeId]);

  useEffect(() => {
    setStore((prev) => {
      const next = upsertActiveConversation(prev, { messages, policy });
      saveChatStore(next);
      return next;
    });
  }, [messages, policy]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy, route.stage, progress.percent]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(160, Math.max(48, ta.scrollHeight))}px`;
  }, [draft]);

  useEffect(() => {
    if (!modeOpen && !historyOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (modeOpen && t?.closest(".chat__mode")) return;
      if (historyOpen && t?.closest(".chat__title-menu")) return;
      setModeOpen(false);
      setHistoryOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [modeOpen, historyOpen]);

  const historyTurns: ChatTurn[] = useMemo(
    () =>
      messages
        .filter((m) => m.status !== "error" && m.status !== "streaming")
        .map((m) => ({ role: m.role, content: m.content })),
    [messages],
  );

  function abortInFlight() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  function applyConversation(conv: Conversation) {
    setMessages(conv.messages);
    setPolicy(conv.policy);
    setDraft("");
    setError(null);
    setRoute(emptyRoute());
    setDrawerOpen(false);
    setShowSpecialists(false);
    setBusy(false);
  }

  function newChat() {
    abortInFlight();
    const fresh = createConversation(policy);
    const synced = upsertActiveConversation(store, { messages, policy });
    const deduped: ChatStore = {
      activeId: fresh.id,
      conversations: [
        fresh,
        ...synced.conversations.filter((c) => c.messages.length > 0 && c.id !== fresh.id),
      ],
    };
    saveChatStore(deduped);
    setStore(deduped);
    applyConversation(fresh);
    textareaRef.current?.focus();
  }

  function switchConversation(id: string) {
    if (id === activeIdRef.current) return;
    abortInFlight();
    const synced = upsertActiveConversation(store, { messages, policy });
    const target = synced.conversations.find((c) => c.id === id);
    if (!target) return;
    const next: ChatStore = { ...synced, activeId: id };
    saveChatStore(next);
    setStore(next);
    applyConversation(target);
  }

  async function send(text?: string) {
    const content = (text ?? draft).trim();
    if (!content || busy) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content };
    const assistantId = uid();
    const pending: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      status: "streaming",
    };

    const prior = historyTurns;
    const outbound: ChatTurn[] = [...prior, { role: "user", content }];
    const controller = new AbortController();
    abortRef.current = controller;
    const sendConvId = activeIdRef.current;
    const stillHere = () => activeIdRef.current === sendConvId;

    setMessages((prev) => [...prev, userMsg, pending]);
    setDraft("");
    setBusy(true);
    setError(null);
    setDrawerOpen(true);
    setShowSpecialists(false);
    setRoute({ ...emptyRoute(), stage: "intake", policy });

    try {
      const result = await api.completeStream(
        content,
        policy,
        (ev) => {
          if (!stillHere()) return;
          setRoute((prev) => applyStreamEvent(prev, ev));
        },
        { messages: outbound, replayDelayMs: 280, signal: controller.signal },
      );
      if (!stillHere()) return;
      setRoute((prev) => ({
        ...prev,
        stage: "verdict",
        result,
        parts: result.parts || prev.parts,
        partOutputs: result.part_outputs || prev.partOutputs,
      }));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: result.success
                  ? result.output || "No usable output."
                  : result.output || "Request failed. Check the routing panel for details.",
                meta: result,
                status: result.success ? "done" : "error",
              }
            : m,
        ),
      );
      onRefresh?.();
    } catch (e) {
      if (!stillHere()) return;
      if (isAbortError(e)) {
        setRoute(emptyRoute());
        // Drop incomplete assistant bubble; keep the user turn.
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }
      const msg = e instanceof Error ? e.message : "Request failed";
      setError(msg);
      setRoute(emptyRoute());
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: msg, status: "error" }
            : m,
        ),
      );
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (stillHere()) setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const empty = messages.length === 0;
  const activeTitle =
    conversations.find((c) => c.id === store.activeId)?.title || "New chat";

  return (
    <div className={`chat${drawerOpen ? " chat--drawer-open" : ""}`}>
      <header className="chat__topbar">
        <div className="chat__title-menu">
          <button
            type="button"
            className="chat__title-btn"
            aria-expanded={historyOpen}
            aria-haspopup="listbox"
            onClick={() => setHistoryOpen((o) => !o)}
          >
            <span className="chat__title-text">{activeTitle}</span>
            <span className="chat__title-caret" aria-hidden="true">
              ▾
            </span>
          </button>
          {historyOpen && (
            <ul className="chat__history-menu" role="listbox" aria-label="Chat history">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={c.id === store.activeId ? "is-active" : undefined}
                    onClick={() => {
                      switchConversation(c.id);
                      setHistoryOpen(false);
                    }}
                  >
                    <span className="chat__history-title">{c.title || "New chat"}</span>
                    <span className="chat__history-meta">{formatChatTime(c.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="chat__topbar-actions">
          <button type="button" className="ghost" onClick={newChat}>
            New chat
          </button>
          <button
            type="button"
            className={`ghost${drawerOpen ? " active-toggle" : ""}`}
            onClick={() => setDrawerOpen((o) => !o)}
          >
            {drawerOpen ? "Hide routing" : "How it routed"}
          </button>
        </div>
      </header>

      <div className="chat__main">
        <div className="chat__thread" ref={threadRef} aria-live="polite">
          <div className="chat__column">
            {empty ? (
              <div className="chat__welcome">
                <h2>Ask Orchestrator</h2>
                <p>
                  Mixed prompts are split into specialty tasks, routed to the right models, then stitched
                  into one answer. Follow-ups keep this chat’s context.
                </p>
                <div className="chat__starters">
                  {STARTERS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      className="chat__starter"
                      disabled={busy}
                      onClick={() => void send(s.text)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <article
                  key={m.id}
                  className={`chat__bubble chat__bubble--${m.role}${m.status === "error" ? " chat__bubble--error" : ""}`}
                >
                  <header className="chat__bubble-head">
                    <span>{m.role === "user" ? "You" : "Orchestrator"}</span>
                    {m.meta && (
                      <span className="chat__bubble-meta">
                        {moneyINR(m.meta.est_cost)} · {m.meta.latency_ms} ms
                        {m.meta.policy === "orchestra" && m.meta.parts?.length
                          ? ` · ${m.meta.parts.length} parts`
                          : m.meta.model
                            ? ` · ${m.meta.model}`
                            : ""}
                      </span>
                    )}
                    {m.status === "streaming" && (
                      <span className="chat__bubble-meta">{progress.percent}%</span>
                    )}
                  </header>
                  <div className="chat__bubble-body">
                    {m.role === "assistant" && m.status === "streaming" && !m.content ? (
                      <ChatProgress
                        percent={progress.percent}
                        label={progress.label}
                        route={route}
                        policy={policy}
                        showThinking
                      />
                    ) : m.role === "assistant" &&
                      m.meta?.policy === "orchestra" &&
                      (m.meta.part_outputs?.length ?? 0) > 0 ? (
                      <OrchestraAnswer meta={m.meta} />
                    ) : m.role === "assistant" ? (
                      <MarkdownBody text={m.content} />
                    ) : (
                      <p className="chat__user-text">{m.content}</p>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        {error && (
          <p className="error chat__error" role="alert">
            {error}
          </p>
        )}

        <div className="chat__dock">
          <div className="chat__composer">
            <div className="chat__mode">
              <button
                type="button"
                className="ghost chat__mode-btn"
                aria-expanded={modeOpen}
                onClick={() => setModeOpen((o) => !o)}
                disabled={busy}
              >
                {modeLabel}
              </button>
              {modeOpen && (
                <ul className="chat__mode-menu" role="listbox">
                  {MODE_OPTIONS.map((opt) => (
                    <li key={opt.id}>
                      <button
                        type="button"
                        className={policy === opt.id ? "is-active" : undefined}
                        onClick={() => {
                          setPolicy(opt.id);
                          setModeOpen(false);
                        }}
                      >
                        <strong>{opt.label}</strong>
                        <span>{opt.hint}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <textarea
              ref={textareaRef}
              aria-label="Message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={empty ? "Ask Orchestrator…" : "Ask a follow-up…"}
              disabled={busy}
              rows={1}
            />
            <button
              type="button"
              className="solid chat__send"
              disabled={busy || !draft.trim()}
              onClick={() => void send()}
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
          <p className="chat__hint">Enter to send · Shift+Enter for a new line</p>
        </div>
      </div>

      <aside className={`chat__drawer${drawerOpen ? " is-open" : ""}`} aria-label="How it routed">
        <div className="chat__drawer-chrome">
          <div className="chat__drawer-head">
            <h2>How it routed</h2>
            <button type="button" className="ghost" onClick={() => setDrawerOpen(false)}>
              Close
            </button>
          </div>

          {!(route.stage === "idle" && !route.result) && (
            <>
              <div className="chat__stages" aria-live="polite">
                {stageList.map((s, i) => (
                  <span
                    key={s}
                    title={s}
                    className={`chat__stage${stageIndex >= i ? " lit" : ""}${route.stage === s ? " current" : ""}`}
                  >
                    {STAGE_SHORT[s] || s}
                  </span>
                ))}
              </div>
              {(busy || (route.stage !== "idle" && route.stage !== "verdict")) && (
                <div className="chat__drawer-progress">
                  <ChatProgress
                    percent={progress.percent}
                    label={progress.label}
                    route={route}
                    policy={policy}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="chat__drawer-body">
          {route.stage === "idle" && !route.result ? (
            <p className="muted chat__drawer-empty">
              Send a message to see decompose, specialists, and stitch here.
            </p>
          ) : (
            <>
              <dl className="chat__facts">
                <div>
                  <dt>Mode</dt>
                  <dd>{route.policy || policy}</dd>
                </div>
                {route.taskType && (
                  <div>
                    <dt>Tasks</dt>
                    <dd>{route.taskType}</dd>
                  </div>
                )}
                {!route.result && route.activeModel && (
                  <div>
                    <dt>Active</dt>
                    <dd>
                      {modelDisplayName(route)}
                      {route.activeProvider ? (
                        <span className="muted"> · {route.activeProvider}</span>
                      ) : null}
                    </dd>
                  </div>
                )}
                {route.result && (
                  <>
                    <div>
                      <dt>Cost</dt>
                      <dd>{moneyINR(route.result.est_cost)}</dd>
                    </div>
                    <div>
                      <dt>Latency</dt>
                      <dd>{route.result.latency_ms} ms</dd>
                    </div>
                    <div>
                      <dt>Quality</dt>
                      <dd>
                        {route.qualityScore == null && route.result.quality_score == null
                          ? "—"
                          : fmt(route.result.quality_score ?? route.qualityScore ?? 0)}
                      </dd>
                    </div>
                  </>
                )}
              </dl>

              {route.parts.length > 0 && (
                <section className="chat__drawer-section">
                  <h3>
                    Parts{" "}
                    <span className="chat__parts-count">
                      {route.partOutputs.length}/{route.parts.length} done
                    </span>
                  </h3>
                  <ul className="chat__part-list">
                    {route.parts.map((p) => {
                      const out = route.partOutputs.find((o) => o.part_id === p.id);
                      const isActive = route.activePartId === p.id && !route.result;
                      const done = Boolean(out);
                      const modelLabel = out
                        ? modelDisplayName(route, out.model)
                        : isActive
                          ? modelDisplayName(route)
                          : "…";
                      return (
                        <li
                          key={p.id}
                          className={`${isActive ? "is-active" : ""}${done ? " is-done" : ""}`.trim()}
                        >
                          <div className="chat__part-row">
                            <span className="task-pill">{p.task_type}</span>
                            <span className="chat__part-model">{modelLabel || "…"}</span>
                            {done ? <span className="chat__part-check" aria-hidden="true">✓</span> : null}
                          </div>
                          {(isActive || !done) && (
                            <p className="chat__part-snip">
                              {p.text.slice(0, isActive ? 120 : 72)}
                              {p.text.length > (isActive ? 120 : 72) ? "…" : ""}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {route.scoreboard.length > 0 && (
                <section className="chat__drawer-section">
                  <h3>Top models</h3>
                  <ul className="chat__rank-list">
                    {route.scoreboard
                      .filter((r) => r.eligible)
                      .slice(0, 5)
                      .map((row) => (
                        <li key={row.id} className={row.score === topScore ? "is-top" : undefined}>
                          <span>{row.display_name || row.id}</span>
                          <span className="mono">{fmt(row.score)}</span>
                        </li>
                      ))}
                  </ul>
                </section>
              )}

              {!!route.partOutputs.length && (
                <section className="chat__drawer-section">
                  <button
                    type="button"
                    className="ghost chat__expand"
                    onClick={() => setShowSpecialists((v) => !v)}
                  >
                    {showSpecialists ? "Hide specialist answers" : "Show specialist answers"}
                  </button>
                  {showSpecialists && (
                    <div className="chat__specialists">
                      {route.partOutputs.map((po) => (
                        <article key={po.part_id} className={!po.success ? "is-fail" : undefined}>
                          <header>
                            <span className="task-pill">{po.task_type}</span>
                            <span className="mono">{po.model}</span>
                          </header>
                          {po.success ? (
                            <MarkdownBody text={po.text} />
                          ) : (
                            <p className="muted">{po.error || "Failed"}</p>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {route.attempts.length > 0 && !route.partOutputs.length && (
                <section className="chat__drawer-section">
                  <h3>Attempts</h3>
                  <ul className="chat__rank-list">
                    {route.attempts.map((a) => (
                      <li key={`${a.index}-${a.model}`}>
                        <span className="mono">{a.model}</span>
                        <span>{a.outcome.replace("_", " ")}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
