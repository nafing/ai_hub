import { Column, Entity, PrimaryColumn } from "typeorm";
import type { TwatterAuthorSnapshot } from "@ai-hub/shared";

@Entity("twatter_interactions")
export class TwatterInteractionEntity {
  @PrimaryColumn("text")
  id!: string;

  @Column("text")
  actor_account_id!: string;

  @Column("text")
  post_id!: string;

  @Column("text")
  type!: "like" | "repost" | "reply" | "vote";

  @Column("text", { nullable: true })
  content!: string | null;

  @Column("text", { nullable: true })
  parent_interaction_id!: string | null;

  @Column("simple-json", { nullable: true })
  actor_snapshot!: TwatterAuthorSnapshot | null;

  @Column("text")
  created_at!: string;

  @Column("text")
  updated_at!: string;
}
