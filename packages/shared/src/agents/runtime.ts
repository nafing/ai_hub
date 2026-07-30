import type { ChatAgentSettingsMap } from "../chats/types";
import type { Agent } from "./types";
import type { ChatMessage } from "../chats/types";
import { substituteVariables } from "../presets/build-prompt";

/** Re-export chat agent setting types for convenience. */
export type {
  ChatAgentSetting,
  ChatAgentSettingsMap,
} from "../chats/types";

/**
 * Whether this agent should run on the upcoming assistant turn.
 * `assistantTurnNumber` is 1-based count after the turn completes
 * (history assistant messages + 1).
 */
export function shouldRunAgentByInterval(
  interval: number | null | undefined,
  assistantTurnNumber: number,
): boolean {
  if (interval == null || interval <= 1) return true;
  if (assistantTurnNumber <= 0) return false;
  return assistantTurnNumber % interval === 0;
}

export function countAssistantMessages(messages: ChatMessage[]): number {
  return messages.filter((message) => message.role === "assistant").length;
}

/** Resolve prompt template text for an agent (chat override → pack → default). */
export function resolveAgentPromptTemplate(
  agent: Pick<Agent, "default_prompt_template" | "prompt_templates">,
  promptTemplateId?: string | null,
): string {
  const id = promptTemplateId?.trim();
  if (id) {
    const match = agent.prompt_templates.find(
      (template) => template.id === id || template.name === id,
    );
    if (match?.prompt_template.trim()) return match.prompt_template;
  }
  return agent.default_prompt_template;
}

/** Merge agent.default_settings with per-chat overrides. */
export function resolveAgentRuntimeSettings(
  agent: Pick<Agent, "default_settings" | "id" | "slug">,
  agentSettings?: ChatAgentSettingsMap,
): Record<string, unknown> {
  const override =
    agentSettings?.[agent.id]?.settings ??
    agentSettings?.[agent.slug]?.settings ??
    {};
  return {
    ...(agent.default_settings ?? {}),
    ...(override && typeof override === "object" ? override : {}),
  };
}

export function resolveAgentRunInterval(
  agent: Pick<Agent, "run_interval" | "id" | "slug">,
  agentSettings?: ChatAgentSettingsMap,
): number | null {
  const override =
    agentSettings?.[agent.id]?.run_interval ??
    agentSettings?.[agent.slug]?.run_interval;
  if (override !== undefined) return override;
  return agent.run_interval;
}

export function resolveAgentPromptTemplateId(
  agent: Pick<Agent, "id" | "slug">,
  agentSettings?: ChatAgentSettingsMap,
): string | null {
  return (
    agentSettings?.[agent.id]?.prompt_template_id ??
    agentSettings?.[agent.slug]?.prompt_template_id ??
    null
  );
}

/** Fill `{{vars}}` in an agent prompt from runtime settings + names. */
export function fillAgentPromptTemplate(
  template: string,
  values: Record<string, string | string[] | undefined>,
): string {
  const cleaned: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value == null) continue;
    cleaned[key] = value;
  }
  return substituteVariables(template, cleaned);
}

export function parseAgentTextRewrite(raw: string): string | null {
  const json = tryParseJsonObject(raw);
  if (!json) return null;
  if (
    json.editNeeded === true &&
    typeof json.editedText === "string" &&
    json.editedText.trim()
  ) {
    return json.editedText.trim();
  }
  return null;
}

export function tryParseJsonObject(
  raw: string,
): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // try fence / first object
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      const parsed = JSON.parse(fenced[1].trim()) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function tryParseJsonValue(raw: string): unknown {
  const obj = tryParseJsonObject(raw);
  if (obj) return obj;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim()) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Format prior tracker / injectable agent state for prompt injection. */
export function formatAgentInjectSections(
  agentState: Record<string, unknown>,
  agents: Array<Pick<Agent, "slug" | "name" | "default_inject_as_section">>,
): string[] {
  const parts: string[] = [];
  for (const agent of agents) {
    if (!agent.default_inject_as_section) continue;
    const value = agentState[agent.slug];
    if (value == null) continue;
    parts.push(
      [
        `<agent_state slug="${agent.slug}" name="${agent.name}">`,
        typeof value === "string" ? value : JSON.stringify(value, null, 2),
        `</agent_state>`,
      ].join("\n"),
    );
  }
  return parts;
}

export function agentAllowedForMode(
  agent: Pick<Agent, "mode_allowlist">,
  mode: string,
): boolean {
  if (!agent.mode_allowlist?.length) return true;
  return agent.mode_allowlist.includes(mode);
}

export function isTextRewriteAgent(
  agent: Pick<Agent, "phase" | "result_type">,
): boolean {
  return (
    agent.phase === "post_processing" && agent.result_type === "text_rewrite"
  );
}
