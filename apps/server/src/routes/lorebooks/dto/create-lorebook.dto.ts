import { Type } from "class-transformer";
import {
  Allow,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  LOREBOOK_CATEGORIES,
  type LorebookCategory,
  type LorebookEntry,
} from "@ai-hub/shared";

export class LorebookEntryDto implements LorebookEntry {
  @IsArray()
  @IsString({ each: true })
  keys!: string[];

  @IsString()
  content!: string;

  @IsObject()
  extensions!: Record<string, unknown>;

  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  insertion_order!: number;

  @IsOptional()
  @IsBoolean()
  case_sensitive?: boolean;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsInt()
  id?: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsBoolean()
  selective?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secondary_keys?: string[];

  @IsOptional()
  @IsBoolean()
  constant?: boolean;

  @IsOptional()
  @Allow()
  position?: "before_char" | "after_char";
}

export class CreateLorebookDto {
  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsBoolean()
  global!: boolean;

  @IsIn([...LOREBOOK_CATEGORIES])
  category!: LorebookCategory;

  @IsArray()
  @IsString({ each: true })
  linked_characters!: string[];

  @IsArray()
  @IsString({ each: true })
  linked_personas!: string[];

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  scan_depth!: number | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  token_budget!: number | null;

  @IsBoolean()
  recursive_scanning!: boolean;

  @IsObject()
  extensions!: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LorebookEntryDto)
  entries!: LorebookEntryDto[];
}
