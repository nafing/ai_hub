import { Type } from "class-transformer";
import {
  Allow,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

class TestPresetDraftDto {
  @IsString()
  wrap_format!: "xml" | "markdown" | "none";

  @Allow()
  sections!: unknown[];
}

export class TestPresetDto {
  @IsOptional()
  @IsString()
  connectionId?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string | string[]>;

  @IsOptional()
  @IsObject()
  markers?: Record<string, string>;

  @IsOptional()
  @IsString()
  userMessage?: string;

  /** When set, test this draft instead of the saved preset body. */
  @IsOptional()
  @ValidateNested()
  @Type(() => TestPresetDraftDto)
  draft?: TestPresetDraftDto;
}
