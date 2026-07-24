import { Type } from "class-transformer";
import {
  Allow,
  IsArray,
  IsBoolean,
  IsIn,
  IsString,
  ValidateNested,
} from "class-validator";

export class SectionDto {
  @IsString()
  id!: string;

  @IsIn([
    "prompt_block",
    "character_info",
    "lorebook_all",
    "persona",
    "chat_history",
    "chat_summary",
    "lorebook_before",
    "lorebook_after",
    "dialogue_examples",
    "generator_brief",
    "reference_characters",
  ])
  kind!:
    | "prompt_block"
    | "character_info"
    | "lorebook_all"
    | "persona"
    | "chat_history"
    | "chat_summary"
    | "lorebook_before"
    | "lorebook_after"
    | "dialogue_examples"
    | "generator_brief"
    | "reference_characters";

  @IsString()
  name!: string;

  @IsIn(["system", "user", "assistant"])
  role!: "system" | "user" | "assistant";

  @IsString()
  content!: string;

  /** `"ordered"` or a numeric insert index. */
  @Allow()
  position!: "ordered" | number;

  @IsString()
  group!: string;
}

export class VariableOptionDto {
  @IsString()
  id!: string;

  @IsString()
  label!: string;

  @IsString()
  value!: string;
}

export class VariableDto {
  @IsString()
  id!: string;

  @IsString()
  variable_name!: string;

  @IsString()
  question!: string;

  @IsBoolean()
  multi_select!: boolean;

  @IsIn(["auto", "radios", "dropdown"])
  presentation!: "auto" | "radios" | "dropdown";

  @IsBoolean()
  alphabetical!: boolean;

  @IsArray()
  @IsString({ each: true })
  selected!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariableOptionDto)
  options!: VariableOptionDto[];
}

export class CreatePresetDto {
  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsIn(["xml", "markdown", "none"])
  wrap_format!: "xml" | "markdown" | "none";

  @IsIn([
    "roleplay",
    "conversation",
    "character_generator",
    "persona_generator",
    "lorebook_generator",
  ])
  category!:
    | "roleplay"
    | "conversation"
    | "character_generator"
    | "persona_generator"
    | "lorebook_generator";

  @IsBoolean()
  is_default!: boolean;

  @IsString()
  author!: string;

  @IsArray()
  @IsString({ each: true })
  groups!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionDto)
  sections!: SectionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariableDto)
  variables!: VariableDto[];
}
