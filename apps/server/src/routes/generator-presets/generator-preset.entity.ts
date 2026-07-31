import { Column, Entity, PrimaryColumn } from "typeorm";
import type { GeneratorCategory } from "@ai-hub/shared";

@Entity("generator_presets")
export class GeneratorPresetEntity {
  @PrimaryColumn("text")
  id!: string;

  @Column("text")
  name!: string;

  @Column("text", { default: "" })
  description!: string;

  @Column("text", { default: "" })
  author!: string;

  @Column("text", { default: "character_generator" })
  category!: GeneratorCategory;

  @Column("text", { default: "" })
  prompt!: string;

  @Column("text", { default: "" })
  prompt_create!: string;

  @Column("text", { default: "" })
  prompt_import!: string;

  @Column("text", { default: "" })
  prompt_regenerate!: string;

  @Column("text", { default: "" })
  prompt_rebuild!: string;

  @Column("text", { nullable: true })
  preset_id!: string | null;

  @Column("boolean", { default: false })
  is_default!: boolean;
}
