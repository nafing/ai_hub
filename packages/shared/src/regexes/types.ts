export type RegexTarget = "ai_output" | "user_input";

/**
 * Where the script runs in the pipeline.
 * - display: only how messages appear on screen
 * - prompt: only what the model receives in context
 * - both: display and prompt
 */
export type RegexApplyTo = "display" | "prompt" | "both";

/** Global scripts apply everywhere; character scripts only for listed character ids. */
export type RegexScope = "global" | "character";

export type RegexScript = {
  id: string;
  /** Display name in the Regexes panel. */
  name: string;
  /** When false, the script is skipped. */
  enabled: boolean;
  /**
   * JavaScript-style regex source (without surrounding slashes).
   * Example: `\*([^*]+)\*`
   */
  find_regex: string;
  /**
   * Replacement string. Use `$1`, `$2`, … for capture groups.
   * Example: `$1`
   */
  replace_with: string;
  /** Regex flags, e.g. `g`, `gi`, `gim`. `g` is recommended. */
  flags: string;
  /** Which message roles/sources this script runs on. */
  targets: RegexTarget[];
  /** Display-only, prompt-only, or both. */
  apply_to: RegexApplyTo;
  /** Lower runs first. */
  order: number;
  /**
   * Inclusive min depth in chat history (0 = newest message).
   * `null` = no minimum.
   */
  min_depth: number | null;
  /**
   * Inclusive max depth in chat history.
   * `null` = no maximum.
   */
  max_depth: number | null;
  scope: RegexScope;
  /** Used when `scope === "character"`. */
  character_ids: string[];
};
