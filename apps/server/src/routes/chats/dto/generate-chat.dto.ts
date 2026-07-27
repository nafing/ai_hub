import { IsBoolean, IsOptional, IsString } from "class-validator";

export class GenerateChatDto {
  @IsOptional()
  @IsString()
  userMessage?: string;

  @IsOptional()
  @IsString()
  forCharacterId?: string;

  @IsOptional()
  @IsString()
  generationGuide?: string;

  @IsOptional()
  @IsBoolean()
  impersonate?: boolean;

  @IsOptional()
  @IsString()
  continueMessageId?: string;

  @IsOptional()
  @IsBoolean()
  runDirector?: boolean;
}
