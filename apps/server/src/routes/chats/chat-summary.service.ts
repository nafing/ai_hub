import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
import {
  appendChatSummaryEntry,
  clampSummaryContextSize,
  clampSummaryMaxTokens,
  clampSummaryRunInterval,
  compileChatSummaryEntries,
  computeSummaryHideIds,
  countUserMessagesAfterSummaryAnchor,
  createChatSummaryEntry,
  defaultChatSettings,
  formatRoleplaySummaryChatLog,
  normalizeChatSummaryEntries,
  normalizeConversationSummaryFailures,
  normalizeDaySummaries,
  normalizeSummaryTailMessages,
  normalizeWeekSummaries,
  parseChatSummaryText,
  resolveEntryUnhideIds,
  roleplaySummaryEnabled,
  selectRollingSummaryMessages,
  setMessagesHiddenFromPrompt,
  visibleChatMessages,
  type Chat,
  type ChatMessage,
  type ChatSummaryEntry,
  type GenerateChatSummaryInput,
  type SummaryEntriesPatchBody,
} from "@ai-hub/shared";
import { completeWithConnectionAndPreset } from "../../utils/openrouter";
import { ConnectionsService } from "../connections/connections.service";
import { CharactersService } from "../characters/characters.service";
import { PersonasService } from "../personas/personas.service";
import { PresetsService } from "../presets/presets.service";
import { ChatEntity } from "./chat.entity";

@Injectable()
export class ChatSummaryService {
  constructor(
    @InjectRepository(ChatEntity)
    private readonly chats: Repository<ChatEntity>,
    private readonly connections: ConnectionsService,
    private readonly characters: CharactersService,
    private readonly personas: PersonasService,
    private readonly presets: PresetsService,
  ) {}

  async generateSummary(
    chatId: string,
    input: GenerateChatSummaryInput = {},
  ): Promise<Chat> {
    const row = await this.requireRow(chatId);
    if (!roleplaySummaryEnabled(row.mode)) {
      throw new BadRequestException(
        "Chat summary generation is only available for roleplay chats.",
      );
    }

    const settings = defaultChatSettings(row.settings);
    const contextSize = clampSummaryContextSize(
      input.context_size ?? settings.summary_context_size,
    );
    const summaryMaxTokens = clampSummaryMaxTokens(settings.summary_max_tokens);
    const connection = await this.resolveSummaryConnection(settings);

    const messages = this.visibleBranchMessages(row.messages);
    const selectedResult = this.selectMessages(messages, input, contextSize, row);
    if ("error" in selectedResult) {
      throw new BadRequestException(selectedResult.error);
    }
    const selected = selectedResult;
    if (selected.messages.length === 0) {
      throw new BadRequestException(
        "No messages available for the requested summary range.",
      );
    }

    const previousSummary = compileChatSummaryEntries(
      normalizeChatSummaryEntries(row.summary_entries, {
        legacy_summary: row.summary,
      }),
    );
    const chatLog = await this.formatMessagesForSummary(
      selected.messages,
      settings,
    );
    const newText = await this.callSummaryModel({
      connection,
      previousSummary,
      chatLog,
      maxTokens: summaryMaxTokens,
      settings,
    });
    if (!newText) {
      throw new BadRequestException(
        "Summary model returned no new durable events to append.",
      );
    }

    const now = new Date().toISOString();
    const hiddenMessageIds = this.computeHiddenMessageIds(
      settings,
      messages,
      selected.messages,
    );
    const appended = appendChatSummaryEntry(
      row.summary_entries,
      row.summary,
      {
        id: randomUUID(),
        kind: "rolling",
        origin: "manual",
        title: selected.rangeStartIndex
          ? `Summary messages ${selected.rangeStartIndex}-${selected.rangeEndIndex}`
          : `Summary of ${selected.messages.length} messages`,
        content: newText,
        enabled: true,
        source_mode: selected.rangeStartIndex ? "range" : "last",
        message_count: selected.messages.length,
        range_start_index: selected.rangeStartIndex,
        range_end_index: selected.rangeEndIndex,
        message_ids: selected.messages.map((message) => message.id),
        hidden_message_ids:
          hiddenMessageIds.length > 0 ? hiddenMessageIds : undefined,
        created_at: now,
        updated_at: now,
      },
      { legacy_summary: row.summary, now },
    );

    row.summary_entries = appended.entries;
    row.summary = appended.summary;
    if (hiddenMessageIds.length > 0) {
      row.messages = setMessagesHiddenFromPrompt(
        normalizeMessages(row.messages),
        hiddenMessageIds,
        true,
      );
    }
    row.updated_at = now;
    return this.toChat(await this.chats.save(row));
  }

