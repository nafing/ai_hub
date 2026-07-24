import { REGEX_APPLY_TIMEOUT_MS } from "./constants";
import type { RegexApplyTo, RegexScript, RegexTarget } from "./types";

export type RegexMessageRole = "user" | "assistant" | "system";

export type RegexApplyMessage = {
  role: RegexMessageRole;
  content: string;
  /** Optional character id for character-scoped scripts. */
  character_id?: string | null;
};

export type ApplyRegexScriptsOptions = {
  /** Which pipeline stage is applying scripts. */
  stage: "display" | "prompt";
  /**
   * Depth of the newest message is 0; older messages increase.
   * When applying to a list, depth is derived from index automatically.
   */
  depth?: number;
  /** Character id for the current chat (character-scoped filter). */
  characterId?: string | null;
  /** Override default per-script time budget (ms). */
  timeoutMs?: number;
};

export type RegexApplySkipReason =
  | "disabled"
  | "empty_pattern"
  | "unsafe_pattern"
  | "invalid_pattern"
  | "stage_mismatch"
  | "target_mismatch"
  | "scope_mismatch"
  | "depth_mismatch"
  | "timeout";

export type RegexApplyReport = {
  scriptId: string;
  scriptName: string;
  skipped?: RegexApplySkipReason;
  applied?: boolean;
};

const NESTED_QUANTIFIER =
  /(\([^()]*[+*][^()]*\))[+*]|\([^)]*[+*][^)]*\)[+*]{1,}|([+*][?]?){2,}/;

/**
 * SillyTavern HTML strippers use this attribute consumer:
 * `(?:"[^"]*"|'[^']*'|[^'">])*`
 * Alternatives are mutually exclusive on the first char — not catastrophic ReDoS.
 * Neutralize before the nested-quantifier heuristic so ST scripts are allowed.
 */
const ST_HTML_ATTR_CONSUMER =
  /\(\?:?"\[\^"\]\*"|'\[\^'\]\*'|\[\^'"\]>\)[*+]?\??/g;

function neutralizeStHtmlAttrConsumers(source: string): string {
  return source.replace(ST_HTML_ATTR_CONSUMER, "·");
}

/**
 * Heuristic ReDoS guard: nested quantifiers / repeated quantifiers.
 * Not perfect, but blocks common catastrophic patterns.
 * Allows SillyTavern-style HTML tag strip patterns.
 */
export function isUnsafeRegexPattern(source: string): boolean {
  const trimmed = source.trim();
  if (!trimmed) return false;
  if (trimmed.length > 1000) return true;
  return NESTED_QUANTIFIER.test(neutralizeStHtmlAttrConsumers(trimmed));
}

