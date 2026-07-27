import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  GROUP_CHAT_MODES,
  GROUP_RESPONSE_ORDERS,
  type ChatAgentSettingsMap,
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

  @IsOptional()
  @IsString()
  persona_id?: string | null;

  @IsOptional()
  lorebook_ids?: string[];

  @IsOptional()
  agent_ids?: string[];

  @IsOptional()
  @IsObject()
  agent_settings?: ChatAgentSettingsMap;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string | string[]>;

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

  @IsOptional()
  @IsBoolean()
  memory_enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  history_depth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  memory_top_k?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(64)
  @Max(8000)
  memory_token_budget?: number;

  @IsOptional()
  @IsBoolean()
  allow_twatter_references?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_character_dms?: boolean;

  @IsOptional()
  @IsObject()
  character_dm_chat_ids?: Record<string, string>;
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