  async patchSummaryEntries(
    chatId: string,
    body: SummaryEntriesPatchBody,
  ): Promise<Chat> {
    const row = await this.requireRow(chatId);
    const now = new Date().toISOString();
    let entries = normalizeChatSummaryEntries(row.summary_entries, {
      legacy_summary: row.summary,
    });

    if (body.operation === "replace") {
      const existing = entries.find((entry) => entry.id === body.entry.id);
      entries = entries.map((entry) =>
        entry.id === body.entry.id
          ? createChatSummaryEntry(
              {
                ...existing,
                ...body.entry,
                updated_at: now,
              },
              { now },
            )
          : entry,
      );
    } else if (body.operation === "delete") {
      const target = entries.find((entry) => entry.id === body.entry_id);
      if (target) {
        const toUnhide = resolveEntryUnhideIds(target, entries);
        if (toUnhide.length > 0) {
          row.messages = setMessagesHiddenFromPrompt(
            normalizeMessages(row.messages),
            toUnhide,
            false,
          );
        }
      }
      entries = entries.filter((entry) => entry.id !== body.entry_id);
    } else if (body.operation === "toggle") {
      entries = entries.map((entry) =>
        entry.id === body.entry_id
          ? { ...entry, enabled: body.enabled, updated_at: now }
          : entry,
      );
    }

    row.summary_entries = entries;
    row.summary = compileChatSummaryEntries(entries);
    row.updated_at = now;
    return this.toChat(await this.chats.save(row));
  }

  async maybeRunAutomaticSummary(
    chatId: string,
    latestAssistantMessageId: string,
  ): Promise<Chat | null> {
    const row = await this.requireRow(chatId);
    if (!roleplaySummaryEnabled(row.mode)) return null;

    const settings = defaultChatSettings(row.settings);
    if (!settings.automatic_summary_enabled) return null;

    const messages = this.visibleBranchMessages(row.messages);
    const anchor = row.last_automatic_summary_message_id?.trim() || null;
    const interval = clampSummaryRunInterval(settings.summary_run_interval);
    const userMessagesSince = countUserMessagesAfterSummaryAnchor(
      messages,
      anchor,
    );
    if (userMessagesSince < interval) return null;

    const contextSize = clampSummaryContextSize(settings.summary_context_size);
    const selected = selectRollingSummaryMessages(
      messages,
      contextSize,
      normalizeChatSummaryEntries(row.summary_entries, {
        legacy_summary: row.summary,
      }),
    );
    if (selected.length === 0) return null;

    const previousSummary = compileChatSummaryEntries(
      normalizeChatSummaryEntries(row.summary_entries, {
        legacy_summary: row.summary,
      }),
    );
    const chatLog = await this.formatMessagesForSummary(selected, settings);
    const connection = await this.resolveSummaryConnection(settings);
    const newText = await this.callSummaryModel({
      connection,
      previousSummary,
      chatLog,
      maxTokens: clampSummaryMaxTokens(settings.summary_max_tokens),
      settings,
    });

    const now = new Date().toISOString();
    row.last_automatic_summary_message_id = latestAssistantMessageId;

    if (!newText) {
      row.updated_at = now;
      return this.toChat(await this.chats.save(row));
    }

    const hiddenMessageIds = this.computeHiddenMessageIds(
      settings,
      messages,
      selected,
    );
    const appended = appendChatSummaryEntry(
      row.summary_entries,
      row.summary,
      {
        id: randomUUID(),
        kind: "rolling",
        origin: "automated",
        title: `Automated summary (${selected.length} messages)`,
        content: newText,
        enabled: true,
        source_mode: "agent",
        message_count: selected.length,
        message_ids: selected.map((message) => message.id),
        hidden_message_ids:
          hiddenMessageIds.length > 0 ? hiddenMessageIds : undefined,
        created_at: now,
        updated_at: now,
      },
      { legacy_summary: row.summary, now },
    );

    row.summary_entries = appended.entries;
    row.summary = appended.summary;
    if (hiddenMessageIds.length > 0) {
      row.messages = setMessagesHiddenFromPrompt(
        normalizeMessages(row.messages),
        hiddenMessageIds,
        true,
      );
    }
    row.updated_at = now;
    return this.toChat(await this.chats.save(row));
  }

  private visibleBranchMessages(messages: ChatMessage[]): ChatMessage[] {
    return visibleChatMessages(normalizeMessages(messages));
  }

  private computeHiddenMessageIds(
    settings: ReturnType<typeof defaultChatSettings>,
    branchMessages: ChatMessage[],
    summarized: ChatMessage[],
  ): string[] {
    if (!settings.hide_summarised_messages) return [];
    return computeSummaryHideIds({
      messages: branchMessages,
      entryMessageIds: summarized.map((message) => message.id),
      tail: normalizeSummaryTailMessages(settings.summary_tail_messages),
    });
  }

