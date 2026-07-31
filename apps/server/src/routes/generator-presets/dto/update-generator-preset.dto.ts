import { PartialType } from "@nestjs/mapped-types";
import { CreateGeneratorPresetDto } from "./create-generator-preset.dto";

export class UpdateGeneratorPresetDto extends PartialType(
  CreateGeneratorPresetDto,
) {}
