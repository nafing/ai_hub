import type { RegexApplyTo, RegexScope, RegexTarget } from "./types";

export const REGEX_TARGETS = ["ai_output", "user_input"] as const;

export const REGEX_APPLY_TO = ["display", "prompt", "both"] as const;

export const REGEX_SCOPES = ["global", "character"] as const;

export const REGEX_TARGET_LABELS: Record<RegexTarget, string> = {
  ai_output: "AI Output",
  user_input: "User Input",
};

export const REGEX_APPLY_TO_LABELS: Record<RegexApplyTo, string> = {
  display: "Only Display",
  prompt: "Only Prompt",
  both: "Both",
};

export const REGEX_SCOPE_LABELS: Record<RegexScope, string> = {
  global: "Global",
  character: "Character-scoped",
};

/** Default per-message apply budget before a script is skipped for that message. */
export const REGEX_APPLY_TIMEOUT_MS = 50;
