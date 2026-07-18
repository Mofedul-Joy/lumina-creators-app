// Lightweight markdown renderer for creator-facing brief content (Feature 5:
// "kill the Google Doc"). Hand-rolled instead of pulling in react-markdown —
// no react-markdown/remark-gfm dependency is installed in package.json and
// the supported syntax subset (bold/italic/strike/links/headings/lists/
// paragraphs/bare-URL autolink) is small enough that a ~120-line parser is
// safer than adding a new dependency mid-feature. Swap this out for
// react-markdown + remark-gfm later if the brief syntax grows.
//
// Supported syntax:
//   **bold**            -> <strong>
//   *italic*, _italic_  -> <em>
//   ~~strike~~          -> <del>
//   [text](url)         -> <a target="_blank" rel="noopener noreferrer">
//   # / ## / ###        -> h1 / h2 / h3
//   - item / * item      -> <ul><li>
//   1. item              -> <ol><li>
//   blank line            -> new paragraph
//   bare http(s):// URLs -> auto-linked

import React from "react";

/** Renders one line's worth of inline markdown (bold/italic/strike/links/autolink) as React nodes. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // Tokenize left-to-right with a single combined regex so nested/overlapping
  // matches don't fight each other. Order matters: links before bare URLs,
  // bold before italic (so **x** isn't half-eaten by the italic rule).
  // NOTE: underscore-italics is flanked by (?<![A-Za-z0-9])…(?![A-Za-z0-9]) so
  // intra-word underscores (snake_case enum values like `content_creator`,
  // `ugc_ads`, file_names, un-linked URLs) are NOT treated as emphasis — matching
  // CommonMark. Without this, `content_creator … ugc_ads` renders as garbled
  // italics with the words joined. Asterisk-italics stays lenient.
  const pattern =
    /(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\*[^*]+\*)|((?<![A-Za-z0-9])_[^_]+_(?![A-Za-z0-9]))|(https?:\/\/[^\s)]+)/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      // Only allow http(s)/mailto — never javascript:/data: etc. (defense-in-depth).
      const href = linkMatch && /^(https?:|mailto:)/i.test(linkMatch[2]) ? linkMatch[2] : null;
      if (linkMatch && href) {
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand)] underline underline-offset-2 hover:text-[var(--color-brand-hover)]"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{renderInline(token.slice(2, -2), key)}</strong>);
    } else if (token.startsWith("~~")) {
      nodes.push(<del key={key}>{renderInline(token.slice(2, -2), key)}</del>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1), key)}</em>);
    } else if (token.startsWith("_")) {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1), key)}</em>);
    } else if (token.startsWith("http")) {
      nodes.push(
        <a
          key={key}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-brand)] underline underline-offset-2 hover:text-[var(--color-brand-hover)] break-all"
        >
          {token}
        </a>
      );
    } else {
      nodes.push(token);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; text: string };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let ulItems: string[] = [];
  let olItems: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: "p", text: para.join(" ") });
      para = [];
    }
  };
  const flushUl = () => {
    if (ulItems.length) {
      blocks.push({ type: "ul", items: ulItems });
      ulItems = [];
    }
  };
  const flushOl = () => {
    if (olItems.length) {
      blocks.push({ type: "ol", items: olItems });
      olItems = [];
    }
  };
  const flushLists = () => {
    flushUl();
    flushOl();
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (line === "") {
      flushPara();
      flushLists();
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);
    if (h3 || h2 || h1) {
      flushPara();
      flushLists();
      if (h1) blocks.push({ type: "h1", text: h1[1] });
      else if (h2) blocks.push({ type: "h2", text: h2[1] });
      else if (h3) blocks.push({ type: "h3", text: h3[1] });
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushPara();
      flushOl();
      ulItems.push(bullet[1]);
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushPara();
      flushUl();
      olItems.push(numbered[1]);
      continue;
    }

    // continuation of a paragraph
    flushLists();
    para.push(line);
  }
  flushPara();
  flushLists();
  return blocks;
}

/**
 * Lightweight markdown renderer for brief_script / caption_rules content.
 * Supports bold/italic/strike/links/headings/lists/paragraphs + bare-URL
 * autolinking. Kept dependency-free (no react-markdown) so it works with the
 * existing package.json without a fresh install.
 */
export function Markdown({ content, className = "" }: { content: string; className?: string }) {
  const blocks = React.useMemo(() => parseBlocks(content ?? ""), [content]);

  if (!content || !content.trim()) return null;

  return (
    <div className={`space-y-3 text-sm leading-relaxed text-[var(--color-text-secondary)] ${className}`}>
      {blocks.map((block, idx) => {
        const key = `md-${idx}`;
        switch (block.type) {
          case "h1":
            return (
              <h1 key={key} className="text-xl font-semibold text-[var(--color-text)]">
                {renderInline(block.text, key)}
              </h1>
            );
          case "h2":
            return (
              <h2 key={key} className="text-lg font-semibold text-[var(--color-text)]">
                {renderInline(block.text, key)}
              </h2>
            );
          case "h3":
            return (
              <h3 key={key} className="text-base font-semibold text-[var(--color-text)]">
                {renderInline(block.text, key)}
              </h3>
            );
          case "ul":
            return (
              <ul key={key} className="list-disc space-y-1 pl-5 marker:text-[var(--color-brand)]">
                {block.items.map((item, i) => (
                  <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} className="list-decimal space-y-1 pl-5 marker:text-[var(--color-brand)]">
                {block.items.map((item, i) => (
                  <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
                ))}
              </ol>
            );
          case "p":
          default:
            return (
              <p key={key} className="whitespace-pre-wrap">
                {renderInline(block.text, key)}
              </p>
            );
        }
      })}
    </div>
  );
}

export default Markdown;
