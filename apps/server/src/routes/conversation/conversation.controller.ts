import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { IsIn, IsObject, IsOptional, IsString } from "class-validator";
import { ChatsService } from "../chats/chats.service";
import { ConversationAutonomousService } from "./conversation-autonomous.service";

class ActivityPresenceDto {
  @IsIn(["active", "idle", "dnd"])
  presence!: "active" | "idle" | "dnd";
}

class BusyDelayDto {
  @IsString()
  characterId!: string;
}

class ExchangeDto {
  @IsOptional()
  @IsString()
  excludeCharacterId?: string;
}

class StatusOverrideDto {
  @IsString()
  characterId!: string;

  @IsIn(["online", "idle", "dnd", "offline"])
  status!: "online" | "idle" | "dnd" | "offline";

  @IsOptional()
  @IsString()
  activity?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string | null;
}

class SchedulesPatchDto {
  @IsOptional()
  @IsObject()
  character_schedules?: Record<string, unknown>;

  @IsOptional()
  conversation_schedules_enabled?: boolean;

  @IsOptional()
  @IsString()
  conversation_timezone?: string | null;
}

@Controller("conversation")
export class ConversationController {
  constructor(
    private readonly autonomous: ConversationAutonomousService,
    private readonly chats: ChatsService,
  ) {}

  @Get("status/:chatId")
  getStatus(@Param("chatId") chatId: string) {
    return this.autonomous.getStatuses(chatId);
  }

  @Post("autonomous/check")
  check(@Body() body: { chatId: string }) {
    return this.autonomous.checkAutonomous(body.chatId);
  }

  @Post("busy-delay")
  busyDelay(@Body() body: BusyDelayDto & { chatId: string }) {
    return this.autonomous.busyDelay(body.chatId, body.characterId);
  }

  @Post("autonomous/exchange")
  exchange(@Body() body: ExchangeDto & { chatId: string }) {
    return this.autonomous.checkExchange(body.chatId, body.excludeCharacterId);
  }

  @Post("autonomous/clear-in-progress")
  clearInProgress(@Body() body: { chatId: string }) {
    this.autonomous.clearGenerationInProgress(body.chatId);
    return { ok: true };
  }

  @Post("activity/user")
  activityUser(@Body() body: { chatId: string }) {
    this.autonomous.recordUserActivity(body.chatId);
    return { ok: true };
  }

  @Post("activity/assistant")
  activityAssistant(
    @Body() body: { chatId: string; characterId?: string | null },
  ) {
    this.autonomous.recordAssistantActivity(body.chatId, body.characterId);
    return { ok: true };
  }

  @Post("activity/presence")
  activityPresence(@Body() body: ActivityPresenceDto & { chatId: string }) {
    this.autonomous.setClientPresence(body.chatId, body.presence);
    return { ok: true };
  }

  @Post("status/override")
  async setOverride(@Body() body: StatusOverrideDto & { chatId: string }) {
    const chat = await this.chats.findOne(body.chatId);
    const overrides = { ...chat.settings.conversation_status_overrides };
    overrides[body.characterId] = {
      status: body.status,
      activity: body.activity,
      expiresAt: body.expiresAt ?? null,
    };
    return this.chats.update(body.chatId, {
      settings: {
        ...chat.settings,
        conversation_status_overrides: overrides,
      },
    });
  }

  @Post("schedules/:chatId")
  async patchSchedules(
    @Param("chatId") chatId: string,
    @Body() body: SchedulesPatchDto,
  ) {
    await this.autonomous.ensureDefaultSchedules(chatId);
    const chat = await this.chats.findOne(chatId);
    const mergedSchedules = body.character_schedules
      ? {
          ...chat.settings.character_schedules,
          ...body.character_schedules,
        }
      : chat.settings.character_schedules;
    return this.chats.update(chatId, {
      settings: {
        ...chat.settings,
        character_schedules: mergedSchedules as never,
        ...(typeof body.conversation_schedules_enabled === "boolean"
          ? {
              conversation_schedules_enabled:
                body.conversation_schedules_enabled,
            }
          : {}),
        ...(body.conversation_timezone !== undefined
          ? { conversation_timezone: body.conversation_timezone }
          : {}),
      },
    });
  }

  @Post("schedules/:chatId/ensure")
  ensureSchedules(@Param("chatId") chatId: string) {
    return this.autonomous.ensureDefaultSchedules(chatId);
  }
}
