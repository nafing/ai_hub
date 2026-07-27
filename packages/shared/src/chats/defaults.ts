import type { ChatMessage, ChatSettings } from "./types";

type LegacyChatSettings = Partial<ChatSettings> & {
  /** Migrated to character_ids; still accepted when normalizing old chat JSON. */
  character_id?: string | null;
};

export const DEFAULT_CHAT_HISTORY_DEPTH = 24;
export const DEFAULT_CHAT_MEMORY_TOP_K = 8;
export const DEFAULT_CHAT_MEMORY_TOKEN_BUDGET = 1024;

function coercePositiveInt(
  value: unknown,
  fallback: number,
  max = 500,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

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
    agent_settings:
      overrides.agent_settings &&
      typeof overrides.agent_settings === "object" &&
      !Array.isArray(overrides.agent_settings)
        ? overrides.agent_settings
        : {},
    variables: overrides.variables ?? {},
    group_mode: groupMode,
    response_order: responseOrder,
    add_turn_to_prompt: overrides.add_turn_to_prompt ?? true,
    scenario_override:
      typeof overrides.scenario_override === "string"
        ? overrides.scenario_override
        : "",
    memory_enabled:
      typeof overrides.memory_enabled === "boolean"
        ? overrides.memory_enabled
        : true,
    history_depth: coercePositiveInt(
      overrides.history_depth,
      DEFAULT_CHAT_HISTORY_DEPTH,
      200,
    ),
    memory_top_k: coercePositiveInt(
      overrides.memory_top_k,
      DEFAULT_CHAT_MEMORY_TOP_K,
      50,
    ),
    memory_token_budget: coercePositiveInt(
      overrides.memory_token_budget,
      DEFAULT_CHAT_MEMORY_TOKEN_BUDGET,
      8000,
    ),
    allow_twatter_references:
      typeof overrides.allow_twatter_references === "boolean"
        ? overrides.allow_twatter_references
        : false,
    allow_character_dms:
      typeof overrides.allow_character_dms === "boolean"
        ? overrides.allow_character_dms
        : false,
    character_dm_chat_ids: normalizeCharacterDmChatIds(
      overrides.character_dm_chat_ids,
    ),
  };
}

function normalizeCharacterDmChatIds(
  value: unknown,
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof key === "string" && key && typeof entry === "string" && entry) {
      out[key] = entry;
    }
  }
  return out;
}

export function primaryCharacterId(
  settings: Pick<ChatSettings, "character_ids">,
): string | null {
  return settings.character_ids[0] ?? null;
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
  parent_id?: string | null;
  parent_swipe_id?: number | null;
}): ChatMessage {
  const swipes = input.swipes?.length ? input.swipes : [input.content];
  const swipeId = Math.min(
    Math.max(input.swipe_id ?? 0, 0),
    Math.max(swipes.length - 1, 0),
  );
  const parentId = input.parent_id ?? null;
  return {
    id: input.id ?? cryptoRandomId(),
    role: input.role,
    swipes,
    swipe_id: swipeId,
    thinking: input.thinking ?? null,
    character_id: input.character_id ?? null,
    parent_id: parentId,
    parent_swipe_id: parentId == null ? null : (input.parent_swipe_id ?? 0),
    created_at: input.created_at ?? new Date().toISOString(),
  };
}

/** Prefer `crypto.randomUUID` when available (browser + Node 19+). */
function cryptoRandomId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // insecure context (e.g. phone via LAN HTTP)
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
