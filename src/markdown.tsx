/** Tiny zero-dep markdown renderer for answer bodies (headings, bold, lists, fences). */
import type { ReactNode } from "react";

function inlineFormat(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(
        <code key={key++} className="md-inline-code">
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MarkdownBody({ text }: { text: string }) {
  const source = (text || "").replace(/\r\n/g, "\n").trim();
  if (!source) return <p className="muted">—</p>;

  const blocks: ReactNode[] = [];
  const lines = source.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      blocks.push(
        <pre key={key++} className="md-code" data-lang={lang || undefined}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (/^###\s+/.test(line)) {
      blocks.push(
        <h4 key={key++} className="md-h">
          {inlineFormat(line.replace(/^###\s+/, ""))}
        </h4>,
      );
      i += 1;
      continue;
    }
    if (/^##\s+/.test(line)) {
      blocks.push(
        <h3 key={key++} className="md-h">
          {inlineFormat(line.replace(/^##\s+/, ""))}
        </h3>,
      );
      i += 1;
      continue;
    }
    if (/^#\s+/.test(line)) {
      blocks.push(
        <h2 key={key++} className="md-h">
          {inlineFormat(line.replace(/^#\s+/, ""))}
        </h2>,
      );
      i += 1;
      continue;
    }

    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="md-list">
          {items.map((item, idx) => (
            <li key={idx}>{inlineFormat(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+[\).]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[\).]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[\).]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={key++} className="md-list">
          {items.map((item, idx) => (
            <li key={idx}>{inlineFormat(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("```") &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+[\).]\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={key++} className="md-p">
        {inlineFormat(para.join(" "))}
      </p>,
    );
  }

  return <div className="md-body">{blocks}</div>;
}
