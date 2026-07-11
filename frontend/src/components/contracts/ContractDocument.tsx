"use client";

import { Fragment } from "react";

/**
 * Minimal, dependency-free renderer for the contract's markdown subset:
 * `## h2`, `### h3`, `**bold**`, `_italic_`, `- bullets`, `---` rules, and
 * paragraphs. The body is our own controlled template, so we don't need a full
 * markdown engine — this keeps the document print-clean and legally readable.
 */
function inline(text: string, keyBase: string): React.ReactNode[] {
  // Split on **bold** and _italic_ while keeping the delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={`${keyBase}-${i}`} className="font-semibold text-[var(--color-text)]">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("_") && p.endsWith("_")) {
      return <em key={`${keyBase}-${i}`} className="text-[var(--color-text-secondary)]">{p.slice(1, -1)}</em>;
    }
    return <Fragment key={`${keyBase}-${i}`}>{p}</Fragment>;
  });
}

export function ContractDocument({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    const items = bullets;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-2 list-disc space-y-1 pl-6 text-[15px] leading-7 text-[var(--color-text-secondary)]">
        {items.map((b, i) => <li key={i}>{inline(b, `li-${blocks.length}-${i}`)}</li>)}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^\s*[-*]\s+/, ""));
      return;
    }
    flushBullets();
    if (!line.trim()) return;
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={idx} className="mt-6 text-base font-semibold text-[var(--color-text)]">{inline(line.slice(4), `h3-${idx}`)}</h3>);
    } else if (line.startsWith("## ")) {
      blocks.push(<h2 key={idx} className="mt-2 text-center text-2xl font-bold tracking-tight text-[var(--color-text)]">{inline(line.slice(3), `h2-${idx}`)}</h2>);
    } else if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={idx} className="my-6 border-[var(--color-border)]" />);
    } else {
      blocks.push(<p key={idx} className="mt-3 text-[15px] leading-7 text-[var(--color-text-secondary)]">{inline(line, `p-${idx}`)}</p>);
    }
  });
  flushBullets();

  return <div className="contract-body">{blocks}</div>;
}
