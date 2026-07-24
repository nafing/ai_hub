import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import {
  CHARA_CARD_SPEC,
  CHARA_CARD_SPEC_VERSION,
  type CharacterBook,
  type CharacterCardData,
} from "@ai-hub/shared";

export class CharacterCardDataDto implements CharacterCardData {
  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsString()
  personality!: string;

  @IsString()
  scenario!: string;

  @IsString()
  first_mes!: string;

  @IsString()
  mes_example!: string;

  @IsString()
  creator_notes!: string;

  @IsString()
  system_prompt!: string;

  @IsString()
  post_history_instructions!: string;

  @IsArray()
  @IsString({ each: true })
  alternate_greetings!: string[];

  /** Optional character-embedded lorebook; validated loosely to preserve unknown fields. */
  @IsOptional()
  @IsObject()
  character_book?: CharacterBook;

  @IsArray()
  @IsString({ each: true })
  tags!: string[];

  @IsString()
  creator!: string;

  @IsString()
  character_version!: string;

  @IsOptional()
  @IsNumber()
  talkativeness!: number;
}

export class CreateCharacterDto {
  @IsIn([CHARA_CARD_SPEC])
  spec!: typeof CHARA_CARD_SPEC;

  @IsIn([CHARA_CARD_SPEC_VERSION])
  spec_version!: typeof CHARA_CARD_SPEC_VERSION;

  @ValidateNested()
  @Type(() => CharacterCardDataDto)
  data!: CharacterCardDataDto;
}
