import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  activeMessageText,
  collectConversationKeyDetailSections,
  defaultChatSettings,
  formatConversationDateKey,
  formatConversationImportantMemoryBlock,
  formatConversationSummaryBlock,
  formatZonedConversationDate,
  formatZonedConversationTime,
  getConversationWeekMonday,
  normalizeConversationSummaryFailures,
  normalizeDaySummaries,
  normalizeConnectedChatIds,
  normalizePromptTimeZone,
  normalizeSummaryTailMessages,
  normalizeWeekSummaries,
  parseConversationDateKey,
  promptVisibleChatMessages,
  type Chat,
  type ChatMessage,
  type ConversationSummariesPatchBody,
  type ConversationSummaryBackfillInput,
  type ConversationSummaryBackfillResult,
  type DaySummaryEntry,
  type WeekSummaryEntry,
} from "@ai-hub/shared";
import type { WrapFormat } from "@ai-hub/shared";
import { completeWithConnection } from "../../utils/openrouter";
import { ConnectionsService } from "../connections/connections.service";
import { CharactersService } from "../characters/characters.service";
import { PersonasService } from "../personas/personas.service";
import { ChatEntity } from "./chat.entity";

type SummaryMessage = {
  id: string;
  role: string;
  content: string;
  character_id?: string | null;
  created_at: string;
};

type DayBucket = {
  date: string;
  messages: Array<{
    role: string;
    content: string;
    author: string;
    created_at: Date;
  }>;
};

const DAILY_TRANSCRIPT_CHUNK_CHARS = 32_000;
const MAX_SUMMARY_CHUNKS_PER_DAY = 12;

@Injectable()
export class ConversationSummaryService {
  constructor(
    @InjectRepository(ChatEntity)
    private readonly chats: Repository<ChatEntity>,
    private readonly connections: ConnectionsService,
    private readonly characters: CharactersService,
    private readonly personas: PersonasService,
  ) {}

  async patchSummaries(
    chatId: string,
    body: ConversationSummariesPatchBody,
  ): Promise<Chat> {
    const row = await this.requireRow(chatId);
    if (row.mode !== "conversation") {
      throw new BadRequestException(
        "Day/week summaries are only available for conversation chats.",
      );
    }
    row.day_summaries = {
      ...normalizeDaySummaries(row.day_summaries),
      ...normalizeDaySummaries(body.day_summaries),
    };
    row.week_summaries = {
      ...normalizeWeekSummaries(row.week_summaries),
      ...normalizeWeekSummaries(body.week_summaries),
    };
    row.updated_at = new Date().toISOString();
    return this.toChat(await this.chats.save(row));
  }

  async backfillSummaries(
    chatId: string,
    input: ConversationSummaryBackfillInput = {},
  ): Promise<ConversationSummaryBackfillResult & { chat: Chat }> {
    const row = await this.requireRow(chatId);
    if (row.mode !== "conversation") {
      throw new BadRequestException(
        "Conversation summary backfill is only available for conversation chats.",
      );
    }
    const maxMissingDays = Math.max(
      1,
      Math.min(60, Math.floor(input.max_missing_days ?? 14)),
    );
    const prepared = await this.runAutoSummaries(row, maxMissingDays);
    row.day_summaries = prepared.day_summaries;
    row.week_summaries = prepared.week_summaries;
    row.conversation_summary_failures = prepared.conversation_summary_failures;
    row.updated_at = new Date().toISOString();
    const saved = await this.chats.save(row);
    return {
      chat: this.toChat(saved),
      generated_days: prepared.generated_days,
      consolidated_weeks: prepared.consolidated_weeks,
      failed_days: prepared.failed_days,
      failed_weeks: prepared.failed_weeks,
      missing_day_count: prepared.missing_day_count,
      processed_day_count: prepared.processed_day_count,
      remaining_missing_day_count: prepared.remaining_missing_day_count,
    };
  }

