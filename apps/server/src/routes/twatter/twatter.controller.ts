import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import type {
  CreateTwatterInteractionInput,
  CreateTwatterPostInput,
  RemoveTwatterInteractionInput,
  TwatterAccount,
  TwatterAccountProfile,
  TwatterAccountProfileUpdateInput,
  TwatterBootstrap,
  TwatterFollowUpdateInput,
  TwatterInviteInput,
  TwatterMarkNotificationsReadInput,
  TwatterNotificationsResponse,
  TwatterRefreshInput,
  TwatterSearchResult,
  TwatterSettings,
  TwatterSettingsUpdateInput,
  UpdateTwatterPostInput,
} from "@ai-hub/shared";
import { TwatterRefreshService } from "./twatter-refresh.service";
import { TwatterService } from "./twatter.service";

@Controller("twatter")
export class TwatterController {
  constructor(
    private readonly twatterService: TwatterService,
    private readonly refreshService: TwatterRefreshService,
  ) {}

  @Get()
  bootstrap(): Promise<TwatterBootstrap> {
    return this.twatterService.bootstrap();
  }

  @Get("search")
  search(
    @Query("q") q = "",
    @Query("limit") limit?: number,
  ): Promise<TwatterSearchResult> {
    return this.twatterService.search(q, limit);
  }

  @Get("notifications")
  notifications(
    @Query("persona_id") personaId: string,
    @Query("unread") unread?: string,
  ): Promise<TwatterNotificationsResponse> {
    return this.twatterService.getNotifications(
      personaId,
      unread === "1" || unread === "true",
    );
  }

  @Post("notifications/read")
  markNotificationsRead(
    @Body() body: TwatterMarkNotificationsReadInput,
  ): Promise<TwatterAccount> {
    return this.twatterService.markNotificationsRead(body.persona_id);
  }

  @Put("settings")
  updateSettings(
    @Body() body: TwatterSettingsUpdateInput,
  ): Promise<TwatterSettings> {
    return this.twatterService.updateSettings(body);
  }

  @Post("refresh")
  refresh(@Body() body: TwatterRefreshInput): Promise<{ ok: true }> {
    return this.refreshService.refreshTimeline(body.persona_id);
  }

  @Post("posts")
  createPost(@Body() body: CreateTwatterPostInput) {
    return this.twatterService.createPost(body);
  }

  @Patch("posts/:id")
  updatePost(
    @Param("id") id: string,
    @Body() body: UpdateTwatterPostInput & { persona_id: string },
  ) {
    return this.twatterService.updatePost(id, body.persona_id, body);
  }

  @Delete("posts/:id")
  async removePost(
    @Param("id") id: string,
    @Body() body: { persona_id: string },
  ): Promise<{ ok: true }> {
    await this.twatterService.removePost(id, body.persona_id);
    return { ok: true };
  }

  @Post("posts/:id/interactions")
  createInteraction(
    @Param("id") postId: string,
    @Body() body: CreateTwatterInteractionInput,
  ) {
    return this.twatterService.createInteraction(postId, body);
  }

  @Delete("posts/:id/interactions")
  async removeInteraction(
    @Param("id") postId: string,
    @Body() body: RemoveTwatterInteractionInput,
  ): Promise<{ ok: true }> {
    await this.twatterService.removeInteraction(postId, body);
    return { ok: true };
  }

  @Get("accounts/:id/profile")
  getProfile(
    @Param("id") accountId: string,
    @Query("persona_id") personaId?: string,
  ): Promise<TwatterAccountProfile> {
    return this.twatterService.getAccountProfile(accountId, personaId ?? null);
  }

  @Patch("accounts/:id/profile")
  updateProfile(
    @Param("id") accountId: string,
    @Body() body: TwatterAccountProfileUpdateInput & { persona_id: string },
  ) {
    return this.twatterService.updateAccountProfile(
      accountId,
      body.persona_id,
      body,
    );
  }

  @Patch("accounts/:followerId/follows/:targetId")
  setFollow(
    @Param("followerId") _followerId: string,
    @Param("targetId") targetId: string,
    @Body() body: TwatterFollowUpdateInput,
  ) {
    return this.twatterService.setFollow(targetId, body.persona_id, body.following);
  }

  @Post("invites")
  invite(@Body() body: TwatterInviteInput): Promise<TwatterSettings> {
    return this.twatterService.inviteCharacter(body.character_id);
  }

  @Delete("invites/:characterId")
  uninvite(@Param("characterId") characterId: string): Promise<TwatterSettings> {
    return this.twatterService.uninviteCharacter(characterId);
  }

  @Delete("timeline")
  async resetTimeline(): Promise<{ ok: true }> {
    await this.twatterService.resetTimeline();
    return { ok: true };
  }
}

