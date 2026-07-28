import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { In, Repository } from "typeorm";
import {
  accountSnapshot,
  buildTwatterCarryoverBlock,
  buildTwatterNotifications,
  buildTwatterPollMetadata,
  countUnreadTwatterNotifications,
  DEFAULT_TWATTER_SETTINGS,
  defaultTwatterAccountSettings,
  extractTwatterMentionHandles,
  mergeAccountSocialSettings,
  mergeTwatterSettings,
  modeAllowsTwatterCarryover,
  normalizeTwatterContent,
  normalizeTwatterHandle,
  normalizeTwatterSettings,
  reconcileTwatterRefreshSchedule,
  twatterRefreshSchedulerStatus,
  TWATTER_FEED_LIMIT,
  TWATTER_RANDOM_USERS,
  twatterHandleFromName,
  type ChatMode,
  type CreateTwatterInteractionInput,
  type CreateTwatterPostInput,
  type PersistedTwatterRefreshSchedule,
  type RemoveTwatterInteractionInput,
  type TwatterAccount,
  type TwatterAccountProfile,
  type TwatterAccountProfileUpdateInput,
  type TwatterBootstrap,
  type TwatterDigestEntry,
  type TwatterInteraction,
  type TwatterNotificationsResponse,
  type TwatterPost,
  type TwatterSearchResult,
  type TwatterSettings,
  type TwatterSettingsUpdateInput,
  type UpdateTwatterPostInput,
} from "@ai-hub/shared";
import { CharactersService } from "../characters/characters.service";
import { ChatEntity } from "../chats/chat.entity";
import { PersonasService } from "../personas/personas.service";
import { TwatterAccountEntity } from "./twatter-account.entity";
import { TwatterDigestEntity } from "./twatter-digest.entity";
import { TwatterInteractionEntity } from "./twatter-interaction.entity";
import {
  normalizeTwatterPostImageInput,
  twatterImageExists,
  twatterImageFilePath,
  twatterPostImagePublicUrl,
  writeTwatterPostImage,
} from "./twatter-image-storage";
import { TwatterPostEntity } from "./twatter-post.entity";
import { TwatterSettingsEntity } from "./twatter-settings.entity";

const SETTINGS_ID = "default";

@Injectable()
export class TwatterService {
  constructor(
    @InjectRepository(TwatterAccountEntity)
    private readonly accounts: Repository<TwatterAccountEntity>,
    @InjectRepository(TwatterPostEntity)
    private readonly posts: Repository<TwatterPostEntity>,
    @InjectRepository(TwatterInteractionEntity)
    private readonly interactions: Repository<TwatterInteractionEntity>,
    @InjectRepository(TwatterDigestEntity)
    private readonly digests: Repository<TwatterDigestEntity>,
    @InjectRepository(TwatterSettingsEntity)
    private readonly settingsRepo: Repository<TwatterSettingsEntity>,
    @InjectRepository(ChatEntity)
    private readonly chats: Repository<ChatEntity>,
    private readonly personas: PersonasService,
    private readonly characters: CharactersService,
  ) {}

  private async getSettingsRow(): Promise<TwatterSettingsEntity> {
    const row = await this.settingsRepo.findOneBy({ id: SETTINGS_ID });
    if (row) return row;
    const created = this.settingsRepo.create({
      id: SETTINGS_ID,
      data: DEFAULT_TWATTER_SETTINGS,
      refresh_schedule: null,
    });
    return this.settingsRepo.save(created);
  }

  async ensureRefreshSchedule(
    at = new Date(),
  ): Promise<PersistedTwatterRefreshSchedule> {
    const settings = await this.getSettings();
    const row = await this.getSettingsRow();
    const next = reconcileTwatterRefreshSchedule(
      row.refresh_schedule,
      settings.refreshes_per_day,
      at,
    );
    if (JSON.stringify(next) !== JSON.stringify(row.refresh_schedule)) {
      row.refresh_schedule = next;
      await this.settingsRepo.save(row);
    }
    return next;
  }

  async saveRefreshSchedule(
    schedule: PersistedTwatterRefreshSchedule,
  ): Promise<void> {
    const row = await this.getSettingsRow();
    row.refresh_schedule = schedule;
    await this.settingsRepo.save(row);
  }

  async getSettings(): Promise<TwatterSettings> {
    const row = await this.getSettingsRow();
    return normalizeTwatterSettings(row.data);
  }

