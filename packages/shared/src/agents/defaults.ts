import type { Agent, AgentDefinition } from "./types";

/** Blank agent for user-created entries (never built-in). */
export function defaultAgent(): Omit<Agent, "id"> {
  return {
    slug: "",
    name: "",
    description: "",
    author: "",
    phase: "post_processing",
    category: "misc",
    enabled_by_default: false,
    default_tools: [],
    default_prompt_template: "",
    default_settings: {},
    mode_allowlist: [],
    result_type: null,
    default_inject_as_section: false,
    run_interval: null,
    prompt_templates: [],
    runtime_disabled: false,
    execution: "llm",
    is_built_in: false,
  };
}

/** Stable DB id for a built-in default agent. */
export function defaultAgentId(slug: string): string {
  return `default:${slug}`;
}

/** kebab-case slug from a display name. */
export function slugifyAgentName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function isValidAgentSlug(slug: string): boolean {
  return /^[a-z][a-z0-9-]{0,63}$/.test(slug);
}

export const AGENT_PHASES = [
  "parallel",
  "pre_generation",
  "post_processing",
] as const satisfies readonly AgentDefinition["phase"][];

export const AGENT_CATEGORIES = [
  "misc",
  "writer",
  "tracker",
] as const satisfies readonly AgentDefinition["category"][];

export const AGENT_EXECUTIONS = [
  "llm",
  "feature",
] as const satisfies readonly AgentDefinition["execution"][];
