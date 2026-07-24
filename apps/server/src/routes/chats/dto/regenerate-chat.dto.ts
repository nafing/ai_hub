import { IsOptional, IsString } from "class-validator";

export class RegenerateChatDto {
  /** When set, regenerate this user or assistant message (adds a swipe; later messages stay). */
  @IsOptional()
  @IsString()
  messageId?: string;
}
