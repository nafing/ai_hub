import { createElement, type ReactNode } from "react";
import {
  substituteVariables,
  type PresetVariableValues,
} from "@ai-hub/shared";
import classes from "./RuntimeText.module.css";

const MACRO_RE = /(\{\{\s*[^{}]+?\s*\}\})/g;

export type RuntimeTextProps = {
  /** Template with `{{macros}}`. Prefer this or string `children`. */
  text?: string;
  /** String template; ignored when `text` is set. */
  children?: string;
  /** Runtime values for `substituteVariables` / `resolveTemplate`. */
  values?: PresetVariableValues;
  /**
   * When true (default), leftover `{{…}}` after substitution are rendered
   * as styled macro chips. When false, they stay as plain text.
   * Ignored when `format` is set.
   */
  highlightUnresolved?: boolean;
  /**
   * Post-process the substituted string (e.g. chat markdown).
   * Receives fully substituted text; skips macro highlighting.
   */
  format?: (resolved: string) => ReactNode;
  as?: "span" | "p" | "div";
  className?: string;
};

function joinClassNames(
  ...parts: Array<string | false | null | undefined>
): string | undefined {
  const next = parts.filter(Boolean).join(" ");
  return next || undefined;
}

function renderWithMacroHighlights(resolved: string): ReactNode {
  const parts = resolved.split(MACRO_RE);
  if (parts.length === 1) return resolved;

  return parts.map((part, index) => {
    if (!part) return null;
    if (index % 2 === 1) {
      return (
        <code key={index} className={classes.macro}>
          {part}
        </code>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

/**
 * Renders preset/chat macro templates as plain text.
 * Applies `substituteVariables` when `values` are provided, then optionally
 * highlights any remaining `{{placeholders}}`.
 *
 * @example
 * <RuntimeText values={{ char: "Aria" }}>Talk to {{char}}.</RuntimeText>
 * // → "Talk to Aria."
 *
 * @example
 * <RuntimeText>Replaces {{char}} in prompts.</RuntimeText>
 * // → "Replaces " + styled {{char}} + " in prompts."
 */
export function RuntimeText({
  text,
  children,
  values,
  highlightUnresolved = true,
  format,
  as = "span",
  className,
}: RuntimeTextProps) {
  const source = text ?? children ?? "";
  const resolved = values ? substituteVariables(source, values) : source;

  let content: ReactNode;
  if (format) {
    content = format(resolved);
  } else if (highlightUnresolved) {
    content = renderWithMacroHighlights(resolved);
  } else {
    content = resolved;
  }

  return createElement(
    as,
    { className: joinClassNames(classes.root, className) },
    content,
  );
}
