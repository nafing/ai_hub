import { IsObject, IsString, Matches } from "class-validator";
import type { ToolParameters } from "@ai-hub/shared";

export class CreateToolDto {
  @IsString()
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/, {
    message:
      "name must start with a letter and contain only letters, digits, and underscores",
  })
  name!: string;

  @IsString()
  description!: string;

  @IsObject()
  parameters!: ToolParameters;
}
