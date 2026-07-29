import type { PresetVariableValues } from "../presets/build-prompt";
import type { ChatSummaryEntry } from "./summary/types";
import type {
  ConversationSummaryFailures,
  DaySummaryEntry,
  WeekSummaryEntry,
} from "./conversation-summary/types";
import type {
  AutonomousDailyBudget,
  CharacterSchedules,
  ConversationCommandKey,
  ConversationStatusOverride,
} from "./conversation-presence";

export const CHAT_MODES = ["roleplay", "conversation"] as const;

export type ChatMode = (typeof CHAT_MODES)[number];

export const CHAT_MODE_LABELS: Record<ChatMode, string> = {
  roleplay: "Roleplay",
  conversation: "Conversation",
};

export type ChatMessageRole = "user" | "assistant" | "system";

export type RoleplayDmSource = {
  source_chat_id: string;
  source_user_message_id: string;
  target_character_id?: string;
};

/** File/image attached to a chat message (stored under the chat). */
export type ChatMessageAttachment = {
  id: string;
  /** `image` when mime is an image/* the UI can preview; otherwise `file`. */
  kind: "image" | "file";
  mime: string;
  /** Public API path, e.g. `/chats/:chatId/attachments/:id`. */
  url: string;
  name: string;
  size?: number;
  /** Final prompt sent to the image model (generated attachments). */
  prompt?: string;
  /** Original `[send_image:…]` tag that produced this attachment. */
  source_command?: string;
};

/**
 * Persisted chat turn. Active text is `swipes[swipe_id]`.
 * Distinct from LLM `ChatMessage` (`{ role, content }`).
 */
export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  swipes: string[];
  swipe_id: number;
  thinking?: string | null;
  /** Character that spoke this turn (assistant); null for user/system. */
  character_id?: string | null;
  /**
   * Parent message this turn continues from (`null` for the root).
   * Together with `parent_swipe_id`, defines swipe branches: regenerating or
   * changing a swipe hides children created under other swipes.
   */
  parent_id: string | null;
  /** Which swipe of `parent_id` this message was created under. */
  parent_swipe_id: number | null;
  created_at: string;
  /**
   * When this message was mirrored from a roleplay chat into a DM thread
   * (Marinara-style dedupe metadata).
   */
  roleplay_dm_source?: RoleplayDmSource | null;
  /** When true, excluded from LLM prompt history (summary hide or manual). */
  hidden_from_prompt?: boolean;
  /** Conversation message reaction chips. */
  reactions?: Array<{
    emoji: string;
    character_id?: string | null;
    created_at: string;
  }>;
  /**
   * Attachments per swipe (parallel to `swipes`). Prefer this over legacy
   * flat `attachments` so regenerate branches do not share images.
   */
  attachments_by_swipe?: ChatMessageAttachment[][];
  /**
   * Legacy flat attachments for the whole message. Treated as swipe 0 only
   * when `attachments_by_swipe` is absent.
   */
  attachments?: ChatMessageAttachment[];
  /**
   * Raw conversation command tags stripped from visible text, per swipe.
   * Shown in Peek Prompt — not injected into LLM history.
   */
  command_tags_by_swipe?: string[][];
};

export const GROUP_CHAT_MODES = ["merged", "individual"] as const;
export type GroupChatMode = (typeof GROUP_CHAT_MODES)[number];

export const GROUP_RESPONSE_ORDERS = ["sequential", "smart", "manual"] as const;
export type GroupResponseOrder = (typeof GROUP_RESPONSE_ORDERS)[number];

export const GROUP_CHAT_MODE_LABELS: Record<GroupChatMode, string> = {
  merged: "Merged (Narrator)",
  individual: "Individual",
};

export const GROUP_RESPONSE_ORDER_LABELS: Record<GroupResponseOrder, string> = {
  sequential: "Sequential",
  smart: "Smart",
  manual: "Manual",
};

/** Per-agent overrides stored on chat settings. */
export type ChatAgentSetting = {
  prompt_template_id?: string | null;
  settings?: Record<string, unknown>;
  /** Override agent.run_interval for this chat (null = use agent default). */
  run_interval?: number | null;
};

export type ChatAgentSettingsMap = Record<string, ChatAgentSetting>;

