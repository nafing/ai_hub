import type { Variable } from "../presets/types";
import type {
  Chat,
  ChatMessage,
  ChatMessageAttachment,
  ChatMode,
  ChatSettings,
  RoleplayDmSource,
} from "./types";

export type CreateChatInput = {
  mode: ChatMode;
  title?: string;
  settings?: Partial<ChatSettings>;
  /** When set, seed roleplay greeting from this alternate greeting index (0 = first_mes). */
  greeting_index?: number;
  /** Link this chat as a side DM / child of another chat. */
  parent_chat_id?: string | null;
  /** Skip first_mes / alternate_greetings seeding (e.g. empty DM threads). */
  skip_greeting?: boolean;
};

export type UpdateChatInput = {
  title?: string;
  settings?: Partial<ChatSettings>;
  summary?: string;
  agent_state?: Record<string, unknown>;
};

export type CreateChatMessageInput = {
  role?: "user" | "assistant" | "system";
  content: string;
  /** Speaker for assistant messages (e.g. `/as Character "line"`). */
  character_id?: string | null;
  /** Marinara-style mirror dedupe when copying roleplay user turns into DM threads. */
  roleplay_dm_source?: RoleplayDmSource | null;
  /** Previously uploaded chat attachments to store on this message. */
  attachments?: ChatMessageAttachment[];
};

export type UpdateChatMessageInput = {
  /** Replace active swipe text */
  content?: string;
  swipe_id?: number;
  thinking?: string | null;
  /**
   * Remove the currently active swipe.
   * If it was the last swipe, the message is deleted.
   */
  remove_active_swipe?: boolean;
  /** Append a reaction emoji chip (user or manual). */
  add_reaction?: string;
};

export type GenerateChatInput = {
  /** When provided, appended as a user message before generation */
  userMessage?: string;
  /** Attachments to store on the new user message (upload first via POST attachments). */
  attachments?: ChatMessageAttachment[];
  /**
   * Force generation for this character only (Trigger Response).
   * Skips Smart selector and Manual empty-queue rules.
   */
  forCharacterId?: string;
  /** Ephemeral instruction injected into the prompt (not stored as a chat message). */
  generationGuide?: string;
  /** Force an impersonate (user persona) turn. */
  impersonate?: boolean;
  /**
   * Continue / regenerate by appending a swipe on this assistant message
   * (used by `/continue`).
   */
  continueMessageId?: string;
  /**
   * When true and Narrative Director is selected, run it in pre_generation
   * and inject its direction into the main prompt.
   */
  runDirector?: boolean;
  /** Autonomous poller turn (conversation messenger). */
  autonomous?: boolean;
  /** Optional intent key for autonomous cooldown bookkeeping. */
  autonomous_intent_key?: string;
  /** Client already waited for busy-delay; skip server presence delay. */
  skip_presence_delay?: boolean;
};

/** Force-generate an image and attach it to an assistant message swipe. */
export type GenerateChatImageInput = {
  /** Target assistant message (default: latest visible assistant). */
  messageId?: string;
  /** Optional visual brief; defaults to a casual selfie prompt. */
  prompt?: string;
  /** Override speaker for appearance (default: message.character_id). */
  characterId?: string;
};

export type ChatListItem = Pick<
  Chat,
  "id" | "title" | "mode" | "created_at" | "updated_at" | "connected_chat_id"
> & {
  message_count: number;
  preview: string | null;
  /** Present when this is a character DM spawned from another chat. */
  parent_chat_id?: string | null;
};

export type ChatStreamEvent =
  | { type: "user_message"; message: ChatMessage }
  | {
      type: "turn_start";
      character_id: string | null;
      character_name: string;
    }
  | { type: "thinking"; delta: string }
  | { type: "delta"; delta: string }
  | {
      type: "agent_phase";
      phase: "pre_generation" | "parallel" | "post_processing";
      slug: string;
      name: string;
    }
  | {
      type: "agent_done";
      phase: "pre_generation" | "parallel" | "post_processing";
      slug: string;
      name: string;
      error?: string;
    }
  | { type: "needs_preset_variables"; presetId: string; variables: Variable[] }
  | {
      type: "chat_summary";
      chat: Chat;
      entry_id: string;
    }
  | { type: "error"; message: string }
  | {
      type: "roleplay_dm";
      action: "posted" | "created";
      chat_id: string;
      chat_title: string;
      character_id: string;
      character_name: string;
    }
  | {
      type: "conversation_command";
      command:
        | "react"
        | "schedule_update"
        | "memory"
        | "cross_post"
        | "send_image"
        | "influence"
        | "note";
      character_id?: string | null;
      detail?: string;
      chat_id?: string;
      /** Target message for react commands. */
      message_id?: string;
    }
  | {
      type: "done";
      message: ChatMessage;
      chat: Chat;
    };

/** Lore entry selected for a turn (constant / keyword). */
export type PeekPromptLoreHit = {
  lorebook_id: string;
  lorebook_name: string;
  entry_name: string;
  source: "constant" | "keyword";
  score: number;
  preview: string;
};

/** Prompt preview for a chat turn (Peek Prompt). */
export type PeekPromptResult = {
  messages: Array<{ role: string; content: string }>;
  character_id: string | null;
  character_name: string;
  /** Lore retrieval hits that survived token budget. */
  lore_hits: PeekPromptLoreHit[];
  /** Rough token estimate of injected lore content. */
  lore_token_estimate: number;
  /**
   * Raw conversation command tags from the peeked assistant swipe
   * (e.g. `[send_image:…]`) — always shown even when stripped from chat text.
   */
  command_tags?: string[];
  /** Image prompts used for attachments on the peeked swipe. */
  image_prompts?: Array<{
    name: string;
    prompt: string;
    command?: string;
  }>;
};
