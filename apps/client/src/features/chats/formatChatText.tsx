import type { ReactNode } from "react";
import { Code, Text } from "@mantine/core";

/**
 * Lightweight chat formatting:
 * - `*TEXT*` → italic (markdown)
 * - `"TEXT"` → dialogue
 * - `` `TEXT` `` → inline code
 *
 * Code spans win over italics/quotes so markers inside backticks stay literal.
 */
const TOKEN_RE = /(`[^`\n]+`)|(\*[^*\n]+\*)|("[^"\n]+")/g;

export function formatChatText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [full, code, italic, dialogue] = match;
    if (code) {
      nodes.push(
        <Code key={key++} style={{ fontSize: "0.9em" }}>
          {code.slice(1, -1)}
        </Code>,
      );
    } else if (italic) {
      nodes.push(
        <Text key={key++} span fs="italic" inherit component="em">
          {italic.slice(1, -1)}
        </Text>,
      );
    } else if (dialogue) {
      nodes.push(
        <Text key={key++} span inherit c="blue">
          {dialogue}
        </Text>,
      );
    } else {
      nodes.push(full);
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}
