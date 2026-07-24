import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateChatMessageDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsNumber()
  swipe_id?: number;

  @IsOptional()
  @IsString()
  thinking?: string | null;

  @IsOptional()
  @IsBoolean()
  remove_active_swipe?: boolean;
}
