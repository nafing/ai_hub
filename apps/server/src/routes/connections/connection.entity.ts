import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("connections")
export class ConnectionEntity {
  @PrimaryColumn("text")
  id!: string;

  @Column("text")
  name!: string;

  @Column("text", { default: "llm" })
  kind!: string;

  @Column("text", { default: "" })
  preferred_provider!: string;

  @Column("text", { default: "" })
  api_key!: string;

  @Column("text", { default: "" })
  model!: string;

  @Column("integer", { default: 1 })
  max_parallel_jobs!: number;

  @Column("integer", { default: 4096 })
  max_completion_tokens!: number;

  @Column("real", { default: 1 })
  temperature!: number;

  @Column("integer", { default: 128000 })
  context_length!: number;

  @Column("real", { default: 1 })
  top_p!: number;

  @Column("integer", { default: 0 })
  top_k!: number;

  @Column("real", { default: 0 })
  frequency_penalty!: number;

  @Column("real", { default: 0 })
  presence_penalty!: number;

  @Column("text", { default: "" })
  assistant_prefill!: string;

  @Column("text", { default: "" })
  thinking_tag!: string;

  @Column("simple-json", { default: "{}" })
  custom_parameters!: Record<string, unknown>;

  @Column("text", { default: "" })
  service_tier!: string;

  @Column("text", { default: "" })
  reasoning_effort!: string;

  @Column("text", { default: "" })
  verbosity!: string;

  @Column("boolean", { default: false })
  prompt_caching!: boolean;

  @Column("boolean", { default: false })
  is_default!: boolean;
}
