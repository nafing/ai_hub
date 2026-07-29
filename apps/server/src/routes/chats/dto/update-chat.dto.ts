import {
  IsArray,
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
  type AutonomousDailyBudget,
  type CharacterSchedules,
  type ChatAgentSettingsMap,
  type ConversationStatusOverride,
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
  @IsArray()
  @IsString({ each: true })
  inactive_character_ids?: string[];

  @IsOptional()
  @IsString()
  persona_id?: string | null;

  @IsOptional()
  lorebook_ids?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  lorebook_token_budget?: number;

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
  group_speaker_tags?: boolean;

  @IsOptional()
  @IsBoolean()
  group_speaker_names_in_history?: boolean;

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
  @Max(9999)
  context_message_limit?: number | null;

  @IsOptional()
  @IsBoolean()
  exclude_past_reasoning?: boolean;

  @IsOptional()
  @IsBoolean()
  image_captioning_enabled?: boolean;

  @IsOptional()
  @IsString()
  image_captioning_connection_id?: string | null;

  @IsOptional()
  @IsBoolean()
  enable_agents?: boolean;

  @IsOptional()
  @IsBoolean()
  agent_write_approval_required?: boolean;

  @IsOptional()
  @IsBoolean()
  manual_trackers?: boolean;

  @IsOptional()
  @IsBoolean()
  enable_tools?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tool_ids?: string[];

  @IsOptional()
  @IsBoolean()
  allow_twatter_references?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_character_dms?: boolean;

  @IsOptional()
  @IsObject()
  character_dm_chat_ids?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  automatic_summary_enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  summary_run_interval?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(500)
  summary_context_size?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(256)
  @Max(32768)
  summary_max_tokens?: number;

  @IsOptional()
  @IsString()
  summary_connection_id?: string | null;

  @IsOptional()
  @IsBoolean()
  hide_summarised_messages?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  summary_tail_messages?: number;

  @IsOptional()
  @IsString()
  summary_preset_id?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(11)
  day_rollover_hour?: number;

  @IsOptional()
  @IsString()
  prompt_timezone?: string | null;

  @IsOptional()
  @IsBoolean()
  autonomous_messages?: boolean;

  @IsOptional()
  @IsBoolean()
  character_exchanges?: boolean;

  @IsOptional()
  @IsBoolean()
  conversation_schedules_enabled?: boolean;

  @IsOptional()
  @IsObject()
  character_schedules?: CharacterSchedules;

  @IsOptional()
  @IsString()
  conversation_timezone?: string | null;

  @IsOptional()
  @IsObject()
  conversation_status_overrides?: Record<string, ConversationStatusOverride>;

  @IsOptional()
  @IsObject()
  autonomous_daily_budget?: AutonomousDailyBudget;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(8)
  autonomous_daily_cap_override?: number | null;

  @IsOptional()
  @IsObject()
  intent_cooldowns?: Record<string, Record<string, string>>;

  @IsOptional()
  @IsBoolean()
  cross_chat_awareness?: boolean;

  @IsOptional()
  @IsBoolean()
  conversation_about_me_inject?: boolean;

  @IsOptional()
  @IsObject()
  conversation_about_me_overrides?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  character_commands?: boolean;

  @IsOptional()
  @IsObject()
  conversation_command_toggles?: Record<string, boolean>;

  @IsOptional()
  @IsBoolean()
  enable_memory_recall?: boolean;

  @IsOptional()
  @IsObject()
  character_memories?: Record<string, string[]>;

  @IsOptional()
  @IsString()
  image_aspect_ratio?: string;

  @IsOptional()
  @IsString()
  image_resolution?: string;

  @IsOptional()
  @IsString()
  background_image_url?: string | null;

  @IsOptional()
  @IsObject()
  chat_parameters?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  impersonate_prompt_template?: string;

  @IsOptional()
  @IsString()
  impersonate_preset_id?: string | null;

  @IsOptional()
  @IsString()
  impersonate_connection_id?: string | null;

  @IsOptional()
  @IsBoolean()
  impersonate_skip_agents?: boolean;

  @IsOptional()
  @IsBoolean()
  impersonate_cyoa_as_direction?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  connected_pending_influences?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  connected_notes?: string[];
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
