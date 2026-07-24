import { Column, Entity, PrimaryColumn } from "typeorm";
import type {
  PresetCategory,
  Section,
  Variable,
  WrapFormat,
} from "@ai-hub/shared";

@Entity("presets")
export class PresetEntity {
  @PrimaryColumn("text")
  id!: string;

  @Column("text")
  name!: string;

  @Column("text", { default: "" })
  description!: string;

  @Column("text", { default: "xml" })
  wrap_format!: WrapFormat;

  @Column("text", { default: "roleplay" })
  category!: PresetCategory;

  @Column("boolean", { default: false })
  is_default!: boolean;

  @Column("text", { default: "" })
  author!: string;

  @Column("simple-json", { default: "[]" })
  groups!: string[];

  @Column("simple-json", { default: "[]" })
  sections!: Section[];

  @Column("simple-json", { default: "[]" })
  variables!: Variable[];
}