export function compileRegexScript(
  script: Pick<RegexScript, "find_regex" | "flags">,
): RegExp | null {
  const source = script.find_regex;
  if (!source.trim()) return null;
  if (isUnsafeRegexPattern(source)) return null;

  let flags = script.flags?.trim() || "g";
  if (!flags.includes("g")) flags += "g";

  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

function matchesStage(applyTo: RegexApplyTo, stage: "display" | "prompt"): boolean {
  if (applyTo === "both") return true;
  return applyTo === stage;
}

function roleToTarget(role: RegexMessageRole): RegexTarget | null {
  if (role === "assistant") return "ai_output";
  if (role === "user") return "user_input";
  return null;
}

function matchesDepth(
  script: Pick<RegexScript, "min_depth" | "max_depth">,
  depth: number,
): boolean {
  if (script.min_depth !== null && depth < script.min_depth) return false;
  if (script.max_depth !== null && depth > script.max_depth) return false;
  return true;
}

function matchesScope(
  script: Pick<RegexScript, "scope" | "character_ids">,
  characterId: string | null | undefined,
): boolean {
  if (script.scope === "global") return true;
  if (!characterId) return false;
  return script.character_ids.includes(characterId);
}

function expandReplacement(template: string, match: RegExpExecArray): string {
  return template.replace(/\$(\d+)/g, (_whole, index: string) => {
    const n = Number(index);
    return match[n] ?? "";
  });
}

/**
 * Apply a single script to one string. Returns original text if skipped / timed out.
 */
export function applyRegexScriptToText(
  text: string,
  script: RegexScript,
  options: {
    timeoutMs?: number;
  } = {},
): { text: string; skipped?: RegexApplySkipReason; applied: boolean } {
  if (!script.enabled) {
    return { text, skipped: "disabled", applied: false };
  }
  if (!script.find_regex.trim()) {
    return { text, skipped: "empty_pattern", applied: false };
  }
  if (isUnsafeRegexPattern(script.find_regex)) {
    return { text, skipped: "unsafe_pattern", applied: false };
  }

  const regex = compileRegexScript(script);
  if (!regex) {
    return { text, skipped: "invalid_pattern", applied: false };
  }

  const timeoutMs = options.timeoutMs ?? REGEX_APPLY_TIMEOUT_MS;
  const started = Date.now();
  let result = "";
  let cursor = 0;
  let matched = false;
  let match: RegExpExecArray | null;
  regex.lastIndex = 0;

  try {
    while ((match = regex.exec(text)) !== null) {
      if (Date.now() - started > timeoutMs) {
        return { text, skipped: "timeout", applied: false };
      }

      matched = true;
      result += text.slice(cursor, match.index);
      result += expandReplacement(script.replace_with, match);
      cursor = match.index + match[0].length;

      if (match[0].length === 0) {
        regex.lastIndex = match.index + 1;
        if (regex.lastIndex > text.length) break;
      }
    }
  } catch {
    return { text, skipped: "invalid_pattern", applied: false };
  }

  if (!matched) {
    return { text, applied: false };
  }

  result += text.slice(cursor);
  return { text: result, applied: true };
}

function shouldRunScript(
  script: RegexScript,
  message: RegexApplyMessage,
  options: ApplyRegexScriptsOptions,
  depth: number,
): RegexApplySkipReason | null {
  if (!script.enabled) return "disabled";
  if (!script.find_regex.trim()) return "empty_pattern";
  if (!matchesStage(script.apply_to, options.stage)) return "stage_mismatch";

  const target = roleToTarget(message.role);
  if (!target || !script.targets.includes(target)) return "target_mismatch";

  if (!matchesScope(script, options.characterId ?? message.character_id)) {
    return "scope_mismatch";
  }

  if (!matchesDepth(script, depth)) return "depth_mismatch";

  if (isUnsafeRegexPattern(script.find_regex)) return "unsafe_pattern";
  if (!compileRegexScript(script)) return "invalid_pattern";

  return null;
}

/** Sort scripts by `order` ascending (stable by name/id). */
export function sortRegexScripts(scripts: RegexScript[]): RegexScript[] {
  return [...scripts].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}

/**
 * Apply all matching regex scripts to a single message string.
 */
export function applyRegexScriptsToText(
  text: string,
  scripts: RegexScript[],
  message: Pick<RegexApplyMessage, "role" | "character_id">,
  options: ApplyRegexScriptsOptions,
): { text: string; report: RegexApplyReport[] } {
  const depth = options.depth ?? 0;
  const report: RegexApplyReport[] = [];
  let current = text;

  for (const script of sortRegexScripts(scripts)) {
    const skip = shouldRunScript(
      script,
      { role: message.role, content: current, character_id: message.character_id },
      options,
      depth,
    );
    if (skip) {
      report.push({
        scriptId: script.id,
        scriptName: script.name,
        skipped: skip,
      });
      continue;
    }

    const result = applyRegexScriptToText(current, script, {
      timeoutMs: options.timeoutMs,
    });
    if (result.skipped) {
      report.push({
        scriptId: script.id,
        scriptName: script.name,
        skipped: result.skipped,
      });
      continue;
    }

    current = result.text;
    report.push({
      scriptId: script.id,
      scriptName: script.name,
      applied: result.applied,
    });
  }

  return { text: current, report };
}

/**
 * Apply regex scripts across a prompt/display message list.
 * Depth 0 = last message (newest); older messages get higher depth.
 */
export function applyRegexScriptsToMessages(
  messages: RegexApplyMessage[],
  scripts: RegexScript[],
  options: Omit<ApplyRegexScriptsOptions, "depth">,
): { messages: RegexApplyMessage[]; report: RegexApplyReport[] } {
  const report: RegexApplyReport[] = [];
  const lastIndex = messages.length - 1;

  const next = messages.map((message, index) => {
    const depth = lastIndex - index;
    const result = applyRegexScriptsToText(message.content, scripts, message, {
      ...options,
      depth,
    });
    report.push(...result.report);
    return { ...message, content: result.text };
  });

  return { messages: next, report };
}

/** Prompt-stage helper used by the server when assembling generation context. */
export function applyRegexScriptsToPromptMessages(
  messages: RegexApplyMessage[],
  scripts: RegexScript[],
  options: Omit<ApplyRegexScriptsOptions, "stage" | "depth"> = {},
): { messages: RegexApplyMessage[]; report: RegexApplyReport[] } {
  return applyRegexScriptsToMessages(messages, scripts, {
    ...options,
    stage: "prompt",
  });
}

/** Display-stage helper used by the client when rendering messages. */
export function applyRegexScriptsToDisplayMessages(
  messages: RegexApplyMessage[],
  scripts: RegexScript[],
  options: Omit<ApplyRegexScriptsOptions, "stage" | "depth"> = {},
): { messages: RegexApplyMessage[]; report: RegexApplyReport[] } {
  return applyRegexScriptsToMessages(messages, scripts, {
    ...options,
    stage: "display",
  });
}