  private selectMessages(
    messages: ChatMessage[],
    input: GenerateChatSummaryInput,
    contextSize: number,
    row: ChatEntity,
  ):
    | {
        messages: ChatMessage[];
        rangeStartIndex?: number;
        rangeEndIndex?: number;
        error?: undefined;
      }
    | { error: string; messages?: undefined } {
    const hasRangeById =
      Boolean(input.range_start_message_id) &&
      Boolean(input.range_end_message_id);
    const hasRangeByIndex =
      typeof input.range_start_index === "number" &&
      typeof input.range_end_index === "number";

    if (hasRangeById || hasRangeByIndex) {
      const startIndex = hasRangeByIndex
        ? input.range_start_index! - 1
        : messages.findIndex(
            (message) => message.id === input.range_start_message_id,
          );
      const endIndex = hasRangeByIndex
        ? input.range_end_index! - 1
        : messages.findIndex(
            (message) => message.id === input.range_end_message_id,
          );
      if (startIndex === -1 || endIndex === -1) {
        return { error: "Summary range messages were not found in this chat" };
      }
      const from = Math.min(startIndex, endIndex);
      const to = Math.max(startIndex, endIndex);
      if (to - from + 1 > 500) {
        return { error: "Summary ranges cannot include more than 500 messages" };
      }
      return {
        messages: messages.slice(from, to + 1),
        rangeStartIndex: from + 1,
        rangeEndIndex: to + 1,
      };
    }

    return {
      messages: selectRollingSummaryMessages(
        messages,
        contextSize,
        normalizeChatSummaryEntries(row.summary_entries, {
          legacy_summary: row.summary,
        }),
      ),
    };
  }

  private async resolveSummaryConnection(
    settings: ReturnType<typeof defaultChatSettings>,
  ) {
    if (settings.summary_connection_id) {
      return this.connections.findOne(settings.summary_connection_id);
    }
    if (settings.connection_id) {
      return this.connections.findOne(settings.connection_id);
    }
    return this.connections.findDefault("llm");
  }

  private async callSummaryModel(input: {
    connection: Awaited<ReturnType<ConnectionsService["findDefault"]>>;
    previousSummary: string;
    chatLog: string;
    maxTokens: number;
    settings: ReturnType<typeof defaultChatSettings>;
  }): Promise<string> {
    const preset = input.settings.summary_preset_id
      ? await this.presets.findOne(input.settings.summary_preset_id)
      : await this.presets.findDefault("chat_summary");
    if (preset.category !== "chat_summary") {
      throw new BadRequestException(
        "Summary preset must belong to the chat_summary category.",
      );
    }

    const result = await completeWithConnectionAndPreset(
      input.connection,
      preset,
      {
        prompt: {
          markers: {
            chat_summary: input.previousSummary || undefined,
            chat_history: input.chatLog || undefined,
          },
        },
        body: {
          overrides: {
            temperature: 0.5,
            max_tokens: input.maxTokens,
          },
        },
        parseThinking: false,
      },
    );
    return result.content ? parseChatSummaryText(result.content) : "";
  }

  private async formatMessagesForSummary(
    messages: ChatMessage[],
    settings: ReturnType<typeof defaultChatSettings>,
  ): Promise<string> {
    const persona = settings.persona_id
      ? await this.personas.findOne(settings.persona_id).catch(() => null)
      : null;
    const personaName = persona?.name?.trim() || "User";
    const characterNames = new Map<string, string>();
    for (const characterId of settings.character_ids) {
      try {
        const character = await this.characters.findOne(characterId);
        characterNames.set(
          characterId,
          character.data.name.trim() || "Character",
        );
      } catch {
        characterNames.set(characterId, "Character");
      }
    }

    return formatRoleplaySummaryChatLog(messages, (message) => {
      if (message.role === "user") return personaName;
      if (message.role === "system") return "system";
      if (message.character_id) {
        return characterNames.get(message.character_id) ?? "Assistant";
      }
      return "Assistant";
    });
  }

  private async requireRow(chatId: string): Promise<ChatEntity> {
    const row = await this.chats.findOneBy({ id: chatId });
    if (!row) throw new NotFoundException(`Chat ${chatId} not found`);
    return row;
  }

  private toChat(row: ChatEntity): Chat {
    const entries = normalizeChatSummaryEntries(row.summary_entries, {
      legacy_summary: row.summary,
    });
    return {
      id: row.id,
      title: row.title,
      mode: row.mode,
      settings: defaultChatSettings(row.settings),
      messages: normalizeMessages(row.messages),
      summary: compileChatSummaryEntries(entries) || row.summary || "",
      summary_entries: entries,
      last_automatic_summary_message_id:
        row.last_automatic_summary_message_id ?? null,
      day_summaries: normalizeDaySummaries(row.day_summaries),
      week_summaries: normalizeWeekSummaries(row.week_summaries),
      conversation_summary_failures: normalizeConversationSummaryFailures(
        row.conversation_summary_failures,
      ),
      agent_state: row.agent_state ?? {},
      parent_chat_id: row.parent_chat_id ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

function normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return Array.isArray(messages) ? messages : [];
}
