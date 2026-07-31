import {
  IsBoolean,
  IsIn,
  IsString,
  ValidateIf,
} from "class-validator";
import {
  GENERATOR_CATEGORIES,
  type GeneratorCategory,
} from "@ai-hub/shared";

export class CreateGeneratorPresetDto {
  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsString()
  author!: string;

  @IsIn([...GENERATOR_CATEGORIES])
  category!: GeneratorCategory;

  @IsString()
  prompt!: string;

  @IsString()
  prompt_create!: string;

  @IsString()
  prompt_import!: string;

  @IsString()
  prompt_regenerate!: string;

  @IsString()
  prompt_rebuild!: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  preset_id!: string | null;

  @IsBoolean()
  is_default!: boolean;
}
