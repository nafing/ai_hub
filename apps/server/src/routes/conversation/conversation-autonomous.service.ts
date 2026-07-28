import {
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  activeCharacterIds,
  busyDelayMsForStatus,
  characterTalkativeness,
  dailyCapForCharacter,
  defaultChatSettings,
  emptyWeekSchedule,
  filterOnlineCharacterIds,
  getEffectiveCurrentStatus,
  inactivityThresholdMinutes,
  normalizeAutonomousDailyBudget,
  toConversationScheduleWallClockDate,
  type Chat,
  type ConversationMessageIntent,
  type ConversationPresenceStatus,
  type CurrentConversationStatus,
} from "@ai-hub/shared";
import { CharactersService } from "../characters/characters.service";
import { ChatEntity } from "../chats/chat.entity";
import { ChatsService } from "../chats/chats.service";

type ClientPresence = "active" | "idle" | "dnd";

type ChatActivityState = {
  lastUserMessageAt: number | null;
  lastAssistantMessageAt: number | null;
  autonomousSentCount: Map<string, number>;
  generationInProgressSince: number | null;
  clientPresence: ClientPresence;
  initialized: boolean;
};

export type AutonomousCheckResult = {
  shouldTrigger: boolean;
  characterId?: string;
  characterName?: string;
  intentKey?: ConversationMessageIntent;
  reason?: string;
};

export type BusyDelayResult = {
  delayMs: number;
  status: ConversationPresenceStatus;
  activity: string;
};

export type ExchangeResult = {
  shouldTrigger: boolean;
  characterId?: string;
  characterName?: string;
  reason?: string;
};

const GENERATION_CLAIM_TTL_MS = 5 * 60_000;

@Injectable()
export class ConversationAutonomousService {
  private readonly logger = new Logger(ConversationAutonomousService.name);
  private readonly activity = new Map<string, ChatActivityState>();

  constructor(
    @InjectRepository(ChatEntity)
    private readonly chats: Repository<ChatEntity>,
    private readonly characters: CharactersService,
    @Inject(forwardRef(() => ChatsService))
    private readonly chatsService: ChatsService,
  ) {}

  private getOrCreateActivity(chatId: string): ChatActivityState {
    let state = this.activity.get(chatId);
    if (!state) {
      state = {
        lastUserMessageAt: null,
        lastAssistantMessageAt: null,
        autonomousSentCount: new Map(),
        generationInProgressSince: null,
        clientPresence: "active",
        initialized: false,
      };
      this.activity.set(chatId, state);
    }
    if (
      state.generationInProgressSince &&
      Date.now() - state.generationInProgressSince > GENERATION_CLAIM_TTL_MS
    ) {
      state.generationInProgressSince = null;
    }
    return state;
  }

  private async requireConversationRow(chatId: string): Promise<ChatEntity> {
    const row = await this.chats.findOneBy({ id: chatId });
    if (!row) throw new Error(`Chat ${chatId} not found`);
    if (row.mode !== "conversation") {
      throw new Error("Autonomous messaging is only available in conversation mode");
    }
    return row;
  }

