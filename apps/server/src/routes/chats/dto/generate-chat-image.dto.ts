import { IsOptional, IsString } from "class-validator";

export class GenerateChatImageDto {
  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  characterId?: string;
}
