import { IsIn, IsObject, IsOptional, IsString } from "class-validator";
import { GENERATOR_CATEGORIES } from "@ai-hub/shared";

export class RunGeneratorDto {
  @IsIn([...GENERATOR_CATEGORIES])
  category!: (typeof GENERATOR_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  connectionId?: string;

  /** When omitted, the default preset for `category` is used. */
  @IsOptional()
  @IsString()
  presetId?: string;

  /**
   * Generator Preset whose `prompt` is injected as `generator_prompt`.
   * When set, also resolves linked `preset_id` if `presetId` is omitted.
   */
  @IsOptional()
  @IsString()
  generatorPresetId?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string | string[]>;

  @IsOptional()
  @IsObject()
  markers?: Record<string, string>;

  @IsOptional()
  @IsString()
  userMessage?: string;
}
