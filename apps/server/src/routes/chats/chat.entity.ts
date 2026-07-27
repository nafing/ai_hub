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
  agent_state!: Record<string, unknown>;

  /** Parent chat when this row is a character DM; null for root chats. */
  @Column("text", { nullable: true })
  parent_chat_id!: string | null;

  @Column("text")
  created_at!: string;

  @Column("text")
  updated_at!: string;
}
