import type {
  ChatMessage,
  ChatMessageAttachment,
  ChatSettings,
  RoleplayDmSource,
} from "./types";
import {
  DEFAULT_SUMMARY_CONTEXT_SIZE,
  DEFAULT_SUMMARY_RUN_INTERVAL,
} from "./summary/constants";
import {
  clampSummaryMaxTokens,
  clampSummaryRunInterval,
  clampSummaryContextSize,
} from "./summary/runtime";
import { normalizeSummaryTailMessages } from "./summary/hide";
import { activeCharacterIds, normalizeInactiveCharacterIds } from "./active-characters";
import {
  normalizeAutonomousDailyBudget,
  normalizeCharacterSchedules,
  normalizeStatusOverrides,
  type ConversationCommandKey,
} from "./conversation-presence";
import { CONVERSATION_COMMAND_KEYS } from "./conversation-presence";
import {
  normalizeImageAspectRatio,
  normalizeImageResolution,
} from "./image-settings";
import {
  normalizeConnectedInfluences,
  normalizeConnectedNotes,
} from "./connected-chats";
import { normalizeChatGenerationParameters } from "./generation-parameters";

type LegacyChatSettings = Partial<ChatSettings> & {
  /** Migrated to character_ids; still accepted when normalizing old chat JSON. */
  character_id?: string | null;
};

