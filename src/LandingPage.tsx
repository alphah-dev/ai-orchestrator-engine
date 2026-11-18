import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import SavingsDashboard from "./SavingsDashboard";
import {
  TASK_HOME_MODEL_ID,
  computeScenario,
  findRate,
  formatRateCell,
  fmtINR,
  modelRowsInr,
} from "./landingEconomics";
import "./landing.css";

const TASKS: Array<{ id: string; intent: string; home: string }> = [
  { id: "qa", intent: "What / who / define — general factual asks", home: "Llama 3.3 70B (CF)" },
  { id: "code", intent: "Write / implement functions and queries", home: "Qwen2.5 Coder 32B (CF)" },
  { id: "debug", intent: "Fix / traceback / bug / failing tests", home: "Qwen2.5 Coder · Kimi Code" },
  { id: "math", intent: "Calculate / compare magnitudes / equations", home: "Qwen 3.8 27B (CF)" },
  { id: "reasoning", intent: "Step-by-step prove / logic puzzles", home: "DeepSeek R1 (CF)" },
  { id: "summarization", intent: "Summarize / TL;DR / compress", home: "Gemini Flash Lite" },
  { id: "creative", intent: "Poem / haiku / story / fiction", home: "GPT-6 Luna (CoArena)" },
  { id: "translation", intent: "Translate / bilingual rewrite", home: "Command A Translate (Cohere)" },
  { id: "extraction", intent: "Extract JSON / tables / entities", home: "Mistral Small (CF)" },
  { id: "analysis", intent: "Compare / critique / pros & cons", home: "Mistral Small · GLM Flash" },
  { id: "chat", intent: "Casual hello / short friendly reply", home: "Llama 3.1 8B (CF)" },
  { id: "vision", intent: "Image / screenshot / describe photo", home: "Command A Vision (Cohere)" },
];

const PIPELINE = [
  {
    id: "intake",
    title: "Intake",
    body: "Take in the prompt and choose how to run it: Orchestrator, single route, or baseline.",
  },
  {
    id: "decompose",
    title: "Decompose",
    body: "Split the ask into specialty tasks. Specific cues win first — debug before code, vision before general QA.",
  },
  {
    id: "rank",
    title: "Rank specialists",
    body: "Score models on quality, cost, and speed. When quality is close, the cheaper option rises.",
  },
  {
    id: "call",
    title: "Call providers",
    body: "Send each task to Cloudflare Workers AI or Cohere first, then CoArena free, Groq, Gemini, or OpenRouter when scores are close or a call fails.",
  },
  {
    id: "stitch",
    title: "Stitch",
    body: "Merge the specialist answers into one clear response you can inspect step by step.",
  },
  {
    id: "quality",
    title: "Quality & verdict",
    body: "Label the run with a simple quality check and save it for Overview, Baseline, and request history.",
  },
] as const;

const POLICIES = [
  {
    id: "orchestra",
    title: "Orchestrator",
    body: "Default. Split the prompt, route each part to a specialist, return one stitched answer.",
  },
  {
    id: "routed",
    title: "Single route",
    body: "One model for the whole prompt. Try the best-ranked options in order if the first call fails.",
  },
  {
    id: "baseline",
    title: "Baseline",
    body: "Always use the configured baseline model. No fallbacks — for fair cost and quality comparisons.",
  },
] as const;

const PROVIDERS = [
  { name: "Cloudflare", role: "Primary free catalog — Llama, GPT-OSS, Qwen, DeepSeek R1, GLM, vision" },
  { name: "Cohere", role: "Free trial catalog — Command A family, North Mini Code, Aya, translate/vision" },
  { name: "CoArena", role: "Fallback free trio — Gemini 3.8 Flash, GPT-6 Luna, DeepSeek V4.1 Flash" },
  { name: "Groq", role: "Fallback — fast GPT-OSS and Qwen for chat, code, translation" },
  { name: "Gemini", role: "Fallback — Flash Lite for summaries, creative, and chat" },
  { name: "OpenRouter", role: "Fallback — free specialty models for code and analysis" },
] as const;

const WEIGHTS = [
  { display: "0.65", label: "quality strength", width: "65%" },
  { display: "0.20", label: "cost in INR", width: "20%" },
  { display: "0.15", label: "latency", width: "15%" },
] as const;

const NAV_SECTIONS = [
  { id: "pipeline", label: "Pipeline" },
  { id: "tasks", label: "Tasks" },
  { id: "economics", label: "INR economics" },
] as const;

