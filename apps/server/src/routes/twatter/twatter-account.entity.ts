import { Column, Entity, PrimaryColumn } from "typeorm";
import type { TwatterAccountSettings } from "@ai-hub/shared";

@Entity("twatter_accounts")
export class TwatterAccountEntity {
  @PrimaryColumn("text")
  id!: string;

  @Column("text")
  kind!: "persona" | "character" | "random_user";

  @Column("text")
  entity_id!: string;

  @Column("text")
  handle!: string;

  @Column("text", { default: "" })
  display_name!: string;

  @Column("text", { default: "" })
  bio!: string;

  @Column("text", { nullable: true })
  avatar!: string | null;

  @Column("boolean", { default: false })
  invited!: boolean;

  @Column("simple-json")
  settings!: TwatterAccountSettings;

  @Column("text")
  created_at!: string;

  @Column("text")
  updated_at!: string;
}
