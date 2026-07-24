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
  /** Preset variable overrides */
  variables: Record<string, string>;
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
  created_at: string;
  updated_at: string;
};
