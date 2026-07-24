import type { Chat, ChatMessage, ChatMode, ChatSettings } from "./types";

export type CreateChatInput = {
  mode: ChatMode;
  title?: string;
  settings?: Partial<ChatSettings>;
  /** When set, seed roleplay greeting from this alternate greeting index (0 = first_mes). */
  greeting_index?: number;
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
};

export type GenerateChatInput = {
  /** When provided, appended as a user message before generation */
  userMessage?: string;
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
};

export type ChatListItem = Pick<
  Chat,
  "id" | "title" | "mode" | "created_at" | "updated_at"
> & {
  message_count: number;
  /** Primary character (first in settings.character_ids), if any */
  character_id: string | null;
  character_ids: string[];
  preview: string | null;
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
  | { type: "error"; message: string }
  | {
      type: "done";
      message: ChatMessage;
      chat: Chat;
    };

/** Prompt preview for a chat turn (Peek Prompt). */
export type PeekPromptResult = {
  messages: Array<{ role: string; content: string }>;
  character_id: string | null;
  character_name: string;
};
