import { Column, Entity, PrimaryColumn } from "typeorm";
import type { LorebookCategory, LorebookEntry } from "@ai-hub/shared";

@Entity("lorebooks")
export class LorebookEntity {
  @PrimaryColumn("text")
  id!: string;

  @Column("text", { default: "" })
  name!: string;

  @Column("text", { default: "" })
  description!: string;

  @Column("boolean", { default: true })
  enabled!: boolean;

  @Column("boolean", { default: false })
  global!: boolean;

  @Column("text", { default: "uncategorized" })
  category!: LorebookCategory;

  @Column("simple-json", { default: "[]" })
  linked_characters!: string[];

  @Column("simple-json", { default: "[]" })
  linked_personas!: string[];

  @Column({ type: "integer", nullable: true, default: 2 })
  scan_depth!: number | null;

  @Column({ type: "integer", nullable: true, default: 2048 })
  token_budget!: number | null;

  @Column("boolean", { default: false })
  recursive_scanning!: boolean;

  @Column("simple-json", { default: "{}" })
  extensions!: Record<string, unknown>;

  @Column("simple-json", { default: "[]" })
  entries!: LorebookEntry[];

  /** True when LanceDB index may be stale for this lorebook. */
  @Column("boolean", { default: true })
  index_dirty!: boolean;
}
