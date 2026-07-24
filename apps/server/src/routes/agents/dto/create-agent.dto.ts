import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from "class-validator";
import {
  AGENT_CATEGORIES,
  AGENT_EXECUTIONS,
  AGENT_PHASES,
  type AgentCategory,
  type AgentExecution,
  type AgentPhase,
  type AgentPromptTemplate,
  type AgentResultType,
} from "@ai-hub/shared";

export class CreateAgentDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{0,63}$/, {
    message:
      "slug must start with a letter and contain only lowercase letters, digits, and hyphens",
  })
  slug!: string;

  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsString()
  author!: string;

  @IsIn([...AGENT_PHASES])
  phase!: AgentPhase;

  @IsIn([...AGENT_CATEGORIES])
  category!: AgentCategory;

  @IsBoolean()
  enabled_by_default!: boolean;

  @IsArray()
  @IsString({ each: true })
  default_tools!: string[];

  @IsString()
  default_prompt_template!: string;

  @IsObject()
  default_settings!: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  mode_allowlist!: string[];

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsIn(["text_rewrite"])
  result_type!: AgentResultType | null;

  @IsBoolean()
  default_inject_as_section!: boolean;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  run_interval!: number | null;

  @IsArray()
  prompt_templates!: AgentPromptTemplate[];

  @IsBoolean()
  runtime_disabled!: boolean;

  @IsIn([...AGENT_EXECUTIONS])
  execution!: AgentExecution;
}
