import { IsIn, IsOptional, IsString } from "class-validator";

export class CreateChatMessageDto {
  @IsOptional()
  @IsIn(["user", "assistant", "system"])
  role?: "user" | "assistant" | "system";

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  character_id?: string | null;
}
