import { PartialType } from "@nestjs/mapped-types";
import { CreateCharacterFolderDto } from "./create-character-folder.dto";

export class UpdateCharacterFolderDto extends PartialType(
  CreateCharacterFolderDto,
) {}
