/**
 * When the agent runs relative to the main generation.
 */
export type AgentPhase =
  | "parallel"
  | "pre_generation"
  | "post_processing";

/**
 * UI / Chat Settings grouping.
 */
export type AgentCategory = "misc" | "writer" | "tracker";

/**
 * How agent output is consumed (extend as more pipelines land).
 */
export type AgentResultType = "text_rewrite";

/**
 * `llm` = prompt + tools; `feature` = non-LLM runtime (e.g. Calls).
 */
export type AgentExecution = "llm" | "feature";

/** Alternate prompt pack selectable at runtime (e.g. Echo Chamber styles). */
export type AgentPromptTemplate = {
  id: string;
  name: string;
  description: string;
  prompt_template: string;
};

/**
 * Agent definition (prompt + tools + pipeline knobs).
 * Field names are snake_case to match hub persistence.
 */
export type AgentDefinition = {
  /** Stable slug (e.g. echo-chamber). Unique; used for built-in ids. */
  slug: string;
  /** Display name. */
  name: string;
  description: string;
  author: string;
  phase: AgentPhase;
  category: AgentCategory;
  /** Suggested on when first added to a chat. */
  enabled_by_default: boolean;
  /** Tool names from the Tools catalog. */
  default_tools: string[];
  default_prompt_template: string;
  /** Free-form runtime / UI settings. */
  default_settings: Record<string, unknown>;
  /** Empty = all modes. */
  mode_allowlist: string[];
  result_type: AgentResultType | null;
  default_inject_as_section: boolean;
  run_interval: number | null;
  prompt_templates: AgentPromptTemplate[];
  /** When true, agent is not run by the LLM pipeline. */
  runtime_disabled: boolean;
  execution: AgentExecution;
};

/**
 * Persisted agent (definition + hub metadata).
 */
export type Agent = AgentDefinition & {
  id: string;
  /**
   * Built-in agents seeded on startup. Cannot be deleted.
   * User-created agents always have `is_built_in: false`.
   */
  is_built_in: boolean;
};
