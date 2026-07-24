import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";
import {
  REGEX_APPLY_TO,
  REGEX_SCOPES,
  REGEX_TARGETS,
} from "@ai-hub/shared";

export class CreateRegexScriptDto {
  @IsString()
  name!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsString()
  find_regex!: string;

  @IsString()
  replace_with!: string;

  @IsString()
  flags!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn([...REGEX_TARGETS], { each: true })
  targets!: Array<(typeof REGEX_TARGETS)[number]>;

  @IsIn([...REGEX_APPLY_TO])
  apply_to!: (typeof REGEX_APPLY_TO)[number];

  @Type(() => Number)
  @IsInt()
  order!: number;

  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_depth!: number | null;

  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_depth!: number | null;

  @IsIn([...REGEX_SCOPES])
  scope!: (typeof REGEX_SCOPES)[number];

  @IsArray()
  @IsString({ each: true })
  character_ids!: string[];
}