const scenario = computeScenario();
const rateRows = modelRowsInr();

function useInView<T extends HTMLElement>(once = true) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  return { ref, visible };
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { ref, visible } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`landing__reveal${visible ? " is-visible" : ""}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

function PipelineStageVisual({ stageId }: { stageId: string }) {
  const labels: Record<string, string> = {
    intake: "Intaking prompt…",
    decompose: "Splitting into specialty tasks…",
    rank: "Ranking specialists…",
    call: "Calling providers…",
    stitch: "Stitching answers…",
    quality: "Checking quality…",
  };

  return (
    <div className={`landing__flow-stage is-${stageId}`} aria-hidden="true">
      <div className="landing__flow-overlay">
        {/* Intake: single beam entering left → center */}
        <span className="flow-beam flow-beam--in" />
        {/* Decompose: center splits to multiple lanes */}
        <span className="flow-split">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        {/* Rank: rising score ticks */}
        <span className="flow-ranks">
          <i style={{ ["--h" as string]: "72%" }} />
          <i style={{ ["--h" as string]: "54%" }} />
          <i style={{ ["--h" as string]: "88%" }} />
          <i style={{ ["--h" as string]: "41%" }} />
          <i style={{ ["--h" as string]: "63%" }} />
        </span>
        {/* Call: provider pings */}
        <span className="flow-pings">
          <i data-p="Cloudflare" />
          <i data-p="Cohere" />
          <i data-p="CoArena" />
          <i data-p="Groq" />
          <i data-p="Gemini" />
          <i data-p="OpenRouter" />
        </span>
        {/* Stitch: lanes converge right */}
        <span className="flow-merge">
          <i />
          <i />
          <i />
          <i />
        </span>
        {/* Quality: verdict pulse */}
        <span className="flow-verdict" />
      </div>
      <p className="landing__flow-caption">{labels[stageId] ?? labels.intake}</p>
    </div>
  );
}

function AmbientVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [allowMotion, setAllowMotion] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const reduce = mq.matches;
      setAllowMotion(!reduce);
      const v = videoRef.current;
      if (!v) return;
      if (reduce) {
        v.pause();
        v.removeAttribute("autoplay");
      } else {
        void v.play().catch(() => undefined);
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <video
      ref={videoRef}
      className={className}
      poster={poster}
      muted
      loop
      playsInline
      autoPlay={allowMotion}
      preload={allowMotion ? "auto" : "none"}
    >
      {allowMotion ? <source src={src} type="video/mp4" /> : null}
    </video>
  );
}

export default function LandingPage() {
  const [activeStage, setActiveStage] = useState<string>(PIPELINE[0].id);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<string>("pipeline");
  const scoringReveal = useInView<HTMLUListElement>();

  useEffect(() => {
    const ids = ["problem", "pipeline", "tasks", "scoring", "policies", "providers", "economics"];
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target.id;
        if (top && NAV_SECTIONS.some((n) => n.id === top)) setActiveNav(top);
        else if (top === "scoring" || top === "policies" || top === "providers") setActiveNav("pipeline");
        else if (top === "problem") setActiveNav("pipeline");
      },
      { threshold: [0.2, 0.45], rootMargin: "-20% 0px -45% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const selectedTask = TASKS.find((t) => t.id === activeTask);
  const taskModelId = activeTask ? TASK_HOME_MODEL_ID[activeTask] : null;
  const taskModel = taskModelId ? findRate(taskModelId) : null;

  return (
    <div className="landing">
      <div className="landing__grain" aria-hidden="true" />

      <header className="landing__nav">
        <a className="landing__mark" href="#top">
          <img className="landing__mark-icon" src="/orchestrator-mark.svg" alt="" width={28} height={28} />
          Orchestrator
        </a>
        <nav className="landing__nav-links" aria-label="Sections">
          {NAV_SECTIONS.map((n) => (
            <a key={n.id} href={`#${n.id}`} className={activeNav === n.id ? "is-active" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="landing__nav-actions">
          <Link className="landing__ghost" to="/app?tab=registry">
            Registry
          </Link>
          <Link className="landing__solid" to="/app?tab=playground">
            Open chat
          </Link>
        </div>
      </header>

      <section className="landing__hero" id="top">
        <div className="landing__hero-media" aria-hidden="true">
          <AmbientVideo className="landing__hero-video" src="/hero-signal.mp4" poster="/hero-signal.jpg" />
          <img className="landing__hero-poster" src="/hero-signal.jpg" alt="" />
          <div className="landing__hero-veil" />
        </div>
        <div className="landing__hero-copy">
          <p className="landing__brand">Orchestrator</p>
          <h1 className="landing__headline">Route the prompt. Not the model.</h1>
          <p className="landing__lede">
            Split a mixed prompt into specialist tasks, run each on the right model, and return one clear answer.
          </p>
          <div className="landing__cta">
            <Link className="landing__solid landing__solid--lg" to="/app?tab=playground">
              Open chat
            </Link>
            <Link className="landing__ghost landing__ghost--lg" to="/app?tab=registry">
              View registry
            </Link>
          </div>
          <div className="landing__signal-strip" aria-hidden="true">
            <div className="landing__signal-flow">
              <span>Decompose</span>
              <span className="landing__signal-arrow">→</span>
              <span>Specialists</span>
              <span className="landing__signal-arrow">→</span>
              <span>Stitch</span>
            </div>
            <div className="landing__signal-track">
              <div className="landing__signal-marquee">
                {[...TASKS, ...TASKS].map((t, i) => (
                  <span key={`${t.id}-${i}`} className="landing__signal-chip">
                    {t.id}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <a className="landing__scroll" href="#problem">
            See how it works ↓
          </a>
        </div>
      </section>

      <section className="landing__section" id="problem">
        <Reveal>
          <div className="landing__section-head">
            <p className="landing__eyebrow">The problem</p>
            <h2>One heavy model for every ask costs more than it should.</h2>
            <p className="landing__section-lede">
              Using one expensive model for every request wastes money and time. Orchestrator sends each part of
              the ask to a model that fits it.
            </p>
          </div>
          <div className="landing__compare">
            <div className="landing__compare-col">
              <h3>Always-heavy</h3>
              <p>
                Lock {scenario.competitorName} for every token. Simple ops — expensive at scale. Demo month:{" "}
                <strong>{fmtINR(scenario.competitorInr)}</strong>.
              </p>
            </div>
            <div className="landing__compare-col landing__compare-col--signal">
              <h3>Orchestrator mix</h3>
              <p>
                Route each specialty to a fitting model across providers. Same volume:{" "}
                <strong>{fmtINR(scenario.orchestraInr)}</strong>.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="landing__section" id="pipeline">
        <Reveal>
          <div className="landing__section-head">
            <p className="landing__eyebrow">How it works</p>
            <h2>See each step of the route.</h2>
            <p className="landing__section-lede">
              Click a stage to watch intake, decompose, specialists, stitch, and quality in motion.
            </p>
          </div>
          <div className="landing__flow-visual" aria-live="polite">
            <img className="landing__flow-poster" src="/flow-lattice.jpg" alt="" />
            <PipelineStageVisual stageId={activeStage} />
          </div>
          <ol className="landing__pipeline">
            {PIPELINE.map((stage, i) => {
              const on = activeStage === stage.id;
              return (
                <li
                  key={stage.id}
                  className={on ? "is-active" : activeStage ? "is-dim" : undefined}
                >
                  <button type="button" className="landing__stage-btn" onClick={() => setActiveStage(stage.id)}>
                    <span className="landing__stage-idx">{String(i + 1).padStart(2, "0")}</span>
                    <h3>{stage.title}</h3>
                    <p>{stage.body}</p>
                  </button>
                </li>
              );
            })}
          </ol>
        </Reveal>
      </section>

      <section className="landing__section" id="tasks">
        <Reveal>
          <div className="landing__section-head">
            <p className="landing__eyebrow">Task types</p>
            <h2>Twelve specialties. A clear home for each model.</h2>
            <p className="landing__section-lede">
              Click a row to see which model handles that task and what it costs in INR.
            </p>
          </div>
          <div className="landing__task-table-wrap">
            <table className="landing__table landing__table--interactive">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Intent cues</th>
                  <th>Primary home</th>
                </tr>
              </thead>
              <tbody>
                {TASKS.map((t) => (
                  <tr
                    key={t.id}
                    className={activeTask === t.id ? "is-active" : undefined}
                    onClick={() => setActiveTask(activeTask === t.id ? null : t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveTask(activeTask === t.id ? null : t.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={activeTask === t.id}
                  >
                    <td>
                      <code>{t.id}</code>
                    </td>
                    <td>{t.intent}</td>
                    <td>{t.home}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedTask && taskModel && (
            <div className="landing__task-detail" role="status">
              <strong>{selectedTask.id}</strong> → {taskModel.displayName} ({taskModel.provider}) · input{" "}
              {formatRateCell(taskModel.inputUsdPer1k).free
                ? "Free"
                : formatRateCell(taskModel.inputUsdPer1k).per1k + " / 1K"}{" "}
              · output{" "}
              {formatRateCell(taskModel.outputUsdPer1k).free
                ? "Free"
                : formatRateCell(taskModel.outputUsdPer1k).per1k + " / 1K"}
            </div>
          )}
        </Reveal>
      </section>

      <section className="landing__section" id="scoring">
        <Reveal>
          <div className="landing__section-head">
            <p className="landing__eyebrow">Scoring</p>
            <h2>Strength first. Cost and latency pull the score down.</h2>
            <p className="landing__section-lede">
              We rank models by quality first, then cost and speed. When two models are close in quality, the
              cheaper INR option rises.
            </p>
          </div>
          <ul
            ref={scoringReveal.ref}
            className={`landing__weight-row${scoringReveal.visible ? " is-visible" : ""}`}
          >
            {WEIGHTS.map((w) => (
              <li key={w.display}>
                <span className="landing__weight-num">{w.display}</span>
                <span className="landing__weight-label">{w.label}</span>
                <span className="landing__weight-track" aria-hidden="true">
                  <span className="landing__weight-fill" style={{ ["--w" as string]: w.width }} />
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section className="landing__section" id="policies">
        <Reveal>
          <div className="landing__section-head">
            <p className="landing__eyebrow">Policies</p>
            <h2>Three ways to run a request.</h2>
          </div>
          <ul className="landing__policy-grid">
            {POLICIES.map((p) => (
              <li key={p.id} className="landing__hover-lift">
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section className="landing__section" id="providers">
        <Reveal>
          <div className="landing__section-head">
            <p className="landing__eyebrow">Providers</p>
            <h2>Multi-provider by design.</h2>
            <p className="landing__section-lede">
              When scores are close, Orchestrator prefers a different provider so one stack does not win every
              slice.
            </p>
          </div>
          <ul className="landing__provider-cards">
            {PROVIDERS.map((p) => (
              <li key={p.name} className="landing__hover-lift">
                <h3>{p.name}</h3>
                <p>{p.role}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section className="landing__section" id="economics">
        <Reveal>
          <div className="landing__section-head">
            <p className="landing__eyebrow">INR economics</p>
            <h2>Compare any model vs Orchestrator.</h2>
            <p className="landing__section-lede">
              Pick a model and monthly volume to compare always-one-model spend vs Orchestrator routing. Prices
              shown in INR.
            </p>
          </div>

          <SavingsDashboard />

          <div className="landing__task-table-wrap landing__rates">
            <table className="landing__table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Input</th>
                  <th>Output</th>
                </tr>
              </thead>
              <tbody>
                {rateRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.displayName}</td>
                    <td>{row.provider}</td>
                    <td>
                      {row.inputDisplay.free ? (
                        <span className="landing__badge">Free</span>
                      ) : (
                        <>
                          <span>{row.inputDisplay.per1k} / 1K</span>
                          <small className="landing__rate-sub">{row.inputDisplay.per1m}</small>
                        </>
                      )}
                    </td>
                    <td>
                      {row.outputDisplay.free ? (
                        <span className="landing__badge">Free</span>
                      ) : (
                        <>
                          <span>{row.outputDisplay.per1k} / 1K</span>
                          <small className="landing__rate-sub">{row.outputDisplay.per1m}</small>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      <footer className="landing__footer" id="cta">
        <div className="landing__footer-copy">
          <p className="landing__brand landing__brand--sm">
            <img className="landing__mark-icon" src="/orchestrator-mark.svg" alt="" width={36} height={36} />
            Orchestrator
          </p>
          <p className="landing__footer-line">
            Open chat to ask a mixed prompt — and follow up with context.
          </p>
          <p className="landing__note">
            Quality labels are a simple guide, not a formal accuracy score. Prices on this page are INR
            estimates.
          </p>
        </div>
        <div className="landing__cta">
          <Link className="landing__solid landing__solid--lg" to="/app?tab=playground">
            Open chat
          </Link>
          <Link className="landing__ghost landing__ghost--lg" to="/app?tab=registry">
            View registry
          </Link>
        </div>
      </footer>
    </div>
  );
}
