import { Column, Entity, PrimaryColumn } from "typeorm";
import type { TwatterAuthorSnapshot } from "@ai-hub/shared";

@Entity("twatter_timeline_posts")
export class TwatterPostEntity {
  @PrimaryColumn("text")
  id!: string;

  @Column("text")
  author_account_id!: string;

  @Column("text")
  content!: string;

  @Column("text", { nullable: true })
  image_url!: string | null;

  @Column("text", { nullable: true })
  parent_post_id!: string | null;

  @Column("text", { nullable: true })
  quote_post_id!: string | null;

  @Column("text", { default: "manual" })
  source!: "manual" | "generated";

  @Column("simple-json", { default: "{}" })
  metadata!: Record<string, unknown>;

  @Column("simple-json", { nullable: true })
  author_snapshot!: TwatterAuthorSnapshot | null;

  @Column("text")
  created_at!: string;

  @Column("text")
  updated_at!: string;
}