  async prepareConversationPrompt(input: {
    row: ChatEntity;
    historyMessages: ChatMessage[];
    personaName: string;
    nameByCharacterId: Map<string, string>;
    wrapFormat: WrapFormat;
    maxMissingDays?: number;
  }): Promise<{
    chatHistory: string;
    importantMemory: string | null;
    rowPatches: Partial<ChatEntity> | null;
  }> {
    const settings = defaultChatSettings(input.row.settings);
    const run = await this.runAutoSummaries(
      input.row,
      input.maxMissingDays ?? 2,
    );
    const rowPatches =
      run.metadata_changed
        ? {
            day_summaries: run.day_summaries,
            week_summaries: run.week_summaries,
            conversation_summary_failures: run.conversation_summary_failures,
          }
        : null;

    const chatHistory = this.buildFlattenedHistory({
      messages: input.historyMessages,
      day_summaries: run.day_summaries,
      week_summaries: run.week_summaries,
      settings,
      personaName: input.personaName,
      nameByCharacterId: input.nameByCharacterId,
      wrapFormat: input.wrapFormat,
    });
    const importantMemory = formatConversationImportantMemoryBlock(
      collectConversationKeyDetailSections({
        day_summaries: run.day_summaries,
        week_summaries: run.week_summaries,
      }),
      input.wrapFormat,
    );
    return { chatHistory, importantMemory, rowPatches };
  }

