import { Column, Entity, PrimaryColumn } from "typeorm";
import type { ToolParameters } from "@ai-hub/shared";

@Entity("tools")
export class ToolEntity {
  @PrimaryColumn("text")
  id!: string;

  @Column("text")
  name!: string;

  @Column("text", { default: "" })
  description!: string;

  @Column("simple-json", { default: '{"type":"object","properties":{}}' })
  parameters!: ToolParameters;

  @Column("boolean", { default: false })
  is_built_in!: boolean;
}
