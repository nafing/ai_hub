import { Column, Entity, PrimaryColumn } from "typeorm";
import type {
  RegexApplyTo,
  RegexScope,
  RegexTarget,
} from "@ai-hub/shared";

@Entity("regex_scripts")
export class RegexScriptEntity {
  @PrimaryColumn("text")
  id!: string;

  @Column("text")
  name!: string;

  @Column("boolean", { default: true })
  enabled!: boolean;

  @Column("text", { default: "" })
  find_regex!: string;

  @Column("text", { default: "" })
  replace_with!: string;

  @Column("text", { default: "g" })
  flags!: string;

  @Column("simple-json", { default: '["ai_output"]' })
  targets!: RegexTarget[];

  @Column("text", { default: "both" })
  apply_to!: RegexApplyTo;

  @Column("integer", { default: 100 })
  order!: number;

  @Column({ type: "integer", nullable: true })
  min_depth!: number | null;

  @Column({ type: "integer", nullable: true })
  max_depth!: number | null;

  @Column("text", { default: "global" })
  scope!: RegexScope;

  @Column("simple-json", { default: "[]" })
  character_ids!: string[];
}
