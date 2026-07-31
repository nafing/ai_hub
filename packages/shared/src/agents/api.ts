import type { Agent } from "./types";

export type CreateAgentInput = Omit<Agent, "id" | "is_built_in">;

export type UpdateAgentInput = Partial<CreateAgentInput>;

export type AgentListItem = Pick<
  Agent,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "author"
  | "phase"
  | "category"
  | "enabled_by_default"
  | "default_tools"
  | "default_settings"
  | "prompt_templates"
  | "execution"
  | "is_built_in"
>;
