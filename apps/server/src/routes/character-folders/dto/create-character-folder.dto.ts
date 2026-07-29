import { IsArray, IsString } from "class-validator";

export class CreateCharacterFolderDto {
  @IsString()
  name!: string;

  @IsArray()
  @IsString({ each: true })
  character_ids!: string[];
}