  async updateSettings(
    patch: TwatterSettingsUpdateInput,
  ): Promise<TwatterSettings> {
    const current = await this.getSettings();
    const next = mergeTwatterSettings(current, patch);
    const row = await this.getSettingsRow();
    row.data = next;
    row.refresh_schedule = reconcileTwatterRefreshSchedule(
      row.refresh_schedule,
      next.refreshes_per_day,
      new Date(),
    );
    await this.settingsRepo.save(row);
    return next;
  }

  async bootstrap(): Promise<TwatterBootstrap> {
    await this.syncAccounts();
    const settings = await this.getSettings();
    const schedule = await this.ensureRefreshSchedule();
    const scheduler = twatterRefreshSchedulerStatus(schedule, new Date());
    const accountRows = await this.accounts.find({
      order: { display_name: "ASC" },
    });
    const accounts = accountRows.map((row) => this.toAccount(row));

    const postRows = await this.posts.find({
      order: { created_at: "DESC" },
      take: TWATTER_FEED_LIMIT,
    });
    const postIds = postRows.map((row) => row.id);
    const interactionRows = postIds.length
      ? await this.interactions.find({
          where: { post_id: In(postIds) },
          order: { created_at: "ASC" },
        })
      : [];

    const digestRows = await this.digests.find({
      order: { created_at: "DESC" },
      take: 100,
    });

    return {
      settings,
      scheduler,
      accounts,
      posts: postRows.map((row) => this.toPost(row)),
      interactions: interactionRows.map((row) => this.toInteraction(row)),
      digests: digestRows.map((row) => this.toDigest(row)),
    };
  }

  async createPost(input: CreateTwatterPostInput): Promise<TwatterPost> {
    const content = normalizeTwatterContent(input.content);
    if (!content) {
      throw new BadRequestException("Post content cannot be empty");
    }

    const account = await this.requirePersonaAccount(input.persona_id);
    const now = new Date().toISOString();
    const metadata =
      input.poll && input.poll.options.filter(Boolean).length >= 2
        ? buildTwatterPollMetadata(input.poll)
        : {};

    const postId = randomUUID();
    const imageInput = normalizeTwatterPostImageInput(input.image_url);
    let imageUrl: string | null = null;
    if (imageInput?.startsWith("data:")) {
      await writeTwatterPostImage(postId, imageInput);
      imageUrl = twatterPostImagePublicUrl(postId);
    } else if (imageInput) {
      imageUrl = imageInput;
    }

    const entity = this.posts.create({
      id: postId,
      author_account_id: account.id,
      content,
      image_url: imageUrl,
      parent_post_id: input.parent_post_id ?? null,
      quote_post_id: input.quote_post_id ?? null,
      source: "manual",
      metadata,
      author_snapshot: accountSnapshot(account),
      created_at: now,
      updated_at: now,
    });
    const saved = await this.posts.save(entity);

    const mentionAccountIds = this.resolveMentionedAccountIds(
      content,
      await this.accounts.find(),
    );
    await this.createDigest({
      accountIds: [account.id, ...mentionAccountIds],
      content: `${account.handle} posted: ${content}`,
    });

    return this.toPost(saved);
  }

  async updatePost(
    id: string,
    personaId: string,
    input: UpdateTwatterPostInput,
  ): Promise<TwatterPost> {
    const row = await this.posts.findOneBy({ id });
    if (!row) throw new NotFoundException(`Post ${id} not found`);
    const account = await this.requirePersonaAccount(personaId);
    if (row.author_account_id !== account.id) {
      throw new BadRequestException("You can only edit your own posts.");
    }
    if (input.content !== undefined) {
      row.content = normalizeTwatterContent(input.content);
    }
    row.updated_at = new Date().toISOString();
    return this.toPost(await this.posts.save(row));
  }

  async removePost(id: string, personaId: string): Promise<void> {
    const row = await this.posts.findOneBy({ id });
    if (!row) throw new NotFoundException(`Post ${id} not found`);
    const account = await this.requirePersonaAccount(personaId);
    if (row.author_account_id !== account.id) {
      throw new BadRequestException("You can only delete your own posts.");
    }
    await this.interactions.delete({ post_id: id });
    await this.posts.delete({ id });
  }

  async createInteraction(
    postId: string,
    input: CreateTwatterInteractionInput,
  ): Promise<TwatterInteraction | null> {
    const post = await this.posts.findOneBy({ id: postId });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);
    const actor = await this.requirePersonaAccount(input.persona_id);
    const now = new Date().toISOString();

