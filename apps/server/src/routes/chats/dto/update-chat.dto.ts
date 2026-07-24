import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  GROUP_CHAT_MODES,
  GROUP_RESPONSE_ORDERS,
  type GroupChatMode,
  type GroupResponseOrder,
} from "@ai-hub/shared";

class UpdateChatSettingsDto {
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

export class UpdateChatDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateChatSettingsDto)
  settings?: UpdateChatSettingsDto;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsObject()
  agent_state?: Record<string, unknown>;
}