export const DEFAULT_CHAT_HISTORY_DEPTH = 24;
/** Chat-level lorebook retrieval budget (0 = unlimited). */
export const DEFAULT_CHAT_LOREBOOK_TOKEN_BUDGET = 8192;

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
      : "sequential";

  return {
    connection_id: overrides.connection_id ?? null,
    preset_id: overrides.preset_id ?? null,
    character_ids: characterIds,
    inactive_character_ids: normalizeInactiveCharacterIds(
      characterIds,
      overrides.inactive_character_ids,
    ),
    persona_id: overrides.persona_id ?? null,
    lorebook_ids: overrides.lorebook_ids ?? [],
    lorebook_token_budget: normalizeLorebookTokenBudget(
      overrides.lorebook_token_budget,
    ),
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
    group_speaker_tags:
      typeof overrides.group_speaker_tags === "boolean"
        ? overrides.group_speaker_tags
        : false,
    group_speaker_names_in_history:
      typeof overrides.group_speaker_names_in_history === "boolean"
        ? overrides.group_speaker_names_in_history
        : false,
    history_depth: coercePositiveInt(
      overrides.history_depth,
      DEFAULT_CHAT_HISTORY_DEPTH,
      200,
    ),
    context_message_limit: normalizeContextMessageLimit(
      overrides.context_message_limit,
    ),
    exclude_past_reasoning:
      typeof overrides.exclude_past_reasoning === "boolean"
        ? overrides.exclude_past_reasoning
        : true,
    image_captioning_enabled:
      typeof overrides.image_captioning_enabled === "boolean"
        ? overrides.image_captioning_enabled
        : false,
    image_captioning_connection_id:
      typeof overrides.image_captioning_connection_id === "string" &&
      overrides.image_captioning_connection_id.trim()
        ? overrides.image_captioning_connection_id.trim()
        : null,
    chat_parameters: normalizeChatGenerationParameters(overrides.chat_parameters),
    enable_agents:
      typeof overrides.enable_agents === "boolean"
        ? overrides.enable_agents
        : (overrides.agent_ids?.length ?? 0) > 0,
    agent_write_approval_required:
      typeof overrides.agent_write_approval_required === "boolean"
        ? overrides.agent_write_approval_required
        : false,
    manual_trackers:
      typeof overrides.manual_trackers === "boolean"
        ? overrides.manual_trackers
        : false,
    enable_tools:
      typeof overrides.enable_tools === "boolean"
        ? overrides.enable_tools
        : false,
    tool_ids: Array.isArray(overrides.tool_ids)
      ? overrides.tool_ids.filter(
          (id): id is string => typeof id === "string" && id.trim().length > 0,
        )
      : [],
    automatic_summary_enabled:
      typeof overrides.automatic_summary_enabled === "boolean"
        ? overrides.automatic_summary_enabled
        : false,
    summary_run_interval: clampSummaryRunInterval(
      overrides.summary_run_interval ?? DEFAULT_SUMMARY_RUN_INTERVAL,
    ),
    summary_context_size: clampSummaryContextSize(
      overrides.summary_context_size ?? DEFAULT_SUMMARY_CONTEXT_SIZE,
    ),
    summary_max_tokens: clampSummaryMaxTokens(overrides.summary_max_tokens),
    summary_connection_id:
      typeof overrides.summary_connection_id === "string"
        ? overrides.summary_connection_id
        : null,
    hide_summarised_messages:
      typeof overrides.hide_summarised_messages === "boolean"
        ? overrides.hide_summarised_messages
        : false,
    summary_tail_messages: normalizeSummaryTailMessages(
      overrides.summary_tail_messages,
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
    day_rollover_hour: coerceDayRolloverHour(overrides.day_rollover_hour),
    prompt_timezone:
      typeof overrides.prompt_timezone === "string" &&
      overrides.prompt_timezone.trim()
        ? overrides.prompt_timezone.trim()
        : null,
    summary_preset_id:
      typeof overrides.summary_preset_id === "string" &&
      overrides.summary_preset_id.trim()
        ? overrides.summary_preset_id.trim()
        : null,
    autonomous_messages:
      typeof overrides.autonomous_messages === "boolean"
        ? overrides.autonomous_messages
        : false,
    character_exchanges:
      typeof overrides.character_exchanges === "boolean"
        ? overrides.character_exchanges
        : false,
    conversation_schedules_enabled:
      typeof overrides.conversation_schedules_enabled === "boolean"
        ? overrides.conversation_schedules_enabled
        : false,
    character_schedules: normalizeCharacterSchedules(
      overrides.character_schedules,
    ),
    conversation_timezone:
      typeof overrides.conversation_timezone === "string" &&
      overrides.conversation_timezone.trim()
        ? overrides.conversation_timezone.trim()
        : typeof overrides.prompt_timezone === "string" &&
            overrides.prompt_timezone.trim()
          ? overrides.prompt_timezone.trim()
          : null,
    conversation_status_overrides: normalizeStatusOverrides(
      overrides.conversation_status_overrides,
    ),
    autonomous_daily_budget: normalizeAutonomousDailyBudget(
      overrides.autonomous_daily_budget,
    ),
    autonomous_daily_cap_override:
      typeof overrides.autonomous_daily_cap_override === "number" &&
      Number.isFinite(overrides.autonomous_daily_cap_override)
        ? Math.max(0, Math.min(8, Math.floor(overrides.autonomous_daily_cap_override)))
        : null,
    intent_cooldowns: normalizeIntentCooldowns(overrides.intent_cooldowns),
    cross_chat_awareness:
      typeof overrides.cross_chat_awareness === "boolean"
        ? overrides.cross_chat_awareness
        : true,
    conversation_about_me_inject:
      typeof overrides.conversation_about_me_inject === "boolean"
        ? overrides.conversation_about_me_inject
        : true,
    conversation_about_me_overrides: normalizeStringMap(
      overrides.conversation_about_me_overrides,
    ),
    character_commands:
      typeof overrides.character_commands === "boolean"
        ? overrides.character_commands
        : true,
    conversation_command_toggles: normalizeCommandToggles(
      overrides.conversation_command_toggles,
    ),
    enable_memory_recall:
      typeof overrides.enable_memory_recall === "boolean"
        ? overrides.enable_memory_recall
        : true,
    character_memories: normalizeStringListMap(overrides.character_memories),
    image_aspect_ratio: normalizeImageAspectRatio(overrides.image_aspect_ratio),
    image_resolution: normalizeImageResolution(overrides.image_resolution),
    background_image_url:
      typeof overrides.background_image_url === "string" &&
      overrides.background_image_url.trim()
        ? overrides.background_image_url.trim()
        : null,
    connected_pending_influences: normalizeConnectedInfluences(
      overrides.connected_pending_influences,
    ),
    connected_notes: normalizeConnectedNotes(overrides.connected_notes),
  };
}