    if (input.type === "like" || input.type === "repost") {
      const existing = await this.interactions.findOneBy({
        actor_account_id: actor.id,
        post_id: postId,
        type: input.type,
      });
      if (existing) return this.toInteraction(existing);
    }

    if (input.type === "vote") {
      const existingVote = await this.interactions.findOneBy({
        actor_account_id: actor.id,
        post_id: postId,
        type: "vote",
      });
      if (existingVote) return this.toInteraction(existingVote);
    }

    if (input.type === "reply" && !input.content?.trim()) {
      throw new BadRequestException("Replies need text.");
    }

    const entity = this.interactions.create({
      id: randomUUID(),
      actor_account_id: actor.id,
      post_id: postId,
      type: input.type,
      content:
        input.type === "reply"
          ? input.content!.trim().slice(0, 2000)
          : input.type === "vote"
            ? input.poll_option_id ?? "0"
            : null,
      parent_interaction_id: input.parent_interaction_id ?? null,
      actor_snapshot: accountSnapshot(actor),
      created_at: now,
      updated_at: now,
    });
    const saved = await this.interactions.save(entity);

    if (input.type !== "like") {
      const postAuthor = await this.accounts.findOneBy({
        id: post.author_account_id,
      });
      await this.createDigest({
        accountIds: [actor.id, post.author_account_id],
        content:
          input.type === "reply"
            ? `${actor.handle} replied: ${input.content?.trim()}`
            : input.type === "repost"
              ? `${actor.handle} reposted ${postAuthor?.handle ?? "a post"}`
              : `${actor.handle} voted on a poll`,
      });
    }