  private async runAutoSummaries(row: ChatEntity, maxMissingDays: number) {
    const settings = defaultChatSettings(row.settings);
    const connection = settings.summary_connection_id
      ? await this.connections.findOne(settings.summary_connection_id)
      : settings.connection_id
        ? await this.connections.findOne(settings.connection_id)
        : await this.connections.findDefault("llm");
    const persona = settings.persona_id
      ? await this.personas.findOne(settings.persona_id).catch(() => null)
      : null;
    const personaName = persona?.name?.trim() || "User";
    const charIdToName = new Map<string, string>();
    for (const characterId of settings.character_ids) {
      try {
        const character = await this.characters.findOne(characterId);
        charIdToName.set(
          characterId,
          character.data.name.trim() || "Character",
        );
      } catch {
        charIdToName.set(characterId, "Character");
      }
    }

    const rolloverHour = Math.max(
      0,
      Math.min(11, Math.floor(settings.day_rollover_hour ?? 4)),
    );
    const timeZone = normalizePromptTimeZone(settings.prompt_timezone);
    const now = new Date();
    const todayKey = formatZonedConversationDate(now, timeZone, rolloverHour);
    const daySummaries = normalizeDaySummaries(row.day_summaries);
    const weekSummaries = normalizeWeekSummaries(row.week_summaries);
    const summaryFailures = normalizeConversationSummaryFailures(
      row.conversation_summary_failures,
    );
    let metadataChanged = false;

    const sourceMessages = promptVisibleChatMessages(row.messages ?? [])
      .filter((message) => message.created_at)
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: activeMessageText(message).trim(),
        character_id: message.character_id ?? null,
        created_at: message.created_at,
      }))
      .filter((message) => message.content);

    const buckets = this.buildDayBuckets(
      sourceMessages,
      personaName,
      charIdToName,
      rolloverHour,
      timeZone,
    );
    const pastBuckets = buckets.filter((bucket) => bucket.date !== todayKey);
    const missingBuckets = pastBuckets.filter(
      (bucket) => !daySummaries[bucket.date],
    );
    const bucketsToProcess = missingBuckets.slice(0, maxMissingDays);

    const generated_days: string[] = [];
    const consolidated_weeks: string[] = [];
    const failed_days: Array<{ date: string; error: string }> = [];
    const failed_weeks: Array<{ week_key: string; error: string }> = [];

    for (const bucket of bucketsToProcess) {
      try {
        const entry = await this.summarizeDayBucket(
          connection,
          bucket,
          settings.summary_max_tokens,
        );
        if (entry.summary || entry.key_details.length > 0) {
          daySummaries[bucket.date] = entry;
          generated_days.push(bucket.date);
          metadataChanged = true;
        }
      } catch (error) {
        failed_days.push({
          date: bucket.date,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const messageDaysByWeek = new Map<string, Set<string>>();
    for (const bucket of pastBuckets) {
      const weekKey = formatConversationDateKey(
        getConversationWeekMonday(parseConversationDateKey(bucket.date)),
      );
      const set = messageDaysByWeek.get(weekKey) ?? new Set<string>();
      set.add(bucket.date);
      messageDaysByWeek.set(weekKey, set);
    }

    const daysByWeek = new Map<
      string,
      Array<{ dateKey: string; entry: DaySummaryEntry }>
    >();
    for (const [dateKey, entry] of Object.entries(daySummaries)) {
      const weekKey = formatConversationDateKey(
        getConversationWeekMonday(parseConversationDateKey(dateKey)),
      );
      const list = daysByWeek.get(weekKey) ?? [];
      list.push({ dateKey, entry });
      daysByWeek.set(weekKey, list);
    }

    for (const [weekKey, days] of daysByWeek) {
      if (weekSummaries[weekKey]) continue;
      const monday = parseConversationDateKey(weekKey);
      const nextMonday = new Date(
        monday.getFullYear(),
        monday.getMonth(),
        monday.getDate() + 7,
      );
      const logicalNow = new Date(now.getTime() - rolloverHour * 3_600_000);
      if (logicalNow.getTime() < nextMonday.getTime()) continue;
      const messageDays = messageDaysByWeek.get(weekKey);
      if (messageDays && [...messageDays].some((dateKey) => !daySummaries[dateKey])) {
        continue;
      }
      try {
        days.sort(
          (a, b) =>
            parseConversationDateKey(a.dateKey).getTime() -
            parseConversationDateKey(b.dateKey).getTime(),
        );
        const sunday = new Date(
          monday.getFullYear(),
          monday.getMonth(),
          monday.getDate() + 6,
        );
        const rangeLabel = `${weekKey} – ${formatConversationDateKey(sunday)}`;
        const dayBlocks = days.map((day) => {
          const keyDetails =
            day.entry.key_details.length > 0
              ? `\nKey details: ${day.entry.key_details.join("; ")}`
              : "";
          return `[${day.dateKey}]\n${day.entry.summary}${keyDetails}`;
        });
        const entry = await this.summarizeTranscript(
          connection,
          this.weekSummarySystemPrompt(rangeLabel),
          dayBlocks.join("\n\n"),
          settings.summary_max_tokens,
        );
        if (entry.summary || entry.key_details.length > 0) {
          weekSummaries[weekKey] = entry;
          consolidated_weeks.push(weekKey);
          metadataChanged = true;
        }
      } catch (error) {
        failed_weeks.push({
          week_key: weekKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      day_summaries: daySummaries,
      week_summaries: weekSummaries,
      conversation_summary_failures: summaryFailures,
      metadata_changed: metadataChanged,
      generated_days,
      consolidated_weeks,
      failed_days,
      failed_weeks,
      missing_day_count: missingBuckets.length,
      processed_day_count: bucketsToProcess.length,
      remaining_missing_day_count: Math.max(
        0,
        missingBuckets.length - bucketsToProcess.length,
      ),
    };
  }

  private buildFlattenedHistory(input: {
    messages: ChatMessage[];
    day_summaries: Record<string, DaySummaryEntry>;
    week_summaries: Record<string, WeekSummaryEntry>;
    settings: ReturnType<typeof defaultChatSettings>;
    personaName: string;
    nameByCharacterId: Map<string, string>;
    wrapFormat: WrapFormat;
  }): string {
    const rolloverHour = Math.max(
      0,
      Math.min(11, Math.floor(input.settings.day_rollover_hour ?? 4)),
    );
    const timeZone = normalizePromptTimeZone(input.settings.prompt_timezone);
    const now = new Date();
    const todayKey = formatZonedConversationDate(now, timeZone, rolloverHour);
    const tailCount = normalizeSummaryTailMessages(
      input.settings.summary_tail_messages,
    );

    const dayToWeek = new Map<string, string>();
    for (const weekKey of Object.keys(input.week_summaries)) {
      const monday = parseConversationDateKey(weekKey);
      for (let i = 0; i < 7; i += 1) {
        const day = new Date(
          monday.getFullYear(),
          monday.getMonth(),
          monday.getDate() + i,
        );
        dayToWeek.set(formatConversationDateKey(day), weekKey);
      }
    }

    const buckets = this.buildDayBuckets(
      input.messages
        .filter((message) => message.created_at)
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: activeMessageText(message).trim(),
          character_id: message.character_id ?? null,
          created_at: message.created_at,
        }))
        .filter((message) => message.content),
      input.personaName,
      input.nameByCharacterId,
      rolloverHour,
      timeZone,
    );

    const tailMessages: Array<{
      role: string;
      content: string;
      author: string;
      created_at: Date;
    }> = [];
    if (tailCount > 0) {
      outer: for (let bi = buckets.length - 1; bi >= 0; bi -= 1) {
        const bucket = buckets[bi]!;
        if (bucket.date === todayKey) continue;
        if (!input.day_summaries[bucket.date]) continue;
        for (let mi = bucket.messages.length - 1; mi >= 0; mi -= 1) {
          const message = bucket.messages[mi]!;
          if (message.role === "system") continue;
          tailMessages.unshift(message);
          if (tailMessages.length >= tailCount) break outer;
        }
      }
    }

    const weekBlocksEmitted = new Set<string>();
    const lines: string[] = [];
    let tailEmitted = false;

    for (const bucket of buckets) {
      const weekKey = dayToWeek.get(bucket.date);
      if (weekKey && input.week_summaries[weekKey]) {
        if (!weekBlocksEmitted.has(weekKey)) {
          weekBlocksEmitted.add(weekKey);
          const weekEntry = input.week_summaries[weekKey]!;
          const monday = parseConversationDateKey(weekKey);
          const sunday = new Date(
            monday.getFullYear(),
            monday.getMonth(),
            monday.getDate() + 6,
          );
          lines.push(
            formatConversationSummaryBlock(
              `week="${weekKey} – ${formatConversationDateKey(sunday)}"`,
              weekEntry.summary,
              input.wrapFormat,
            ),
          );
        }
        continue;
      }

      const isToday = bucket.date === todayKey;

      if (!isToday && input.day_summaries[bucket.date]) {
        lines.push(
          formatConversationSummaryBlock(
            `date="${bucket.date}"`,
            input.day_summaries[bucket.date]!.summary,
            input.wrapFormat,
          ),
        );
        continue;
      }

      if (isToday && !tailEmitted && tailMessages.length > 0) {
        for (const message of tailMessages) {
          lines.push(this.formatTurnLine(message, timeZone));
        }
        tailEmitted = true;
      }

      for (const message of bucket.messages) {
        lines.push(this.formatTurnLine(message, timeZone));
      }
    }

    if (!tailEmitted && tailMessages.length > 0) {
      for (const message of tailMessages) {
        lines.push(this.formatTurnLine(message, timeZone));
      }
    }

    return lines.join("\n");
  }

  private formatTurnLine(
    message: DayBucket["messages"][number],
    timeZone?: string,
  ): string {
    const time = formatZonedConversationTime(message.created_at, timeZone);
    return `[${time}] ${message.author}: ${message.content}`;
  }

  private buildDayBuckets(
    messages: SummaryMessage[],
    personaName: string,
    charIdToName: Map<string, string>,
    rolloverHour: number,
    timeZone?: string,
  ): DayBucket[] {
    const buckets = new Map<string, DayBucket>();
    for (const message of messages) {
      const createdAt = new Date(message.created_at);
      if (!Number.isFinite(createdAt.getTime())) continue;
      const date = formatZonedConversationDate(
        createdAt,
        timeZone,
        rolloverHour,
      );
      const bucket = buckets.get(date) ?? { date, messages: [] };
      bucket.messages.push({
        role: message.role,
        content: message.content,
        author: this.messageAuthor(message, personaName, charIdToName),
        created_at: createdAt,
      });
      buckets.set(date, bucket);
    }
    return [...buckets.values()].sort(
      (a, b) =>
        parseConversationDateKey(a.date).getTime() -
        parseConversationDateKey(b.date).getTime(),
    );
  }

  private messageAuthor(
    message: SummaryMessage,
    personaName: string,
    charIdToName: Map<string, string>,
  ): string {
    if (message.role === "user") return personaName;
    if (message.character_id && charIdToName.has(message.character_id)) {
      return charIdToName.get(message.character_id)!;
    }
    if (message.role === "assistant") return "Character";
    return "System";
  }

  private async summarizeDayBucket(
    connection: Awaited<ReturnType<ConnectionsService["findDefault"]>>,
    bucket: DayBucket,
    maxTokens: number,
  ): Promise<DaySummaryEntry> {
    const transcriptLines = bucket.messages.map(
      (message) => `${message.author}: ${message.content}`,
    );
    const chunks = this.chunkTranscriptLines(
      transcriptLines,
      DAILY_TRANSCRIPT_CHUNK_CHARS,
    );
    if (chunks.length <= 1) {
      return this.summarizeTranscript(
        connection,
        this.dailySummarySystemPrompt(bucket.date, "a full day's"),
        chunks[0] ?? "",
        maxTokens,
      );
    }
    const partials: DaySummaryEntry[] = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const partial = await this.summarizeTranscript(
        connection,
        this.dailySummarySystemPrompt(
          bucket.date,
          `part ${i + 1} of ${chunks.length} of a long day's`,
        ),
        chunks[i]!,
        Math.min(maxTokens, 2048),
      );
      if (partial.summary || partial.key_details.length > 0) {
        partials.push(partial);
      }
    }
    const combinedInput = partials
      .map((entry, index) => {
        const keyDetails =
          entry.key_details.length > 0
            ? `\nKey details: ${entry.key_details.join("; ")}`
            : "";
        return `[Part ${index + 1}]\n${entry.summary}${keyDetails}`;
      })
      .join("\n\n");
    return this.summarizeTranscript(
      connection,
      [
        `You are a conversation memory assistant. You will receive partial summaries for ${bucket.date}.`,
        `Combine them into one final JSON object with "summary" and "keyDetails".`,
        `Remove duplicates, preserve unresolved promises/plans, and keep only durable details that matter later.`,
        `Respond with ONLY valid JSON. No markdown fences, no extra text.`,
      ].join("\n"),
      combinedInput,
      maxTokens,
    );
  }

  private async summarizeTranscript(
    connection: Awaited<ReturnType<ConnectionsService["findDefault"]>>,
    systemPrompt: string,
    userContent: string,
    maxTokens: number,
  ): Promise<DaySummaryEntry> {
    const result = await completeWithConnection(
      connection,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      {
        body: {
          overrides: {
            temperature: 0.3,
            max_tokens: maxTokens,
          },
        },
        parseThinking: false,
      },
    );
    return this.parseSummaryResponse(result.content ?? "");
  }

  private parseSummaryResponse(raw: string): DaySummaryEntry {
    const trimmed = raw.trim();
    const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const cleaned = fenceMatch ? fenceMatch[1]!.trim() : trimmed;
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    try {
      const parsed = JSON.parse(
        first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned,
      ) as Record<string, unknown>;
      const summary =
        typeof parsed.summary === "string" ? parsed.summary.trim() : trimmed;
      const rawDetails = parsed.keyDetails ?? parsed.key_details;
      const key_details = Array.isArray(rawDetails)
        ? rawDetails.filter(
            (detail): detail is string =>
              typeof detail === "string" && detail.trim().length > 0,
          )
        : [];
      return { summary, key_details };
    } catch {
      return { summary: trimmed, key_details: [] };
    }
  }

  private chunkTranscriptLines(lines: string[], maxChars: number): string[] {
    const chunks: string[] = [];
    let current = "";
    for (const line of lines) {
      const next = current ? `${current}\n${line}` : line;
      if (next.length > maxChars && current) {
        chunks.push(current);
        current = line;
      } else {
        current = next;
      }
    }
    if (current) chunks.push(current);
    return chunks.slice(0, MAX_SUMMARY_CHUNKS_PER_DAY);
  }

  private dailySummarySystemPrompt(date: string, scope: string): string {
    return [
      `You are a conversation memory assistant. You will receive ${scope} DM conversation from ${date}.`,
      `Produce a JSON object with two fields, in this order:`,
      ``,
      `1. "keyDetails" — An array of short, specific strings listing things the characters MUST remember going forward.`,
      `2. "summary" — A few short atmospheric notes (1-3 brief sentences, third person).`,
      `Respond with ONLY valid JSON. No markdown fences, no extra text.`,
    ].join("\n");
  }

  private weekSummarySystemPrompt(rangeLabel: string): string {
    return [
      `You are a conversation memory assistant. You will receive a week's worth of daily entries for ${rangeLabel}.`,
      `Produce a JSON object with "keyDetails" and "summary" consolidating the week arc.`,
      `Respond with ONLY valid JSON. No markdown fences, no extra text.`,
    ].join("\n");
  }

  private async requireRow(chatId: string): Promise<ChatEntity> {
    const row = await this.chats.findOneBy({ id: chatId });
    if (!row) throw new NotFoundException(`Chat ${chatId} not found`);
    return row;
  }

  private toChat(row: ChatEntity): Chat {
    return {
      id: row.id,
      title: row.title,
      mode: row.mode,
      settings: defaultChatSettings(row.settings),
      messages: row.messages ?? [],
      summary: row.summary ?? "",
      summary_entries: row.summary_entries ?? [],
      last_automatic_summary_message_id:
        row.last_automatic_summary_message_id ?? null,
      day_summaries: normalizeDaySummaries(row.day_summaries),
      week_summaries: normalizeWeekSummaries(row.week_summaries),
      conversation_summary_failures: normalizeConversationSummaryFailures(
        row.conversation_summary_failures,
      ),
      memory_chunks: Array.isArray(row.memory_chunks) ? row.memory_chunks : [],
      agent_state: row.agent_state ?? {},
      parent_chat_id: row.parent_chat_id ?? null,
      connected_chat_ids: normalizeConnectedChatIds(
        row.connected_chat_ids,
        row.connected_chat_id,
      ),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
