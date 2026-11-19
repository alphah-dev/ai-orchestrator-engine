import type { CompleteResponse, PartOutput } from "./api";
import { MarkdownBody } from "./markdown";

function shortModel(id: string) {
  if (!id) return "—";
  return id.length > 28 ? `${id.slice(0, 26)}…` : id;
}

function orderParts(meta: CompleteResponse): PartOutput[] {
  const outs = meta.part_outputs || [];
  if (!meta.parts?.length) return outs;
  const byId = new Map(outs.map((p) => [p.part_id, p]));
  const ordered: PartOutput[] = [];
  for (const part of meta.parts) {
    const hit = byId.get(part.id);
    if (hit) {
      ordered.push(hit);
      byId.delete(part.id);
    }
  }
  for (const rest of byId.values()) ordered.push(rest);
  return ordered;
}

export function OrchestraAnswer({ meta }: { meta: CompleteResponse }) {
  const parts = orderParts(meta);
  if (!parts.length) {
    return <MarkdownBody text={meta.output || ""} />;
  }
  const ok = parts.filter((p) => p.success).length;

  return (
    <div className="orchestra-answer">
      <p className="orchestra-answer__summary">
        Combined from {ok}/{parts.length} specialist{parts.length === 1 ? "" : "s"}
      </p>
      <div className="answer-cards">
        {parts.map((po, idx) => (
          <article
            key={po.part_id}
            className={`answer-card${po.success ? "" : " answer-card--fail"}`}
          >
            <header className="answer-card__head">
              <span className="answer-card__index" aria-label={`Part ${idx + 1}`}>
                {idx + 1}
              </span>
              <span className="task-pill">{po.task_type}</span>
              <span className="answer-card__model mono" title={po.model}>
                {shortModel(po.model)}
              </span>
              {po.provider ? (
                <span className="answer-card__provider muted">{po.provider}</span>
              ) : null}
            </header>
            <div className="answer-card__body">
              {po.success ? (
                <MarkdownBody text={po.text} />
              ) : (
                <p className="muted">{po.error || "Specialist failed"}</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