  private async ensureActivityInitialized(row: ChatEntity): Promise<ChatActivityState> {
    const state = this.getOrCreateActivity(row.id);
    if (state.initialized) return state;
    const messages = Array.isArray(row.messages) ? row.messages : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]!;
      const at = Date.parse(message.created_at);
      if (!Number.isFinite(at)) continue;
      if (message.role === "user" && state.lastUserMessageAt == null) {
        state.lastUserMessageAt = at;
      }
      if (message.role === "assistant" && state.lastAssistantMessageAt == null) {
        state.lastAssistantMessageAt = at;
      }
      if (state.lastUserMessageAt != null && state.lastAssistantMessageAt != null) {
        break;
      }
    }
    state.initialized = true;
    return state;
  }

  recordUserActivity(chatId: string): void {
    const state = this.getOrCreateActivity(chatId);
    state.lastUserMessageAt = Date.now();
    state.autonomousSentCount.clear();
    state.generationInProgressSince = null;
  }

  recordAssistantActivity(chatId: string, _characterId?: string | null): void {
    const state = this.getOrCreateActivity(chatId);
    state.lastAssistantMessageAt = Date.now();
    state.generationInProgressSince = null;
  }

  setClientPresence(chatId: string, presence: ClientPresence): void {
    const state = this.getOrCreateActivity(chatId);
    state.clientPresence = presence;
  }

  clearGenerationInProgress(chatId: string): void {
    const state = this.getOrCreateActivity(chatId);
    state.generationInProgressSince = null;
  }

  claimGeneration(chatId: string): boolean {
    const state = this.getOrCreateActivity(chatId);
    if (state.generationInProgressSince) return false;
    state.generationInProgressSince = Date.now();
    return true;
  }

  async getStatuses(chatId: string): Promise<{
    timezone: string | null;
    statuses: Record<
      string,
      CurrentConversationStatus & { characterName: string; talkativeness: number }
    >;
  }> {
    const row = await this.requireConversationRow(chatId);
    const settings = defaultChatSettings(row.settings);
    const timezone =
      settings.conversation_timezone ?? settings.prompt_timezone;
    const now = new Date();
    const wall = toConversationScheduleWallClockDate(now, timezone);
    const statuses: Record<
      string,
      CurrentConversationStatus & { characterName: string; talkativeness: number }
    > = {};

    for (const characterId of settings.character_ids) {
      const character = await this.characters.findOne(characterId).catch(() => null);
      if (!character) continue;
      const schedule = settings.conversation_schedules_enabled
        ? settings.character_schedules[characterId]
        : undefined;
      const status = getEffectiveCurrentStatus(
        schedule,
        settings.conversation_status_overrides[characterId],
        now,
        "free time",
        wall,
      );
      statuses[characterId] = {
        ...status,
        characterName: character.data.name.trim() || "Character",
        talkativeness: characterTalkativeness(character),
      };
    }

    return { timezone, statuses };
  }

  async checkAutonomous(chatId: string): Promise<AutonomousCheckResult> {
    const row = await this.requireConversationRow(chatId);
    const settings = defaultChatSettings(row.settings);
    if (!settings.autonomous_messages) {
      return { shouldTrigger: false, reason: "disabled" };
    }

    const state = await this.ensureActivityInitialized(row);
    if (state.clientPresence === "dnd") {
      return { shouldTrigger: false, reason: "user_dnd" };
    }
    if (state.generationInProgressSince) {
      return { shouldTrigger: false, reason: "generating" };
    }

    const activeIds = activeCharacterIds(settings);
    if (!activeIds.length) {
      return { shouldTrigger: false, reason: "no_characters" };
    }

    const { statuses } = await this.getStatuses(chatId);
    const statusMap: Record<string, ConversationPresenceStatus> = {};
    for (const [id, entry] of Object.entries(statuses)) {
      statusMap[id] = entry.status;
    }
    const onlineIds = filterOnlineCharacterIds({
      characterIds: activeIds,
      statuses: statusMap,
    }).filter((id) => statusMap[id] !== "offline");

    if (!onlineIds.length) {
      return { shouldTrigger: false, reason: "all_offline" };
    }

    const budget = normalizeAutonomousDailyBudget(
      settings.autonomous_daily_budget,
    );
    const now = Date.now();
    const lastUser = state.lastUserMessageAt ?? 0;
    const inactivityMs = lastUser > 0 ? now - lastUser : Number.POSITIVE_INFINITY;

    type Candidate = {
      id: string;
      name: string;
      score: number;
      thresholdMs: number;
      intent: ConversationMessageIntent;
    };
    const candidates: Candidate[] = [];

    for (const characterId of onlineIds) {
      const entry = statuses[characterId];
      if (!entry) continue;
      if (entry.status === "dnd") {
        // DND uses 3x threshold
      }
      const schedule = settings.character_schedules[characterId];
      const talk01 = entry.talkativeness;
      const thresholdMin = inactivityThresholdMinutes(schedule, talk01);
      const thresholdMs =
        entry.status === "dnd" ? thresholdMin * 3 * 60_000 : thresholdMin * 60_000;
      if (thresholdMs <= 0) continue;

      const cap = dailyCapForCharacter({
        talkativeness01: talk01,
        chatCapOverride: settings.autonomous_daily_cap_override,
        scheduleCapOverride: schedule?.autonomousDailyCapOverride,
      });
      const used = budget.counts[characterId] ?? 0;
      if (used >= cap) continue;

      const sent = state.autonomousSentCount.get(characterId) ?? 0;
      if (sent >= 3) continue;
      const cooldownMs = sent === 0 ? thresholdMs : thresholdMs * 2 ** sent;
      if (inactivityMs < cooldownMs) continue;

      let score = talk01 * 100;
      if (entry.status === "online") score += 20;
      if (entry.status === "idle") score += 5;

      candidates.push({
        id: characterId,
        name: entry.characterName,
        score,
        thresholdMs,
        intent: sent === 0 ? "check_in" : "after_busy",
      });
    }

    if (!candidates.length) {
      return { shouldTrigger: false, reason: "no_eligible" };
    }

    candidates.sort((a, b) => b.score - a.score);
    const pick = candidates[0]!;
    if (!this.claimGeneration(chatId)) {
      return { shouldTrigger: false, reason: "generating" };
    }

    return {
      shouldTrigger: true,
      characterId: pick.id,
      characterName: pick.name,
      intentKey: pick.intent,
    };
  }

  async busyDelay(
    chatId: string,
    characterId: string,
  ): Promise<BusyDelayResult> {
    const { statuses } = await this.getStatuses(chatId);
    const entry = statuses[characterId];
    const row = await this.requireConversationRow(chatId);
    const settings = defaultChatSettings(row.settings);
    const schedule = settings.character_schedules[characterId];
    const status = entry?.status ?? "online";
    const delayMs = busyDelayMsForStatus(status, schedule);
    return {
      delayMs,
      status,
      activity: entry?.activity ?? "free time",
    };
  }

  async checkExchange(
    chatId: string,
    excludeCharacterId?: string,
  ): Promise<ExchangeResult> {
    const row = await this.requireConversationRow(chatId);
    const settings = defaultChatSettings(row.settings);
    if (!settings.character_exchanges) {
      return { shouldTrigger: false, reason: "disabled" };
    }
    if (settings.character_ids.length < 2) {
      return { shouldTrigger: false, reason: "not_group" };
    }
    if (Math.random() > 0.55) {
      return { shouldTrigger: false, reason: "probability" };
    }

    const { statuses } = await this.getStatuses(chatId);
    const activeIds = activeCharacterIds(settings).filter(
      (id) => id !== excludeCharacterId,
    );
    const statusMap: Record<string, ConversationPresenceStatus> = {};
    for (const [id, entry] of Object.entries(statuses)) {
      statusMap[id] = entry.status;
    }
    const onlineIds = filterOnlineCharacterIds({
      characterIds: activeIds,
      statuses: statusMap,
    }).filter((id) => {
      const status = statusMap[id] ?? "online";
      return status !== "offline" && status !== "dnd";
    });
    if (!onlineIds.length) {
      return { shouldTrigger: false, reason: "no_online" };
    }

    const pick =
      onlineIds[Math.floor(Math.random() * onlineIds.length)] ?? onlineIds[0]!;
    const entry = statuses[pick];
    if (!this.claimGeneration(chatId)) {
      return { shouldTrigger: false, reason: "generating" };
    }
    return {
      shouldTrigger: true,
      characterId: pick,
      characterName: entry?.characterName ?? "Character",
    };
  }

  async bumpAutonomousBudget(
    chatId: string,
    characterId: string,
    intentKey?: string,
  ): Promise<void> {
    const row = await this.requireConversationRow(chatId);
    const settings = defaultChatSettings(row.settings);
    const budget = normalizeAutonomousDailyBudget(
      settings.autonomous_daily_budget,
    );
    budget.counts[characterId] = (budget.counts[characterId] ?? 0) + 1;
    const intentCooldowns = { ...settings.intent_cooldowns };
    if (intentKey) {
      intentCooldowns[characterId] = {
        ...(intentCooldowns[characterId] ?? {}),
        [intentKey]: new Date(Date.now() + 30 * 60_000).toISOString(),
      };
    }
    row.settings = defaultChatSettings({
      ...settings,
      autonomous_daily_budget: budget,
      intent_cooldowns: intentCooldowns,
    });
    row.updated_at = new Date().toISOString();
    await this.chats.save(row);

    const state = this.getOrCreateActivity(chatId);
    state.autonomousSentCount.set(
      characterId,
      (state.autonomousSentCount.get(characterId) ?? 0) + 1,
    );
    state.generationInProgressSince = null;
    this.logger.debug(
      "Bumped autonomous budget for %s in chat %s",
      characterId,
      chatId,
    );
  }

  async ensureDefaultSchedules(chatId: string): Promise<Chat> {
    const row = await this.requireConversationRow(chatId);
    const settings = defaultChatSettings(row.settings);
    const next = { ...settings.character_schedules };
    let changed = false;
    for (const characterId of settings.character_ids) {
      if (next[characterId]) continue;
      const character = await this.characters
        .findOne(characterId)
        .catch(() => null);
      const talk = character
        ? Math.round(characterTalkativeness(character) * 100)
        : 50;
      next[characterId] = emptyWeekSchedule(talk);
      changed = true;
    }
    if (changed) {
      row.settings = defaultChatSettings({
        ...settings,
        character_schedules: next,
      });
      row.updated_at = new Date().toISOString();
      await this.chats.save(row);
    }
    return this.chatsService.findOne(chatId);
  }
}
