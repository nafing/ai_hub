import { Column, Entity, PrimaryColumn } from "typeorm";
import type {
  AgentCategory,
  AgentExecution,
  AgentPhase,
  AgentPromptTemplate,
  AgentResultType,
} from "@ai-hub/shared";

@Entity("agents")
export class AgentEntity {
  @PrimaryColumn("text")
  id!: string;

  @Column("text", { unique: true })
  slug!: string;

  @Column("text")
  name!: string;

  @Column("text", { default: "" })
  description!: string;

  @Column("text", { default: "" })
  author!: string;

  @Column("text", { default: "post_processing" })
  phase!: AgentPhase;

  @Column("text", { default: "misc" })
  category!: AgentCategory;

  @Column("boolean", { default: false })
  enabled_by_default!: boolean;

  @Column("simple-json", { default: "[]" })
  default_tools!: string[];

  @Column("text", { default: "" })
  default_prompt_template!: string;

  @Column("simple-json", { default: "{}" })
  default_settings!: Record<string, unknown>;

  @Column("simple-json", { default: "[]" })
  mode_allowlist!: string[];

  @Column("text", { nullable: true })
  result_type!: AgentResultType | null;

  @Column("boolean", { default: false })
  default_inject_as_section!: boolean;

  @Column("integer", { nullable: true })
  run_interval!: number | null;

  @Column("simple-json", { default: "[]" })
  prompt_templates!: AgentPromptTemplate[];

  @Column("boolean", { default: false })
  runtime_disabled!: boolean;

  @Column("text", { default: "llm" })
  execution!: AgentExecution;

  @Column("boolean", { default: false })
  is_built_in!: boolean;
}
