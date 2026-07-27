import { PartialType } from "@nestjs/mapped-types";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
} from "class-validator";
import { CreateCharacterDto } from "./create-character.dto";

export class UpdateCharacterDto extends PartialType(CreateCharacterDto) {
  @IsOptional()
  @IsString()
  active_version_id?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  create_version?: boolean;

  @IsOptional()
  @IsString()
  version_label?: string;
}
