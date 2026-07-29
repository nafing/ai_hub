import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class ChatMessageAttachmentDto {
  @IsString()
  id!: string;

  @IsIn(["image", "file"])
  kind!: "image" | "file";

  @IsString()
  mime!: string;

  @IsString()
  url!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  size?: number;
}

export class GenerateChatDto {
  @IsOptional()
  @IsString()
  userMessage?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageAttachmentDto)
  attachments?: ChatMessageAttachmentDto[];

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

  @IsOptional()
  @IsBoolean()
  autonomous?: boolean;

  @IsOptional()
  @IsString()
  autonomous_intent_key?: string;

  @IsOptional()
  @IsBoolean()
  skip_presence_delay?: boolean;
}