function normalizeIntentCooldowns(
  value: unknown,
): Record<string, Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, Record<string, string>> = {};
  for (const [charId, intents] of Object.entries(value)) {
    if (!intents || typeof intents !== "object" || Array.isArray(intents)) {
      continue;
    }
    const inner: Record<string, string> = {};
    for (const [key, iso] of Object.entries(intents)) {
      if (typeof iso === "string" && iso) inner[key] = iso;
    }
    if (Object.keys(inner).length) out[charId] = inner;
  }
  return out;
}

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof key === "string" && key && typeof entry === "string") {
      out[key] = entry;
    }
  }
  return out;
}

function normalizeStringListMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!key || !Array.isArray(entry)) continue;
    out[key] = entry.filter((item): item is string => typeof item === "string");
  }
  return out;
}

function normalizeCommandToggles(
  value: unknown,
): Partial<Record<ConversationCommandKey, boolean>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Partial<Record<ConversationCommandKey, boolean>> = {};
  for (const key of CONVERSATION_COMMAND_KEYS) {
    const entry = (value as Record<string, unknown>)[key];
    if (typeof entry === "boolean") out[key] = entry;
  }
  return out;
}

function coerceDayRolloverHour(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.max(0, Math.min(11, Math.floor(parsed)));
}

function normalizeContextMessageLimit(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n < 1) return null;
  return Math.min(9999, n);
}

function normalizeLorebookTokenBudget(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_CHAT_LOREBOOK_TOKEN_BUDGET;
  }
  return Math.max(0, Math.min(100_000, Math.floor(value)));
}

/** Effective history window for prompts (Marinara context limit + legacy depth). */
export function effectiveChatContextLimit(settings: {
  context_message_limit?: number | null;
  history_depth?: number;
}): number {
  if (
    typeof settings.context_message_limit === "number" &&
    Number.isFinite(settings.context_message_limit) &&
    settings.context_message_limit >= 1
  ) {
    return Math.min(9999, Math.floor(settings.context_message_limit));
  }
  return coercePositiveInt(
    settings.history_depth,
    DEFAULT_CHAT_HISTORY_DEPTH,
    200,
  );
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
  settings: Pick<ChatSettings, "character_ids" | "inactive_character_ids">,
): string | null {
  return activeCharacterIds(settings)[0] ?? null;
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
  roleplay_dm_source?: RoleplayDmSource | null;
  attachments?: ChatMessageAttachment[];
}): ChatMessage {
  const swipes = input.swipes?.length ? input.swipes : [input.content];
  const swipeId = Math.min(
    Math.max(input.swipe_id ?? 0, 0),
    Math.max(swipes.length - 1, 0),
  );
  const parentId = input.parent_id ?? null;
  const attachments =
    input.attachments && input.attachments.length > 0
      ? input.attachments
      : undefined;
  return {
    id: input.id ?? cryptoRandomId(),
    role: input.role,
    swipes,
    swipe_id: swipeId,
    thinking: input.thinking ?? null,
    character_id: input.character_id ?? null,
    parent_id: parentId,
    parent_swipe_id: parentId == null ? null : (input.parent_swipe_id ?? 0),
    roleplay_dm_source: input.roleplay_dm_source ?? null,
    created_at: input.created_at ?? new Date().toISOString(),
    ...(attachments
      ? {
          attachments_by_swipe: Array.from({ length: swipes.length }, (_, index) =>
            index === swipeId ? attachments : [],
          ),
        }
      : {}),
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
