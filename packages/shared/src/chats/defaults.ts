import type { CreateChatInput } from "./api";
import type { ChatMessage, ChatSettings } from "./types";

type LegacyChatSettings = Partial<ChatSettings> & {
  /** @deprecated migrated to character_ids */
  character_id?: string | null;
};

/** Normalize settings, including legacy single `character_id`. */
export function defaultChatSettings(
  overrides: LegacyChatSettings = {},
): ChatSettings {
  const fromLegacy =
    typeof overrides.character_id === "string" && overrides.character_id
      ? [overrides.character_id]
      : [];
  const characterIds = overrides.character_ids?.length
    ? overrides.character_ids.filter(Boolean)
    : fromLegacy;

  const groupMode =
    overrides.group_mode === "individual" || overrides.group_mode === "merged"
      ? overrides.group_mode
      : "merged";
  const responseOrder =
    overrides.response_order === "sequential" ||
    overrides.response_order === "smart" ||
    overrides.response_order === "manual"
      ? overrides.response_order
      : "smart";

  return {
    connection_id: overrides.connection_id ?? null,
    preset_id: overrides.preset_id ?? null,
    character_ids: characterIds,
    persona_id: overrides.persona_id ?? null,
    lorebook_ids: overrides.lorebook_ids ?? [],
    agent_ids: overrides.agent_ids ?? [],
    variables: overrides.variables ?? {},
    group_mode: groupMode,
    response_order: responseOrder,
    add_turn_to_prompt: overrides.add_turn_to_prompt ?? true,
    scenario_override:
      typeof overrides.scenario_override === "string"
        ? overrides.scenario_override
        : "",
  };
}

export function primaryCharacterId(
  settings: Pick<ChatSettings, "character_ids">,
): string | null {
  return settings.character_ids[0] ?? null;
}

export function defaultChatCreateInput(
  overrides: Partial<CreateChatInput> = {},
): CreateChatInput {
  return {
    mode: overrides.mode ?? "roleplay",
    title: overrides.title ?? "",
    settings: defaultChatSettings(overrides.settings),
    greeting_index: overrides.greeting_index,
  };
}

export function createChatMessage(input: {
  role: ChatMessage["role"];
  content: string;
  id?: string;
  thinking?: string | null;
  character_id?: string | null;
  created_at?: string;
  /** When set, seeds swipe branches (e.g. first_mes + alternate_greetings). */
  swipes?: string[];
  swipe_id?: number;
}): ChatMessage {
  const swipes = input.swipes?.length ? input.swipes : [input.content];
  const swipeId = Math.min(
    Math.max(input.swipe_id ?? 0, 0),
    Math.max(swipes.length - 1, 0),
  );
  return {
    id: input.id ?? cryptoRandomId(),
    role: input.role,
    swipes,
    swipe_id: swipeId,
    thinking: input.thinking ?? null,
    character_id: input.character_id ?? null,
    created_at: input.created_at ?? new Date().toISOString(),
  };
}

/** Prefer `crypto.randomUUID` when available (browser + Node 19+). */
function cryptoRandomId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
