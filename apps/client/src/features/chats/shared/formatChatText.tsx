import type { CSSProperties, ReactNode } from "react";
import classes from "./formatChatText.module.css";

/**
 * Roleplay chat formatting with nesting support:
 * - `**TEXT**` → bold emphasis
 * - `*TEXT*` → italic (may wrap quotes; may nest inside quotes)
 * - Quoted dialogue → dialogue span
 * - `` `TEXT` `` → inline code
 *
 * Quote pairs: "", '', «», 「」, 『』, „”, “”
 */

export type FormatChatTextOptions = {
  dialogueColor?: string | null;
  thoughtsColor?: string | null;
  emphasisColor?: string | null;
  dialogueBold?: boolean;
};

type QuotePair = { open: string; close: string };

const QUOTE_PAIRS: QuotePair[] = [
  { open: '"', close: '"' },
  { open: "'", close: "'" },
  { open: "«", close: "»" },
  { open: "「", close: "」" },
  { open: "『", close: "』" },
  { open: "„", close: "”" },
  { open: "“", close: "”" },
];

function indexOfClose(
  text: string,
  close: string,
  from: number,
  until: number,
): number {
  const idx = text.indexOf(close, from);
  if (idx === -1 || idx >= until) return -1;
  if (text.slice(from, idx).includes("\n")) return -1;
  return idx;
}

function matchQuote(
  text: string,
  at: number,
  until: number,
): { innerStart: number; innerEnd: number; end: number; open: string; close: string } | null {
  for (const pair of QUOTE_PAIRS) {
    if (!text.startsWith(pair.open, at)) continue;
    const innerStart = at + pair.open.length;
    const closeIdx = indexOfClose(text, pair.close, innerStart, until);
    if (closeIdx === -1) continue;
    return {
      open: pair.open,
      close: pair.close,
      innerStart,
      innerEnd: closeIdx,
      end: closeIdx + pair.close.length,
    };
  }
  return null;
}

/** Find closing `*` for italic opened at `openIdx`, skipping quotes / nested * / ** / code. */
function findClosingItalic(
  text: string,
  openIdx: number,
  until: number,
): number {
  let i = openIdx + 1;
  while (i < until) {
    if (text[i] === "\n") return -1;

    if (text[i] === "`") {
      const close = indexOfClose(text, "`", i + 1, until);
      if (close !== -1) {
        i = close + 1;
        continue;
      }
    }

    if (text.startsWith("**", i)) {
      const close = text.indexOf("**", i + 2);
      if (close !== -1 && close < until && !text.slice(i + 2, close).includes("\n")) {
        i = close + 2;
        continue;
      }
    }

    const quote = matchQuote(text, i, until);
    if (quote) {
      i = quote.end;
      continue;
    }

    if (text[i] === "*" && !text.startsWith("**", i)) {
      const nestedClose = findClosingItalic(text, i, until);
      if (nestedClose !== -1) {
        // Nested *…* pair — skip it so it doesn't close the outer italic.
        i = nestedClose + 1;
        continue;
      }
      // Unmatched * → this closes the italic opened at openIdx.
      return i;
    }

    i += 1;
  }
  return -1;
}

function parseRange(
  text: string,
  from: number,
  until: number,
  options: FormatChatTextOptions,
  dialogueStyle: CSSProperties | undefined,
  thoughtsStyle: CSSProperties | undefined,
  emphasisStyle: CSSProperties | undefined,
  dialogueClass: string,
  keyStart: { n: number },
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = from;
  let buffer = "";

  const flush = () => {
    if (!buffer) return;
    nodes.push(buffer);
    buffer = "";
  };

  const nextKey = () => keyStart.n++;

  while (i < until) {
    // Inline code
    if (text[i] === "`") {
      const close = indexOfClose(text, "`", i + 1, until);
      if (close !== -1) {
        flush();
        nodes.push(
          <code key={nextKey()} className={classes.code}>
            {text.slice(i + 1, close)}
          </code>,
        );
        i = close + 1;
        continue;
      }
    }

    // Bold **…**
    if (text.startsWith("**", i)) {
      const close = text.indexOf("**", i + 2);
      if (
        close !== -1 &&
        close < until &&
        !text.slice(i + 2, close).includes("\n")
      ) {
        flush();
        nodes.push(
          <strong key={nextKey()} className={classes.bold} style={emphasisStyle}>
            {parseRange(
              text,
              i + 2,
              close,
              options,
              dialogueStyle,
              thoughtsStyle,
              emphasisStyle,
              dialogueClass,
              keyStart,
            )}
          </strong>,
        );
        i = close + 2;
        continue;
      }
    }

    // Italic *…* (quotes and nested italics inside are allowed)
    if (text[i] === "*" && !text.startsWith("**", i)) {
      const close = findClosingItalic(text, i, until);
      if (close !== -1) {
        flush();
        nodes.push(
          <em key={nextKey()} className={classes.italic} style={thoughtsStyle}>
            {parseRange(
              text,
              i + 1,
              close,
              options,
              dialogueStyle,
              thoughtsStyle,
              emphasisStyle,
              dialogueClass,
              keyStart,
            )}
          </em>,
        );
        i = close + 1;
        continue;
      }
    }

    // Dialogue quotes
    const quote = matchQuote(text, i, until);
    if (quote) {
      flush();
      nodes.push(
        <span key={nextKey()} className={dialogueClass} style={dialogueStyle}>
          {quote.open}
          {parseRange(
            text,
            quote.innerStart,
            quote.innerEnd,
            options,
            dialogueStyle,
            thoughtsStyle,
            emphasisStyle,
            dialogueClass,
            keyStart,
          )}
          {quote.close}
        </span>,
      );
      i = quote.end;
      continue;
    }

    buffer += text[i];
    i += 1;
  }

  flush();
  return nodes;
}

export function formatChatText(
  text: string,
  options: FormatChatTextOptions = {},
): ReactNode[] {
  if (!text) return [text];

  const dialogueStyle: CSSProperties | undefined = options.dialogueColor?.trim()
    ? { color: options.dialogueColor.trim() }
    : undefined;
  const thoughtsStyle: CSSProperties | undefined = options.thoughtsColor?.trim()
    ? { color: options.thoughtsColor.trim() }
    : undefined;
  const emphasisStyle: CSSProperties | undefined = options.emphasisColor?.trim()
    ? { color: options.emphasisColor.trim() }
    : undefined;
  const dialogueClass = [
    classes.dialogue,
    options.dialogueBold ? classes.dialogueBold : "",
  ]
    .filter(Boolean)
    .join(" ");

  const nodes = parseRange(
    text,
    0,
    text.length,
    options,
    dialogueStyle,
    thoughtsStyle,
    emphasisStyle,
    dialogueClass,
    { n: 0 },
  );

  return nodes.length > 0 ? nodes : [text];
}
