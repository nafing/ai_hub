import type { PresetVariableValues } from "../presets/build-prompt";

export const CHAT_MODES = ["roleplay", "conversation"] as const;

export type ChatMode = (typeof CHAT_MODES)[number];

export const CHAT_MODE_LABELS: Record<ChatMode, string> = {
  roleplay: "Roleplay",
  conversation: "Conversation",
};

export type ChatMessageRole = "user" | "assistant" | "system";

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
};

export const GROUP_CHAT_MODES = ["merged", "individual"] as const;
export type GroupChatMode = (typeof GROUP_CHAT_MODES)[number];

export const GROUP_RESPONSE_ORDERS = ["sequential", "smart", "manual"] as const;
export type GroupResponseOrder = (typeof GROUP_RESPONSE_ORDERS)[number];

export const GROUP_CHAT_MODE_LABELS: Record<GroupChatMode, string> = {
  merged: "Merged",
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
   * When true, older messages are embedded and retrieved into chat_summary.
   * Recent turns still go into chat_history via history_depth.
   */
  memory_enabled: boolean;
  /** How many recent messages stay in the full chat_history marker. */
  history_depth: number;
  /** Max vector-retrieved older messages injected as memory. */
  memory_top_k: number;
  /** Soft token budget for retrieved memory text. */
  memory_token_budget: number;
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
};

export type Chat = {
  id: string;
  title: string;
  mode: ChatMode;
  settings: ChatSettings;
  messages: ChatMessage[];
  summary: string;
  /** Tracker / agent JSON keyed by agent slug */
  agent_state: Record<string, unknown>;
  /** Parent roleplay/group chat when this is a character DM; null for root chats. */
  parent_chat_id: string | null;
  created_at: string;
  updated_at: string;
};
