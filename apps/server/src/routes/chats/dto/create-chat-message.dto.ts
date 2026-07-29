import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { ChatMessageAttachmentDto } from "./generate-chat.dto";

export class CreateChatMessageDto {
  @IsOptional()
  @IsIn(["user", "assistant", "system"])
  role?: "user" | "assistant" | "system";

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  character_id?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageAttachmentDto)
  attachments?: ChatMessageAttachmentDto[];
}
