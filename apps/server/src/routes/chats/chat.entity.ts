import { Column, Entity, PrimaryColumn } from "typeorm";
import type { ChatMessage, ChatMode, ChatSettings } from "@ai-hub/shared";

@Entity("chats")
export class ChatEntity {
  @PrimaryColumn("text")
  id!: string;

  @Column("text", { default: "" })
  title!: string;

  @Column("text")
  mode!: ChatMode;

  @Column("simple-json")
  settings!: ChatSettings;

  @Column("simple-json")
  messages!: ChatMessage[];

  @Column("text", { default: "" })
  summary!: string;

  @Column("simple-json")
  summary_entries!: import("@ai-hub/shared").ChatSummaryEntry[];

  @Column("text", { nullable: true })
  last_automatic_summary_message_id!: string | null;

  @Column("simple-json", { default: {} })
  day_summaries!: Record<string, import("@ai-hub/shared").DaySummaryEntry>;

  @Column("simple-json", { default: {} })
  week_summaries!: Record<string, import("@ai-hub/shared").WeekSummaryEntry>;

  @Column("simple-json", { default: { days: {}, weeks: {} } })
  conversation_summary_failures!: {
    days: Record<string, unknown>;
    weeks: Record<string, unknown>;
  };

  @Column("simple-json", { default: [] })
  memory_chunks!: import("@ai-hub/shared").ChatMemoryChunk[];

  @Column("simple-json")
  agent_state!: Record<string, unknown>;

  /** Parent chat when this row is a character DM; null for root chats. */
  @Column("text", { nullable: true })
  parent_chat_id!: string | null;

  /**
   * Bidirectional Conversation ↔ Roleplay partner ids.
   * Replaces legacy single `connected_chat_id`.
   */
  @Column("simple-json", { default: [] })
  connected_chat_ids!: string[];

  /**
   * @deprecated Prefer `connected_chat_ids`. Kept for migrate-on-read.
   */
  @Column("text", { nullable: true })
  connected_chat_id!: string | null;

  @Column("text")
  created_at!: string;

  @Column("text")
  updated_at!: string;
}