export type ChatSettings = {
  /** null → default connection */
  connection_id: string | null;
  /** null → default preset for chat mode */
  preset_id: string | null;
  /**
   * Characters in this chat (ordered).
   * First is primary (`{{char}}`, greeting, dialogue examples).
   * Required non-empty for roleplay on create.
   */
  character_ids: string[];
  /**
   * Group chat members temporarily excluded from prompts and replies.
   * If every member is listed here, all are treated as active (Marinara fallback).
   */
  inactive_character_ids: string[];
  /** null → default persona */
  persona_id: string | null;
  lorebook_ids: string[];
  agent_ids: string[];
  /** Per-agent overrides keyed by agent id or slug. */
  agent_settings: ChatAgentSettingsMap;
  /** Preset variable overrides for this chat (`{{name}}` values). */
  variables: PresetVariableValues;
  /**
   * Multi-character reply style (used when character_ids.length > 1).
   * Merged = one reply for all; Individual = per-character generations.
   */
  group_mode: GroupChatMode;
  /** Who speaks next when group_mode is individual. */
  response_order: GroupResponseOrder;
  /** When true, Individual turns append "Respond ONLY as {name}." */
  add_turn_to_prompt: boolean;
  /**
   * Group chat scenario override. When non-empty, replaces each character's
   * card scenario in the prompt.
   */
  scenario_override: string;
  /**
   * Merged group roleplay: wrap dialogue in <speaker="name"> tags (Marinara Color Dialogues).
   * Conversation group chats enable this automatically.
   */
  group_speaker_tags: boolean;
  /**
   * Individual group roleplay: prefix chat history turns with the speaker name.
   * Marinara default is off.
   */
  group_speaker_names_in_history: boolean;
  /** How many recent messages stay in the full chat_history marker. */
  history_depth: number;
  /** When true, run rolling summary after enough user turns (roleplay). */
  automatic_summary_enabled: boolean;
  /** User messages between automatic summary runs. */
  summary_run_interval: number;
  /** Messages included in each summary generation window. */
  summary_context_size: number;
  /** Max output tokens for summary LLM calls. */
  summary_max_tokens: number;
  /** Optional dedicated connection for summaries; null → chat/default connection. */
  summary_connection_id: string | null;
  /** Preset used for rolling roleplay summaries; null → default `chat_summary` preset. */
  summary_preset_id: string | null;
  /**
   * When true, summarized messages are hidden from the prompt except the
   * most-recent `summary_tail_messages` in each batch.
   */
  hide_summarised_messages: boolean;
  /** Recent messages kept visible when hide_summarised_messages is enabled. */
  summary_tail_messages: number;
  /**
   * When true, this chat may pull Twatter posts/feeds into prompts / agents.
   */
  allow_twatter_references: boolean;
  /**
   * When true, characters in this chat may open / participate in side DMs.
   */
  allow_character_dms: boolean;
  /**
   * Map of character id → conversation DM chat id spawned from this chat.
   */
  character_dm_chat_ids: Record<string, string>;
  /** Hour (0–11) when a conversation day rolls over for day summaries. */
  day_rollover_hour: number;
  /** Optional IANA timezone for conversation day bucketing. */
  prompt_timezone: string | null;
  /** Conversation: characters may message unprompted while the chat is open. */
  autonomous_messages: boolean;
  /** Conversation group: characters may reply to each other after autonomous turns. */
  character_exchanges: boolean;
  /** Conversation: use weekly schedules for presence / delays. */
  conversation_schedules_enabled: boolean;
  /** Per-character week schedules. */
  character_schedules: CharacterSchedules;
  /** Alias timezone for presence schedules (falls back to prompt_timezone). */
  conversation_timezone: string | null;
  /** Manual presence overrides keyed by character id. */
  conversation_status_overrides: Record<string, ConversationStatusOverride>;
  /** Rolled daily autonomous message counters. */
  autonomous_daily_budget: AutonomousDailyBudget;
  /** Optional chat-level autonomous daily cap. */
  autonomous_daily_cap_override: number | null;
  /** Per-character per-intent cooldown ISO timestamps. */
  intent_cooldowns: Record<string, Record<string, string>>;
  /** Inject cross-chat awareness blocks for shared characters. */
  cross_chat_awareness: boolean;
  /** Inject About Me bios into conversation prompts. */
  conversation_about_me_inject: boolean;
  /** Chat-scoped About Me overrides keyed by character/persona id. */
  conversation_about_me_overrides: Record<string, string>;
  /** Master switch for hidden conversation commands. */
  character_commands: boolean;
  /** Per-command enable map (missing key = enabled). */
  conversation_command_toggles: Partial<
    Record<ConversationCommandKey, boolean>
  >;
  /** Vector memory recall for conversation (no-ops without embeddings). */
  enable_memory_recall: boolean;
  /** Durable facts recorded via [memory] commands, keyed by character id. */
  character_memories: Record<string, string[]>;
  /** Aspect ratio for character [send_image] generations. */
  image_aspect_ratio: string;
  /** Resolution tier for character [send_image] generations. */
  image_resolution: string;
  /**
   * Chat stage background — API path to a character gallery image
   * (e.g. `/characters/{id}/gallery/{imageId}`), or null for default stage.
   */
  background_image_url: string | null;
};

export type Chat = {
  id: string;
  title: string;
  mode: ChatMode;
  settings: ChatSettings;
  messages: ChatMessage[];
  summary: string;
  summary_entries: ChatSummaryEntry[];
  /** Anchor for automatic summary cadence (last assistant message id). */
  last_automatic_summary_message_id: string | null;
  /** Conversation mode: per-day summary blocks keyed DD.MM.YYYY. */
  day_summaries: Record<string, DaySummaryEntry>;
  /** Conversation mode: weekly consolidations keyed by Monday DD.MM.YYYY. */
  week_summaries: Record<string, WeekSummaryEntry>;
  /** Retry bookkeeping for conversation auto-summaries. */
  conversation_summary_failures: ConversationSummaryFailures;
  /** Tracker / agent JSON keyed by agent slug */
  agent_state: Record<string, unknown>;
  /** Parent roleplay/group chat when this is a character DM; null for root chats. */
  parent_chat_id: string | null;
  created_at: string;
  updated_at: string;
};
