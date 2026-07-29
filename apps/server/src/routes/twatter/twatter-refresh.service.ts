import {
  BadRequestException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { In, Repository } from "typeorm";
import {
  accountSnapshot,
  buildTwatterPollMetadata,
  normalizeTwatterHandle,
  tryParseTwatterGeneratedRefresh,
  TWATTER_FEED_LIMIT,
  validateTwatterGeneratedRefresh,
  type TwatterAccount,
  type TwatterGeneratedRefresh,
  type TwatterSettings,
} from "@ai-hub/shared";
import { completeWithConnectionAndPreset } from "../../utils/openrouter";
import { ConnectionsService } from "../connections/connections.service";
import { PresetsService } from "../presets/presets.service";
import { TwatterAccountEntity } from "./twatter-account.entity";
import { TwatterDigestEntity } from "./twatter-digest.entity";
import { TwatterInteractionEntity } from "./twatter-interaction.entity";
import { TwatterPostEntity } from "./twatter-post.entity";
import {
  buildTwatterRefreshBrief,
  timelineRefreshMaxTokens,
} from "./twatter-prompt";
import { TwatterService } from "./twatter.service";

@Injectable()
export class TwatterRefreshService {
  private readonly logger = new Logger(TwatterRefreshService.name);

  constructor(
    private readonly twatter: TwatterService,
    private readonly connections: ConnectionsService,
    private readonly presets: PresetsService,
    @InjectRepository(TwatterAccountEntity)
    private readonly accounts: Repository<TwatterAccountEntity>,
    @InjectRepository(TwatterPostEntity)
    private readonly posts: Repository<TwatterPostEntity>,
    @InjectRepository(TwatterInteractionEntity)
    private readonly interactions: Repository<TwatterInteractionEntity>,
    @InjectRepository(TwatterDigestEntity)
    private readonly digests: Repository<TwatterDigestEntity>,
  ) {}

  async refreshTimeline(personaId?: string): Promise<{ ok: true }> {
    const settings = await this.twatter.getSettings();
    if (!settings.generation_connection_id) {
      throw new BadRequestException(
        "Choose a generation connection for Twatter first.",
      );
    }

    const bootstrap = await this.twatter.bootstrap();
    const personaAccount = personaId
      ? bootstrap.accounts.find(
          (account) =>
            account.kind === "persona" && account.entity_id === personaId,
        ) ?? null
      : bootstrap.accounts.find((account) => account.kind === "persona") ?? null;

    const participantAccounts = this.chooseParticipants(
      bootstrap.accounts,
      settings,
    );
    if (participantAccounts.length === 0) {
      throw new BadRequestException(
        "Invite at least one character or enable random users before refreshing.",
      );
    }

    const connection = await this.connections.findOne(
      settings.generation_connection_id,
    );

    const preset = settings.refresh_preset_id
      ? await this.presets.findOne(settings.refresh_preset_id)
      : await this.presets.findDefault("twatter_refresh");

    if (preset.category !== "twatter_refresh") {
      throw new BadRequestException(
        `Preset "${preset.name}" is not a Twatter Refresh preset.`,
      );
    }

    const timelineBrief = await buildTwatterRefreshBrief({
      twatter: this.twatter,
      settings,
      accounts: bootstrap.accounts,
      participantAccounts,
      recentPosts: bootstrap.posts,
      recentInteractions: bootstrap.interactions,
      personaAccount,
    });

    const result = await completeWithConnectionAndPreset(connection, preset, {
      prompt: {
        markers: {
          generator_brief: timelineBrief,
        },
      },
      body: {
        overrides: {
          max_tokens: timelineRefreshMaxTokens(participantAccounts.length),
        },
      },
    });

    const parsed = tryParseTwatterGeneratedRefresh(result.content);
    if (!parsed) {
      throw new BadRequestException("Twatter refresh returned invalid JSON.");
    }

    const allowedHandles = new Set(
      participantAccounts.map((account) =>
        normalizeTwatterHandle(account.handle),
      ),
    );
    const validationError = validateTwatterGeneratedRefresh(parsed, allowedHandles);
    if (validationError) {
      throw new BadRequestException(
        `Twatter refresh rejected: ${validationError}`,
      );
    }

    await this.commitGeneratedRefresh(parsed, bootstrap.accounts, settings);
    this.logger.log("Twatter timeline refreshed");
    return { ok: true };
  }

  private chooseParticipants(
    accounts: TwatterAccount[],
    settings: TwatterSettings,
  ): TwatterAccount[] {
    const eligible = accounts.filter((account) => {
      if (account.kind === "persona") return false;
      if (account.kind === "random_user") return settings.allow_random_users;
      if (account.kind === "character") {
        return (
          account.invited &&
          settings.invited_character_ids.includes(account.entity_id)
        );
      }
      return false;
    });

    if (settings.participant_selection_mode === "all") {
      return eligible;
    }

    const min = Math.min(settings.participant_min, settings.participant_max);
    const max = Math.max(settings.participant_min, settings.participant_max);
    const target =
      settings.participant_selection_mode === "exact"
        ? min
        : min + Math.floor(Math.random() * (max - min + 1));

    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.max(1, target));
  }

  private async commitGeneratedRefresh(
    generated: TwatterGeneratedRefresh,
    accounts: TwatterAccount[],
    settings: TwatterSettings,
  ): Promise<void> {
    const handleToAccount = new Map(
      accounts.map((account) => [
        normalizeTwatterHandle(account.handle),
        account,
      ]),
    );
    const tempIdToPostId = new Map<string, string>();
    const now = new Date().toISOString();

    const postsToCreate = generated.posts.slice(
      0,
      settings.max_generated_posts_per_refresh + settings.max_replies_per_refresh,
    );

    const rootPosts = postsToCreate.filter(
      (item) => !item.inReplyToPostId && !item.inReplyToTempId,
    );
    const replyPosts = postsToCreate.filter(
      (item) => item.inReplyToPostId || item.inReplyToTempId,
    );

    let replyCount = 0;

    for (const item of rootPosts.slice(
      0,
      settings.max_generated_posts_per_refresh,
    )) {
      const account = handleToAccount.get(
        normalizeTwatterHandle(item.authorHandle),
      );
      if (!account || account.kind === "persona") continue;

      const id = randomUUID();
      const metadata =
        item.poll && item.poll.options.length >= 2
          ? buildTwatterPollMetadata(item.poll)
          : {};

      const entity = this.posts.create({
        id,
        author_account_id: account.id,
        content: item.content.trim().slice(0, 4000),
        image_url: null,
        parent_post_id: null,
        quote_post_id: null,
        source: "generated",
        metadata,
        author_snapshot: accountSnapshot(account),
        created_at: now,
        updated_at: now,
      });
      await this.posts.save(entity);
      if (item.tempId) tempIdToPostId.set(item.tempId, id);
    }

    for (const item of replyPosts) {
      if (replyCount >= settings.max_replies_per_refresh) continue;

      const account = handleToAccount.get(
        normalizeTwatterHandle(item.authorHandle),
      );
      if (!account || account.kind === "persona") continue;

      const parentPostId =
        item.inReplyToPostId ??
        (item.inReplyToTempId
          ? tempIdToPostId.get(item.inReplyToTempId)
          : undefined);
      if (!parentPostId || !item.content?.trim()) continue;

      const id = randomUUID();
      const entity = this.posts.create({
        id,
        author_account_id: account.id,
        content: item.content.trim().slice(0, 4000),
        image_url: null,
        parent_post_id: parentPostId,
        quote_post_id: null,
        source: "generated",
        metadata: {},
        author_snapshot: accountSnapshot(account),
        created_at: now,
        updated_at: now,
      });
      await this.posts.save(entity);
      replyCount += 1;
    }

    let repostCount = 0;
    let likeCount = 0;

    for (const item of generated.interactions) {
      const actor = handleToAccount.get(
        normalizeTwatterHandle(item.actorHandle),
      );
      if (!actor || actor.kind === "persona") continue;

      const targetPostId =
        item.targetPostId ??
        (item.targetTempId ? tempIdToPostId.get(item.targetTempId) : undefined);
      if (!targetPostId) continue;

      if (item.type === "reply" && replyCount >= settings.max_replies_per_refresh) {
        continue;
      }
      if (item.type === "repost" && repostCount >= settings.max_reposts_per_refresh) {
        continue;
      }
      if (item.type === "like" && likeCount >= settings.max_likes_per_refresh) {
        continue;
      }

      if (item.type === "like" || item.type === "repost") {
        const existing = await this.interactions.findOneBy({
          actor_account_id: actor.id,
          post_id: targetPostId,
          type: item.type,
        });
        if (existing) continue;
      }

      const id = randomUUID();
      await this.interactions.save(
        this.interactions.create({
          id,
          actor_account_id: actor.id,
          post_id: targetPostId,
          type: item.type,
          content:
            item.type === "reply"
              ? (item.content ?? "").trim().slice(0, 2000) || null
              : item.type === "vote"
                ? String(item.pollOptionIndex ?? 0)
                : null,
          parent_interaction_id: item.parentInteractionId ?? null,
          actor_snapshot: accountSnapshot(actor),
          created_at: now,
          updated_at: now,
        }),
      );

      if (item.type === "reply") replyCount += 1;
      if (item.type === "repost") repostCount += 1;
      if (item.type === "like") likeCount += 1;
    }

    for (const follow of generated.follows) {
      const actor = handleToAccount.get(
        normalizeTwatterHandle(follow.actorHandle),
      );
      const target = handleToAccount.get(
        normalizeTwatterHandle(follow.targetHandle),
      );
      if (!actor || !target || actor.kind !== "persona") continue;
      if (target.kind !== "character") continue;
      await this.twatter.setFollowInternal(actor.id, target.id, true);
    }

    for (const digest of generated.digests) {
      const accountIds = digest.accountEntityIds
        .map((entityId: string) =>
          accounts.find((account) => account.entity_id === entityId),
        )
        .filter((account): account is TwatterAccount => Boolean(account))
        .map((account: TwatterAccount) => account.id);

      if (!digest.content.trim() || accountIds.length === 0) continue;
      await this.digests.save(
        this.digests.create({
          id: randomUUID(),
          account_ids: accountIds,
          content: digest.content.trim().slice(0, 1200),
          created_at: now,
        }),
      );
    }

    await this.trimTimeline();
  }

  private async trimTimeline(): Promise<void> {
    const rows = await this.posts.find({
      order: { created_at: "DESC" },
      take: TWATTER_FEED_LIMIT + 50,
    });
    if (rows.length <= TWATTER_FEED_LIMIT) return;
    const staleIds = rows.slice(TWATTER_FEED_LIMIT).map((row) => row.id);
    if (!staleIds.length) return;
    await this.interactions.delete({ post_id: In(staleIds) });
    await this.posts.delete({ id: In(staleIds) });
  }
}