    return this.toInteraction(saved);
  }

  async removeInteraction(
    postId: string,
    input: RemoveTwatterInteractionInput,
  ): Promise<void> {
    const actor = await this.requirePersonaAccount(input.persona_id);
    await this.interactions.delete({
      actor_account_id: actor.id,
      post_id: postId,
      type: input.type,
    });
  }

  async updateAccountProfile(
    accountId: string,
    personaId: string,
    input: TwatterAccountProfileUpdateInput,
  ): Promise<TwatterAccount> {
    const account = await this.requirePersonaAccount(personaId);
    if (account.id !== accountId) {
      throw new BadRequestException("You can only edit your own profile.");
    }
    const row = await this.accounts.findOneBy({ id: accountId });
    if (!row) throw new NotFoundException(`Account ${accountId} not found`);

    if (input.display_name !== undefined) {
      row.display_name = input.display_name.trim();
    }
    if (input.handle !== undefined) {
      row.handle = normalizeTwatterHandle(input.handle);
    }
    if (input.bio !== undefined) row.bio = input.bio.trim();
    if (input.location !== undefined) {
      row.settings = {
        ...row.settings,
        profile: { ...row.settings.profile, location: input.location.trim() },
      };
      row.settings.profile.profile_manually_edited = true;
    }
    row.updated_at = new Date().toISOString();
    return this.toAccount(await this.accounts.save(row));
  }

  async inviteCharacter(characterId: string): Promise<TwatterSettings> {
    const character = await this.characters.findOne(characterId);
    const settings = await this.getSettings();
    if (!settings.invited_character_ids.includes(characterId)) {
      settings.invited_character_ids.push(characterId);
      await this.updateSettings(settings);
    }
    await this.upsertCharacterAccount(characterId, character.data.name, true);
    return this.getSettings();
  }

  async uninviteCharacter(characterId: string): Promise<TwatterSettings> {
    const settings = await this.getSettings();
    settings.invited_character_ids = settings.invited_character_ids.filter(
      (id) => id !== characterId,
    );
    await this.updateSettings(settings);
    const row = await this.accounts.findOneBy({
      kind: "character",
      entity_id: characterId,
    });
    if (row) {
      row.invited = false;
      row.updated_at = new Date().toISOString();
      await this.accounts.save(row);
    }
    return settings;
  }

  async setFollow(
    targetAccountId: string,
    personaId: string,
    following: boolean,
  ): Promise<TwatterAccount> {
    const persona = await this.requirePersonaAccount(personaId);
    const target = await this.accounts.findOneBy({ id: targetAccountId });
    if (!target) throw new NotFoundException("Account not found");
    if (target.kind !== "character") {
      throw new BadRequestException("You can only follow character accounts.");
    }
    await this.setFollowInternal(persona.id, target.id, following);
    return this.requirePersonaAccount(personaId);
  }

  async setFollowInternal(
    followerAccountId: string,
    targetAccountId: string,
    following: boolean,
  ): Promise<void> {
    const row = await this.accounts.findOneBy({ id: followerAccountId });
    if (!row) return;
    const social = row.settings.social;
    const ids = new Set(social.following_account_ids);
    const timestamps = { ...social.following_account_timestamps };
    if (following) {
      ids.add(targetAccountId);
      timestamps[targetAccountId] = new Date().toISOString();
    } else {
      ids.delete(targetAccountId);
      delete timestamps[targetAccountId];
    }
    row.settings = {
      ...row.settings,
      social: {
        ...social,
        following_account_ids: [...ids],
        following_account_timestamps: timestamps,
      },
    };
    row.updated_at = new Date().toISOString();
    await this.accounts.save(row);
  }

  async resetTimeline(): Promise<void> {
    await this.interactions.clear();
    await this.posts.clear();
    await this.digests.clear();
  }

  async search(query: string, limit = 24): Promise<TwatterSearchResult> {
    const q = query.trim().toLowerCase();
    if (!q) {
      return { accounts: [], posts: [] };
    }
    const max = Math.min(50, Math.max(1, limit));
    const accountRows = await this.accounts.find({
      order: { display_name: "ASC" },
    });
    const accounts = accountRows
      .map((row) => this.toAccount(row))
      .filter((account) => {
        const haystack = [
          account.handle,
          account.display_name,
          account.bio,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, max);

    const postRows = await this.posts.find({
      order: { created_at: "DESC" },
      take: TWATTER_FEED_LIMIT,
    });
    const posts = postRows
      .map((row) => this.toPost(row))
      .filter((post) => post.content.toLowerCase().includes(q))
      .slice(0, max);

    return { accounts, posts };
  }

  async getAccountProfile(
    accountId: string,
    personaId?: string | null,
  ): Promise<TwatterAccountProfile> {
    const row = await this.accounts.findOneBy({ id: accountId });
    if (!row) throw new NotFoundException(`Account ${accountId} not found`);
    const account = this.toAccount(row);

    const postRows = await this.posts.find({
      where: { author_account_id: accountId },
      order: { created_at: "DESC" },
      take: TWATTER_FEED_LIMIT,
    });
    const posts = postRows.map((item) => this.toPost(item));
    const mediaPosts = posts.filter((post) => Boolean(post.image_url));

    const allAccounts = await this.accounts.find();
    const followerCount = allAccounts.filter((item) =>
      item.settings.social.following_account_ids.includes(accountId),
    ).length;

    let likedPosts: TwatterPost[] = [];
    if (personaId) {
      const personaAccount = await this.requirePersonaAccount(personaId);
      const likedPostIds = (
        await this.interactions.find({
          where: {
            actor_account_id: personaAccount.id,
            type: "like",
          },
          order: { created_at: "DESC" },
          take: TWATTER_FEED_LIMIT,
        })
      ).map((item) => item.post_id);
      if (likedPostIds.length > 0) {
        const likedRows = await this.posts.find({
          where: { id: In(likedPostIds) },
        });
        likedPosts = likedRows.map((item) => this.toPost(item));
      }
    }

    return {
      ...account,
      posts,
      liked_posts: likedPosts,
      media_posts: mediaPosts,
      follower_count: followerCount,
      following_count: account.settings.social.following_account_ids.length,
    };
  }

  async getNotifications(
    personaId: string,
    unreadOnly = false,
  ): Promise<TwatterNotificationsResponse> {
    const bootstrap = await this.bootstrap();
    const personaAccount = bootstrap.accounts.find(
      (account) =>
        account.kind === "persona" && account.entity_id === personaId,
    );
    if (!personaAccount) {
      throw new NotFoundException(`Persona account for ${personaId} not found`);
    }

    const unreadCount = countUnreadTwatterNotifications({
      personaAccount,
      posts: bootstrap.posts,
      interactions: bootstrap.interactions,
      accounts: bootstrap.accounts,
    });

    const notifications = buildTwatterNotifications({
      personaAccount,
      posts: bootstrap.posts,
      interactions: bootstrap.interactions,
      accounts: bootstrap.accounts,
      readAt: unreadOnly
        ? personaAccount.settings.social.notifications_read_at
        : null,
    });

    return {
      notifications,
      unread_count: unreadCount,
    };
  }

  async markNotificationsRead(personaId: string): Promise<TwatterAccount> {
    const row = await this.accounts.findOneBy({
      kind: "persona",
      entity_id: personaId,
    });
    if (!row) {
      throw new NotFoundException(`Persona account for ${personaId} not found`);
    }
    row.settings = {
      ...row.settings,
      social: mergeAccountSocialSettings(row.settings.social, {
        notifications_read_at: new Date().toISOString(),
      }),
    };
    row.updated_at = new Date().toISOString();
    return this.toAccount(await this.accounts.save(row));
  }

  async getPostImage(postId: string): Promise<StreamableFile> {
    const ext = await twatterImageExists(postId);
    if (!ext) {
      throw new NotFoundException(`Image for post ${postId} not found`);
    }
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    return new StreamableFile(createReadStream(twatterImageFilePath(postId, ext)), {
      type: mime,
      disposition: "inline",
    });
  }

  async listOptedInChats(): Promise<ChatEntity[]> {
    return this.chats.find({ order: { updated_at: "DESC" } });
  }

  async resolvePersonaName(personaId: string | null): Promise<string> {
    if (!personaId) return "User";
    try {
      const persona = await this.personas.findOne(personaId);
      return persona.name.trim() || "User";
    } catch {
      return "User";
    }
  }

  async resolveCharacterName(characterId: string): Promise<string> {
    try {
      const character = await this.characters.findOne(characterId);
      return character.data.name.trim() || "Character";
    } catch {
      return "Character";
    }
  }

  async buildCarryoverBlock(input: {
    chatMode: ChatMode;
    characterIds: string[];
    personaId: string | null;
  }): Promise<string | null> {
    const settings = await this.getSettings();
    if (!modeAllowsTwatterCarryover(settings.carryover_modes, input.chatMode)) {
      return null;
    }

    const accountIds = new Set<string>();
    if (input.personaId) {
      const personaAccount = await this.accounts.findOneBy({
        kind: "persona",
        entity_id: input.personaId,
      });
      if (personaAccount) accountIds.add(personaAccount.id);
    }

    const characterAccounts = await this.accounts.find({
      where: {
        kind: "character",
        entity_id: In(input.characterIds.length ? input.characterIds : ["__none__"]),
        invited: true,
      },
    });
    for (const account of characterAccounts) {
      accountIds.add(account.id);
    }
    if (accountIds.size === 0) return null;

    const since = new Date(
      Date.now() - settings.carryover_hours * 60 * 60 * 1000,
    ).toISOString();
    const digestRows = await this.digests
      .createQueryBuilder("digest")
      .where("digest.created_at >= :since", { since })
      .orderBy("digest.created_at", "DESC")
      .take(Math.max(settings.carryover_max_items * 4, 20))
      .getMany();

    const relevant = digestRows.filter((digest) =>
      digest.account_ids.some((id) => accountIds.has(id)),
    );

    return buildTwatterCarryoverBlock(
      relevant.map((digest) => ({ content: digest.content })),
      settings.carryover_max_items,
    );
  }

  private resolveMentionedAccountIds(
    content: string,
    accounts: TwatterAccountEntity[],
  ): string[] {
    const handles = extractTwatterMentionHandles(content);
    if (handles.length === 0) return [];
    const handleToId = new Map(
      accounts.map((account) => [
        normalizeTwatterHandle(account.handle).replace(/^@+/u, "").toLowerCase(),
        account.id,
      ]),
    );
    return handles
      .map((handle: string) => handleToId.get(handle))
      .filter((id): id is string => Boolean(id));
  }

  private async createDigest(input: {
    accountIds: string[];
    content: string;
  }): Promise<void> {
    if (!input.content.trim()) return;
    await this.digests.save(
      this.digests.create({
        id: randomUUID(),
        account_ids: [...new Set(input.accountIds)],
        content: input.content.trim().slice(0, 1200),
        created_at: new Date().toISOString(),
      }),
    );
  }

  private async syncAccounts(): Promise<void> {
    const settings = await this.getSettings();
    const personas = await this.personas.findAll();
    for (const persona of personas) {
      await this.upsertPersonaAccount(persona.id, persona.name, persona.avatar);
    }

    for (const characterId of settings.invited_character_ids) {
      try {
        const character = await this.characters.findOne(characterId);
        await this.upsertCharacterAccount(
          characterId,
          character.data.name,
          true,
          character.avatar,
        );
      } catch {
        // Character may have been deleted.
      }
    }

    if (settings.allow_random_users) {
      for (const profile of TWATTER_RANDOM_USERS) {
        await this.upsertRandomUserAccount(profile);
      }
    }
  }

  private async upsertPersonaAccount(
    personaId: string,
    name: string,
    avatar: string | null,
  ): Promise<TwatterAccountEntity> {
    const existing = await this.accounts.findOneBy({
      kind: "persona",
      entity_id: personaId,
    });
    const now = new Date().toISOString();
    const displayName = name.trim() || "Persona";
    if (existing) {
      existing.display_name = displayName;
      existing.avatar = avatar;
      existing.updated_at = now;
      return this.accounts.save(existing);
    }
    return this.accounts.save(
      this.accounts.create({
        id: randomUUID(),
        kind: "persona",
        entity_id: personaId,
        handle: twatterHandleFromName(displayName),
        display_name: displayName,
        bio: "",
        avatar,
        invited: true,
        settings: defaultTwatterAccountSettings(),
        created_at: now,
        updated_at: now,
      }),
    );
  }

  private async upsertCharacterAccount(
    characterId: string,
    name: string,
    invited: boolean,
    avatar: string | null = null,
  ): Promise<void> {
    const existing = await this.accounts.findOneBy({
      kind: "character",
      entity_id: characterId,
    });
    const now = new Date().toISOString();
    const displayName = name.trim() || "Character";
    if (existing) {
      existing.display_name = displayName;
      existing.invited = invited;
      if (avatar) existing.avatar = avatar;
      existing.updated_at = now;
      await this.accounts.save(existing);
      return;
    }
    await this.accounts.save(
      this.accounts.create({
        id: randomUUID(),
        kind: "character",
        entity_id: characterId,
        handle: twatterHandleFromName(displayName),
        display_name: displayName,
        bio: "",
        avatar,
        invited,
        settings: defaultTwatterAccountSettings(),
        created_at: now,
        updated_at: now,
      }),
    );
  }

  private async upsertRandomUserAccount(profile: {
    entity_id: string;
    display_name: string;
    bio: string;
  }): Promise<void> {
    const existing = await this.accounts.findOneBy({
      kind: "random_user",
      entity_id: profile.entity_id,
    });
    const now = new Date().toISOString();
    if (existing) {
      existing.invited = true;
      existing.updated_at = now;
      await this.accounts.save(existing);
      return;
    }
    await this.accounts.save(
      this.accounts.create({
        id: randomUUID(),
        kind: "random_user",
        entity_id: profile.entity_id,
        handle: twatterHandleFromName(profile.display_name),
        display_name: profile.display_name,
        bio: profile.bio,
        avatar: null,
        invited: true,
        settings: defaultTwatterAccountSettings(),
        created_at: now,
        updated_at: now,
      }),
    );
  }

  private async requirePersonaAccount(personaId: string): Promise<TwatterAccount> {
    if (!personaId?.trim()) {
      throw new BadRequestException("Choose an active persona first.");
    }
    await this.syncAccounts();
    const row = await this.accounts.findOneBy({
      kind: "persona",
      entity_id: personaId,
    });
    if (!row) {
      throw new NotFoundException(`Persona account for ${personaId} not found`);
    }
    return this.toAccount(row);
  }

  private toAccount(row: TwatterAccountEntity): TwatterAccount {
    return {
      id: row.id,
      kind: row.kind,
      entity_id: row.entity_id,
      handle: row.handle,
      display_name: row.display_name,
      bio: row.bio,
      avatar: row.avatar,
      invited: row.invited,
      settings: row.settings,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private toPost(row: TwatterPostEntity): TwatterPost {
    return {
      id: row.id,
      author_account_id: row.author_account_id,
      content: row.content,
      image_url: row.image_url,
      parent_post_id: row.parent_post_id,
      quote_post_id: row.quote_post_id,
      source: row.source,
      metadata: row.metadata ?? {},
      author_snapshot: row.author_snapshot,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private toInteraction(row: TwatterInteractionEntity): TwatterInteraction {
    return {
      id: row.id,
      actor_account_id: row.actor_account_id,
      post_id: row.post_id,
      type: row.type,
      content: row.content,
      parent_interaction_id: row.parent_interaction_id,
      actor_snapshot: row.actor_snapshot,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private toDigest(row: TwatterDigestEntity): TwatterDigestEntry {
    return {
      id: row.id,
      account_ids: row.account_ids,
      content: row.content,
      created_at: row.created_at,
    };
  }
}
