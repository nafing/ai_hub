import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  CHAT_MODES,
  GROUP_CHAT_MODES,
  GROUP_RESPONSE_ORDERS,
  type ChatMode,
  type GroupChatMode,
  type GroupResponseOrder,
} from "@ai-hub/shared";

class CreateChatSettingsDto {
  @IsOptional()
  @IsString()
  connection_id?: string | null;

  @IsOptional()
  @IsString()
  preset_id?: string | null;

  @IsOptional()
  character_ids?: string[];

  /** @deprecated use character_ids */
  @IsOptional()
  @IsString()
  character_id?: string | null;

  @IsOptional()
  @IsString()
  persona_id?: string | null;

  @IsOptional()
  lorebook_ids?: string[];

  @IsOptional()
  agent_ids?: string[];

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptional()
  @IsIn(GROUP_CHAT_MODES)
  group_mode?: GroupChatMode;

  @IsOptional()
  @IsIn(GROUP_RESPONSE_ORDERS)
  response_order?: GroupResponseOrder;

  @IsOptional()
  @IsBoolean()
  add_turn_to_prompt?: boolean;

  @IsOptional()
  @IsString()
  scenario_override?: string;
}

export class CreateChatDto {
  @IsIn(CHAT_MODES)
  mode!: ChatMode;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateChatSettingsDto)
  settings?: CreateChatSettingsDto;

  @IsOptional()
  @IsNumber()
  greeting_index?: number;
}
