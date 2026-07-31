import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
import {
  activeMessageText,
  activeMessageAttachments,
  ancestorChatMessages,
  assignSwipeAttachments,
  assignSwipeCommandTags,
  activeMessageCommandTags,
  activeCharacterIds,
  applyRegexScriptsToPromptMessages,
  branchParentOf,
  buildAboutMePromptBlock,
  buildAwarenessBlock,
  buildConnectedParentChatBlock,
  buildConnectedLinkedRoleplayBlock,
  buildConnectedLinkInstructions,
  buildConnectedInfluencesBlock,
  buildConnectedNotesBlock,
  buildConnectedOocInstruction,
  parseConnectedSideEffectTags,
  parseOocTags,
  pruneConnectedNotes,
  buildPresetPromptContext,
  buildPromptMessages,
  buildCharacterGreetingMessage,
  buildConversationCommandsReminder,
  buildImpersonateInstruction,
  createChatMessage,
  defaultChatSettings,
  connectionWithChatParameters,
  normalizeConnectedChatIds,
  addConnectedChatId,
  removeConnectedChatId,
  effectiveChatContextLimit,
  extractThinking,
  fallbackSpeakerId,
  filterEnabledConversationCommands,
  filterOnlineCharacterIds,
  isConversationCommandEnabled,
  formatChatHistoryMarker,
  formatRecentHistoryForSmart,
  formatSmartCandidate,
  getEffectiveCurrentStatus,
  normalizeChatMessages,
  resolveConvoPostHistoryBlock,
  parseConversationCommands,
  parseSlashCommand,
  parseSmartSpeakerIds,
  primaryCharacterId,
  compileChatSummaryEntries,
  normalizeChatSummaryEntries,
  normalizeDaySummaries,
  normalizeWeekSummaries,
  normalizeConversationSummaryFailures,
  normalizeChatMemoryChunks,
  appendPendingMemoryChunks,
  rebuildMemoryChunks,
  recallMemoryChunks,
  recallLexicalMemories,
  roleplaySummaryEnabled,
  removeChatMessageSubtree,
  removeChatMessageSwipe,
  buildGroupChatRuntimeInstructions,
  buildConversationGroupOutputFormat,
  buildRoleplayDmCommandReminder,
  groupHistoryUsesSpeakerPrefix,
  parseDirectMessageCommands,
  resolveRoleplayDmTarget,
  formatUnresolvedRoleplayDmFallback,
  replaceRoleplayDmCommandText,
  resolveSpeakerQueue,
  selectedVariableValues,
  toConversationScheduleWallClockDate,
  unresolvedPresetVariables,
  visibleChatMessages,
  promptVisibleChatMessages,
  isMessageHiddenFromPrompt,
  CONVERSATION_COMMAND_KEYS,
  normalizeImageAspectRatio,
  normalizeImageResolution,
  type Character,
  type CharacterListItem,
  type Chat,
  type ChatListItem,
  type ChatMemoryChunk,
  type ChatMessage,
  type ChatMode,
  type ChatSettings,
  type ChatStreamEvent,
  type ConversationPresenceStatus,
  type CreateChatInput,
  type CreateChatMessageInput,
  type ChatMessageAttachment,
  type GenerateChatInput,
  type GenerateChatImageInput,
  type LlmChatMessage,
  type PeekPromptLoreHit,
  type PeekPromptResult,
  type SpeakerTurn,
  type UpdateChatInput,
  type UpdateChatMessageInput,
} from "@ai-hub/shared";
import { LoreRetrievalService } from "../lorebooks/lore-retrieval.service";
import {
  completeWithConnection,
  completeWithConnectionAndPreset,
  openRouterGenerateImage,
} from "../../utils/openrouter";
import { escapeQuotesForAttribute } from "../../utils/prompt/escape";
import { AgentRunnerService } from "../agents/agent-runner.service";
import { CharactersService } from "../characters/characters.service";
import { ConnectionsService } from "../connections/connections.service";
import { ConversationAutonomousService } from "../conversation/conversation-autonomous.service";
import { LorebooksService } from "../lorebooks/lorebooks.service";
import { PersonasService } from "../personas/personas.service";
import { PresetsService } from "../presets/presets.service";
import { RegexesService } from "../regexes/regexes.service";
import { TwatterService } from "../twatter/twatter.service";
import { imageApiPaths } from "../images/paths";
import {
  chatAttachmentExists,
  readChatAttachmentMeta,
  writeChatAttachment,
} from "../images/storage/chat-attachments";
import { ChatEntity } from "./chat.entity";
import { ChatSummaryService } from "./chat-summary.service";
import { ConversationSummaryService } from "./conversation-summary.service";

type StreamEmit = (event: ChatStreamEvent) => void;
type ResolvedConnection = Awaited<ReturnType<ConnectionsService["findOne"]>>;
type ResolvedPreset = Awaited<ReturnType<PresetsService["findOne"]>>;

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    @InjectRepository(ChatEntity)
    private readonly chats: Repository<ChatEntity>,
    private readonly connections: ConnectionsService,
    private readonly presets: PresetsService,
    private readonly characters: CharactersService,
    private readonly personas: PersonasService,
    private readonly lorebooks: LorebooksService,
    private readonly loreRetrieval: LoreRetrievalService,
    private readonly agentRunner: AgentRunnerService,
    private readonly regexes: RegexesService,
    private readonly twatter: TwatterService,
    private readonly chatSummary: ChatSummaryService,
    private readonly conversationSummary: ConversationSummaryService,
    @Inject(forwardRef(() => ConversationAutonomousService))
    private readonly conversationAutonomous: ConversationAutonomousService,
  ) {}

  /** Active group members for prompts; optionally include extra ids (e.g. regenerate target). */
  private async loadPromptCharacters(
    settings: ChatSettings,
    includeCharacterIds: string[] = [],
  ): Promise<Character[]> {
    const rosterIds = settings.character_ids.filter(Boolean);
    const promptIds = [
      ...new Set([
        ...activeCharacterIds(settings),
        ...includeCharacterIds.filter((id) => rosterIds.includes(id)),
      ]),
    ];
    const list: Character[] = [];
    for (const characterId of promptIds) {
      list.push(await this.characters.findOne(characterId));
    }
    return list;
  }

  /** Merge update_about_me tool overrides from agent_state into settings. */
  private withAboutMeAgentOverrides(
    settings: ChatSettings,
    agentState: Record<string, unknown>,
  ): ChatSettings {
    const raw = agentState.__about_me_overrides;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return settings;
    const overrides: Record<string, string> = {
      ...settings.conversation_about_me_overrides,
    };
    for (const [id, value] of Object.entries(raw)) {
      if (typeof value === "string" && value.trim()) overrides[id] = value;
    }
    return defaultChatSettings({
      ...settings,
      conversation_about_me_overrides: overrides,
    });
  }

  /** Mark offline schedule members inactive for this generation pass. */
  private async applyConversationPresenceFilter(
    settings: ChatSettings,
  ): Promise<ChatSettings> {
    const activeIds = activeCharacterIds(settings);
    if (!activeIds.length) return settings;

    const timezone =
      settings.conversation_timezone ?? settings.prompt_timezone;
    const now = new Date();
    const wall = toConversationScheduleWallClockDate(now, timezone);
    const statusMap: Record<string, ConversationPresenceStatus> = {};

    for (const characterId of activeIds) {
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
      statusMap[characterId] = status.status;
    }

    const onlineIds = filterOnlineCharacterIds({
      characterIds: activeIds,
      statuses: statusMap,
    });
    if (onlineIds.length === activeIds.length) return settings;

    const offlineIds = activeIds.filter((id) => !onlineIds.includes(id));
    return defaultChatSettings({
      ...settings,
      inactive_character_ids: [
        ...new Set([...settings.inactive_character_ids, ...offlineIds]),
      ],
    });
  }

  async findAll(): Promise<ChatListItem[]> {
    const rows = await this.chats.find({
      order: { updated_at: "DESC" },
    });
    return rows.map((row) => this.toListItem(row));
  }

  async findOne(id: string): Promise<Chat> {
    return this.toChat(await this.requireRow(id));
  }

  async create(input: CreateChatInput): Promise<Chat> {
    const settings = defaultChatSettings(input.settings);
    if (input.mode === "roleplay" && settings.character_ids.length === 0) {
      throw new BadRequestException(
        "At least one character is required for roleplay chats",
      );
    }

    if (input.parent_chat_id) {
      await this.requireRow(input.parent_chat_id);
    }

    const now = new Date().toISOString();
    const messages: ChatMessage[] = [];
    let title = input.title?.trim() || "";

    const resolvedCharacters = [];
    for (const characterId of settings.character_ids) {
      resolvedCharacters.push(await this.characters.findOne(characterId));
    }

    if (resolvedCharacters.length > 0) {
      if (!title && input.mode === "roleplay") {
        const names = resolvedCharacters
          .map((character) => character.data.name.trim())
          .filter(Boolean);
        title =
          names.length <= 1
            ? names[0] || "Roleplay"
            : names.length === 2
              ? `${names[0]} & ${names[1]}`
              : `${names[0]} +${names.length - 1}`;
      }

      if (!input.skip_greeting && input.mode === "roleplay") {
        for (const [index, character] of resolvedCharacters.entries()) {
          // Roleplay only: each character gets first_mes + alternate_greetings as swipe branches.
          // greeting_index only picks the initial active swipe for the primary.
          const greeting = buildCharacterGreetingMessage({
            character,
            greetingIndex: index === 0 ? input.greeting_index : 0,
            createdAt: now,
            id: randomUUID(),
          });
          if (!greeting) continue;
          messages.push({
            ...greeting,
            ...branchParentOf(messages),
          });
        }
      }
    }

    if (!title) {
      title = input.mode === "roleplay" ? "Roleplay" : "Conversation";
    }

    const entity = this.chats.create({
      id: randomUUID(),
      title,
      mode: input.mode,
      settings,
      messages,
      summary: "",
      summary_entries: [],
      last_automatic_summary_message_id: null,
      day_summaries: {},
      week_summaries: {},
      conversation_summary_failures: { days: {}, weeks: {} },
      memory_chunks: [],
      agent_state: {},
      parent_chat_id: input.parent_chat_id?.trim() || null,
      connected_chat_ids: [],
      connected_chat_id: null,
      created_at: now,
      updated_at: now,
    });
    const saved = await this.chats.save(entity);
    return this.toChat(saved);
  }

  async update(id: string, input: UpdateChatInput): Promise<Chat> {
    const row = await this.requireRow(id);
    if (input.title !== undefined) row.title = input.title.trim();
    if (input.summary !== undefined) row.summary = input.summary;
    if (input.agent_state !== undefined) row.agent_state = input.agent_state;
    if (input.settings) {
      row.settings = defaultChatSettings({
        ...row.settings,
        ...input.settings,
        lorebook_ids:
          input.settings.lorebook_ids ?? row.settings.lorebook_ids ?? [],
        agent_ids: input.settings.agent_ids ?? row.settings.agent_ids ?? [],
        agent_settings:
          input.settings.agent_settings ?? row.settings.agent_settings ?? {},
        character_ids:
          input.settings.character_ids ?? row.settings.character_ids ?? [],
        variables: input.settings.variables ?? row.settings.variables ?? {},
        character_dm_chat_ids:
          input.settings.character_dm_chat_ids ??
          row.settings.character_dm_chat_ids ??
          {},
        connected_pending_influences:
          input.settings.connected_pending_influences ??
          row.settings.connected_pending_influences ??
          [],
        connected_notes:
          input.settings.connected_notes ??
          row.settings.connected_notes ??
          [],
        chat_parameters:
          input.settings.chat_parameters ??
          row.settings.chat_parameters ??
          {},
      });
    }
    row.updated_at = new Date().toISOString();
    return this.toChat(await this.chats.save(row));
  }

  async remove(id: string): Promise<void> {
    const row = await this.requireRow(id);
    if (row.parent_chat_id) {
      await this.unlinkCharacterDm(row.parent_chat_id, id);
    }
    const linkedIds = this.connectedIdsOf(row);
    for (const partnerId of linkedIds) {
      await this.disconnectChat(id, partnerId);
    }
    await this.chats.delete({ id });
  }

  private connectedIdsOf(row: ChatEntity): string[] {
    return normalizeConnectedChatIds(row.connected_chat_ids, row.connected_chat_id);
  }

  private writeConnectedIds(row: ChatEntity, ids: string[]): void {
    row.connected_chat_ids = normalizeConnectedChatIds(ids);
    // Clear legacy single-id column once migrated.
    row.connected_chat_id = null;
  }

  /**
   * Bidirectional Conversation ↔ Roleplay link (many partners allowed).
   */
  async connectChats(chatId: string, targetChatId: string): Promise<Chat> {
    if (chatId === targetChatId) {
      throw new BadRequestException("Cannot link a chat to itself");
    }
    const a = await this.requireRow(chatId);
    const b = await this.requireRow(targetChatId);

    if (a.parent_chat_id || b.parent_chat_id) {
      throw new BadRequestException("Character DMs cannot be linked");
    }

    const modes = new Set([a.mode, b.mode]);
    if (!modes.has("conversation") || !modes.has("roleplay")) {
      throw new BadRequestException(
        "Link one conversation chat with one roleplay chat",
      );
    }

    const now = new Date().toISOString();
    this.writeConnectedIds(a, addConnectedChatId(this.connectedIdsOf(a), b.id));
    this.writeConnectedIds(b, addConnectedChatId(this.connectedIdsOf(b), a.id));
    a.updated_at = now;
    b.updated_at = now;
    await this.chats.save([a, b]);
    return this.toChat(a);
  }

  async disconnectChat(chatId: string, targetChatId?: string): Promise<Chat> {
    const row = await this.requireRow(chatId);
    const linkedIds = this.connectedIdsOf(row);
    if (!linkedIds.length) return this.toChat(row);

    const partnerId = targetChatId?.trim() || linkedIds[0];
    if (!partnerId || !linkedIds.includes(partnerId)) {
      throw new BadRequestException("Target chat is not linked to this chat");
    }

    const now = new Date().toISOString();
    const partner = await this.chats.findOneBy({ id: partnerId });

    const clearBridgeIfUnlinked = (entity: ChatEntity) => {
      if (entity.mode !== "roleplay") return;
      if (this.connectedIdsOf(entity).length > 0) return;
      entity.settings = defaultChatSettings({
        ...entity.settings,
        connected_pending_influences: [],
        connected_notes: [],
      });
    };

    this.writeConnectedIds(row, removeConnectedChatId(linkedIds, partnerId));
    row.updated_at = now;
    clearBridgeIfUnlinked(row);

    if (partner) {
      this.writeConnectedIds(
        partner,
        removeConnectedChatId(this.connectedIdsOf(partner), chatId),
      );
      partner.updated_at = now;
      clearBridgeIfUnlinked(partner);
      await this.chats.save([row, partner]);
    } else {
      await this.chats.save(row);
    }
    return this.toChat(await this.requireRow(chatId));
  }

  /**
   * Get or create a conversation DM for a character in this chat.
   * Requires `settings.allow_character_dms`.
   */
  async getOrCreateCharacterDm(
    parentId: string,
    characterId: string,
  ): Promise<Chat> {
    const parent = await this.requireRow(parentId);
    const settings = defaultChatSettings(parent.settings);

    if (!settings.allow_character_dms) {
      throw new BadRequestException("Character DMs are disabled for this chat");
    }
    if (!settings.character_ids.includes(characterId)) {
      throw new BadRequestException("Character is not in this chat");
    }

    const existingId = settings.character_dm_chat_ids[characterId];
    if (existingId) {
      const existing = await this.chats.findOneBy({ id: existingId });
      if (existing) return this.toChat(existing);
    }

    const character = await this.characters.findOne(characterId);
    const name = character.data.name.trim() || "Character";
    const dm = await this.create({
      mode: "conversation",
      title: `DM · ${name}`,
      parent_chat_id: parentId,
      skip_greeting: true,
      settings: {
        character_ids: [characterId],
        persona_id: settings.persona_id,
        connection_id: settings.connection_id,
        lorebook_ids: [],
        agent_ids: [],
        allow_character_dms: false,
        allow_twatter_references: settings.allow_twatter_references,
      },
    });

    parent.settings = defaultChatSettings({
      ...settings,
      character_dm_chat_ids: {
        ...settings.character_dm_chat_ids,
        [characterId]: dm.id,
      },
    });
    parent.updated_at = new Date().toISOString();
    await this.chats.save(parent);

    return dm;
  }

  private async unlinkCharacterDm(
    parentId: string,
    dmChatId: string,
  ): Promise<void> {
    const parent = await this.chats.findOneBy({ id: parentId });
    if (!parent) return;
    const settings = defaultChatSettings(parent.settings);
    const nextMap = { ...settings.character_dm_chat_ids };
    let changed = false;
    for (const [characterId, chatId] of Object.entries(nextMap)) {
      if (chatId === dmChatId) {
        delete nextMap[characterId];
        changed = true;
      }
    }
    if (!changed) return;
    parent.settings = defaultChatSettings({
      ...settings,
      character_dm_chat_ids: nextMap,
    });
    parent.updated_at = new Date().toISOString();
    await this.chats.save(parent);
  }

  private async appendChatMessage(
    chatId: string,
    input: {
      role: ChatMessage["role"];
      content: string;
      character_id?: string | null;
      roleplay_dm_source?: ChatMessage["roleplay_dm_source"];
    },
  ): Promise<ChatMessage> {
    const row = await this.requireRow(chatId);
    const message = createChatMessage({
      role: input.role,
      content: input.content.trim(),
      id: randomUUID(),
      character_id: input.character_id ?? null,
      roleplay_dm_source: input.roleplay_dm_source ?? null,
      ...branchParentOf(row.messages),
    });
    row.messages = [...normalizeChatMessages(row.messages), message];
    row.updated_at = new Date().toISOString();
    await this.chats.save(row);
    return message;
  }

  /**
   * Marinara-style `[dm: character="…" message="…"]` post-processing.
   */
  private async applyRoleplayDmCommands(input: {
    parentId: string;
    content: string;
    settings: ChatSettings;
    characterList: Character[];
    allCharacters: CharacterListItem[];
    historyMessages: ChatMessage[];
    emit: StreamEmit;
  }): Promise<string> {
    const parsed = parseDirectMessageCommands(input.content);
    if (parsed.commands.length === 0) return input.content;

    const roleplayCharacters = input.characterList.map((character) => ({
      id: character.id,
      name: character.data.name.trim() || "Character",
    }));
    const allForResolve = input.allCharacters.map((character) => ({
      id: character.id,
      data: { name: character.name },
    }));

    const sourceUserMessage = [...input.historyMessages]
      .reverse()
      .find((message) => message.role === "user");
    const sourceUserText = sourceUserMessage
      ? activeMessageText(sourceUserMessage).trim()
      : "";

    let nextContent = input.content;

    for (const command of parsed.commands) {
      const target = resolveRoleplayDmTarget(
        command.character,
        roleplayCharacters,
        allForResolve,
      );
      if (!target) {
        nextContent = replaceRoleplayDmCommandText(
          nextContent,
          command,
          formatUnresolvedRoleplayDmFallback(command),
        );
        continue;
      }

      nextContent = replaceRoleplayDmCommandText(nextContent, command, "");

      const settings = defaultChatSettings(input.settings);
      const existingId = settings.character_dm_chat_ids[target.id];
      const dm = await this.getOrCreateCharacterDm(input.parentId, target.id);

      if (sourceUserMessage && sourceUserText) {
        const dmRow = await this.requireRow(dm.id);
        const alreadyMirrored = dmRow.messages.some((message) => {
          const source = message.roleplay_dm_source;
          if (!source) return false;
          if (source.source_chat_id !== input.parentId) return false;
          if (source.source_user_message_id !== sourceUserMessage.id) {
            return false;
          }
          return source.target_character_id === target.id;
        });
        if (!alreadyMirrored) {
          await this.appendChatMessage(dm.id, {
            role: "user",
            content: sourceUserText,
            roleplay_dm_source: {
              source_chat_id: input.parentId,
              source_user_message_id: sourceUserMessage.id,
              target_character_id: target.id,
            },
          });
        }
      }

      await this.appendChatMessage(dm.id, {
        role: "assistant",
        content: command.message.trim(),
        character_id: target.id,
      });

      input.emit({
        type: "roleplay_dm",
        action: existingId ? "posted" : "created",
        chat_id: dm.id,
        chat_title: dm.title,
        character_id: target.id,
        character_name: target.name,
      });
    }

    return nextContent.replace(/\n{3,}/g, "\n\n").trim();
  }

  private async applyConversationCommands(input: {
    row: ChatEntity;
    content: string;
    /** Reasoning channel — models often put command tags here instead of SMS text. */
    thinking?: string | null;
    settings: ChatSettings;
    characterList: Character[];
    characterId: string | null;
    historyMessages: ChatMessage[];
    emit: StreamEmit;
  }): Promise<{
    content: string;
    thinking: string | null;
    attachments: ChatMessageAttachment[];
    commandTags: string[];
  }> {
    const contentParsed = parseConversationCommands(input.content);
    const thinkingParsed = input.thinking?.trim()
      ? parseConversationCommands(input.thinking)
      : { cleanContent: input.thinking ?? "", commands: [] };

    const seen = new Set<string>();
    const mergedCommands = [
      ...contentParsed.commands,
      ...thinkingParsed.commands,
    ].filter((command) => {
      if (seen.has(command.raw)) return false;
      seen.add(command.raw);
      return true;
    });

    const commands = filterEnabledConversationCommands(
      mergedCommands,
      input.settings.conversation_command_toggles,
    );

    let content = contentParsed.cleanContent || input.content;
    let thinking = thinkingParsed.commands.length
      ? thinkingParsed.cleanContent || null
      : input.thinking?.trim()
        ? input.thinking
        : null;
    let settings = defaultChatSettings(input.settings);
    const messages = [...normalizeChatMessages(input.row.messages)];
    const attachments: ChatMessageAttachment[] = [];
    const commandTags = commands.map((command) => command.raw);
    const failedImageTags: string[] = [];

    for (const command of commands) {
      if (command.type === "react") {
        const target =
          [...input.historyMessages].reverse().find((message) => {
            if (message.role !== "user" && message.role !== "assistant") {
              return false;
            }
            if (!command.targetName) return message.role === "user";
            const name = message.character_id
              ? input.characterList.find((c) => c.id === message.character_id)
                  ?.data.name
              : null;
            return (
              name &&
              name.toLowerCase().includes(command.targetName.toLowerCase())
            );
          }) ??
          [...input.historyMessages].reverse().find((m) => m.role === "user");
        if (target) {
          const index = messages.findIndex((m) => m.id === target.id);
          if (index >= 0) {
            const existing = messages[index]!;
            messages[index] = {
              ...existing,
              reactions: [
                ...(existing.reactions ?? []),
                {
                  emoji: command.emoji,
                  character_id: input.characterId,
                  created_at: new Date().toISOString(),
                },
              ],
            };
          }
          input.emit({
            type: "conversation_command",
            command: "react",
            character_id: input.characterId,
            detail: command.emoji,
            message_id: target.id,
          });
        }
      }

      if (command.type === "schedule_update") {
        const status =
          command.status === "online" ||
          command.status === "idle" ||
          command.status === "dnd" ||
          command.status === "offline"
            ? command.status
            : "idle";
        if (input.characterId) {
          settings = defaultChatSettings({
            ...settings,
            conversation_status_overrides: {
              ...settings.conversation_status_overrides,
              [input.characterId]: {
                status,
                activity: command.activity,
                expiresAt: command.duration
                  ? new Date(
                      Date.now() +
                        Math.max(1, Number.parseInt(command.duration, 10) || 30) *
                          60_000,
                    ).toISOString()
                  : null,
              },
            },
          });
        }
        input.emit({
          type: "conversation_command",
          command: "schedule_update",
          character_id: input.characterId,
          detail: `${status}${command.activity ? ` · ${command.activity}` : ""}`,
        });
      }

      if (command.type === "memory") {
        const target = input.characterList.find(
          (character) =>
            character.id === command.target.trim() ||
            character.data.name
              .toLowerCase()
              .includes(command.target.toLowerCase()),
        );
        const targetId = target?.id ?? input.characterId;
        if (targetId) {
          const prev = settings.character_memories[targetId] ?? [];
          settings = defaultChatSettings({
            ...settings,
            character_memories: {
              ...settings.character_memories,
              [targetId]: [...prev, command.summary].slice(-20),
            },
          });
        }
        input.emit({
          type: "conversation_command",
          command: "memory",
          character_id: targetId,
          detail: command.summary.slice(0, 120),
        });
      }

      if (command.type === "cross_post") {
        const allChats = await this.chats.find({
          order: { updated_at: "DESC" },
        });
        const targetChat = allChats.find((candidate) => {
          if (candidate.id === input.row.id) return false;
          if (candidate.mode !== "conversation") return false;
          const candidateSettings = defaultChatSettings(candidate.settings);
          const titleMatch = candidate.title
            .toLowerCase()
            .includes(command.target.toLowerCase());
          const shared = candidateSettings.character_ids.some((id) =>
            input.settings.character_ids.includes(id),
          );
          const nameMatch = candidateSettings.character_ids.some((id) => {
            const character = input.characterList.find((c) => c.id === id);
            return character?.data.name
              .toLowerCase()
              .includes(command.target.toLowerCase());
          });
          return shared && (titleMatch || nameMatch);
        });
        if (targetChat) {
          await this.appendChatMessage(targetChat.id, {
            role: "assistant",
            content: content || command.raw,
            character_id: input.characterId,
          });
          input.emit({
            type: "conversation_command",
            command: "cross_post",
            character_id: input.characterId,
            detail: targetChat.title,
            chat_id: targetChat.id,
          });
        }
      }

      if (command.type === "send_image") {
        try {
          const speaker =
            input.characterList.find((c) => c.id === input.characterId) ??
            input.characterList[0] ??
            null;
          const attachment = await this.generateConversationImageAttachment({
            chatId: input.row.id,
            brief: command.prompt,
            sourceCommand: command.raw,
            character: speaker,
            chatContext: this.buildConversationImageChatContext({
              messages: input.historyMessages,
              characterList: input.characterList,
              characterId: input.characterId,
              settings,
            }),
            aspectRatio: settings.image_aspect_ratio,
            resolution: settings.image_resolution,
          });
          attachments.push(attachment);
          input.emit({
            type: "conversation_command",
            command: "send_image",
            character_id: input.characterId,
            detail: command.prompt.slice(0, 120),
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Image generation failed";
          this.logger.warn(`send_image failed for chat ${input.row.id}: ${message}`);
          failedImageTags.push(command.raw);
          input.emit({
            type: "conversation_command",
            command: "send_image",
            character_id: input.characterId,
            detail: `Failed: ${message}`,
          });
        }
      }
    }

    // Linked roleplay bridge: <influence> / <note> tags (XML, stripped from visible text).
    {
      const side = parseConnectedSideEffectTags(content);
      content = side.cleanContent;
      const linkedIds = this.connectedIdsOf(input.row);
      if (linkedIds.length && (side.influences.length || side.notes.length)) {
        const toggles = settings.conversation_command_toggles;
        const influenceOn = isConversationCommandEnabled(toggles, "influence");
        const noteOn = isConversationCommandEnabled(toggles, "note");
        if (
          (influenceOn && side.influences.length) ||
          (noteOn && side.notes.length)
        ) {
          for (const linkedId of linkedIds) {
            try {
              const linked = await this.requireRow(linkedId);
              if (linked.mode !== "roleplay") continue;
              const linkedSettings = defaultChatSettings(linked.settings);
              if (influenceOn && side.influences.length) {
                linkedSettings.connected_pending_influences = [
                  ...linkedSettings.connected_pending_influences,
                  ...side.influences,
                ].slice(-40);
                for (const influence of side.influences) {
                  input.emit({
                    type: "conversation_command",
                    command: "influence",
                    character_id: input.characterId,
                    detail: influence.slice(0, 120),
                    chat_id: linked.id,
                  });
                }
              }
              if (noteOn && side.notes.length) {
                linkedSettings.connected_notes = pruneConnectedNotes([
                  ...linkedSettings.connected_notes,
                  ...side.notes,
                ]);
                for (const note of side.notes) {
                  input.emit({
                    type: "conversation_command",
                    command: "note",
                    character_id: input.characterId,
                    detail: note.slice(0, 120),
                    chat_id: linked.id,
                  });
                }
              }
              linked.settings = linkedSettings;
              linked.updated_at = new Date().toISOString();
              await this.chats.save(linked);
            } catch (error) {
              this.logger.warn(
                `Failed to apply connected influence/note for ${input.row.id} → ${linkedId}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            }
          }
        }
      }
    }

    input.row.settings = settings;
    input.row.messages = messages;
    input.row.updated_at = new Date().toISOString();
    await this.chats.save(input.row);

    const finalContent = [content, ...failedImageTags]
      .filter((part) => part.trim())
      .join("\n\n")
      .trim();

    return {
      content: finalContent,
      thinking: thinking?.trim() ? thinking.trim() : null,
      attachments,
      commandTags,
    };
  }

  /**
   * Recent chat + schedule activity so image prompts know what the character
   * is doing, not only the short [send_image] brief.
   */
  private buildConversationImageChatContext(input: {
    messages: ChatMessage[];
    characterList: Character[];
    characterId: string | null;
    settings: ChatSettings;
    userName?: string;
  }): string {
    const nameByCharacterId = new Map(
      input.characterList.map((character) => [
        character.id,
        character.data.name,
      ]),
    );
    const recent = formatRecentHistoryForSmart(
      input.messages,
      nameByCharacterId,
      { userName: input.userName, limit: 8 },
    );

    let activityLine = "";
    if (input.characterId) {
      const timezone =
        input.settings.conversation_timezone ?? input.settings.prompt_timezone;
      const now = new Date();
      const wall = toConversationScheduleWallClockDate(now, timezone);
      const schedule = input.settings.conversation_schedules_enabled
        ? input.settings.character_schedules[input.characterId]
        : undefined;
      const status = getEffectiveCurrentStatus(
        schedule,
        input.settings.conversation_status_overrides[input.characterId],
        now,
        "free time",
        wall,
      );
      if (status.activity?.trim()) {
        activityLine = `Current activity/status: ${status.status} — ${status.activity.trim()}`;
      }
    }

    return [activityLine || null, recent ? `Recent chat:\n${recent}` : null]
      .filter(Boolean)
      .join("\n\n");
  }

  /** Expand a texting brief + character look into an OpenRouter image attachment. */
  private async generateConversationImageAttachment(input: {
    chatId: string;
    brief: string;
    sourceCommand?: string;
    character: Character | null;
    /** Recent chat / schedule context (what they are doing now). */
    chatContext?: string;
    aspectRatio?: string;
    resolution?: string;
  }): Promise<ChatMessageAttachment> {
    let imageConnection;
    try {
      imageConnection = await this.connections.findDefault("image");
    } catch {
      throw new Error(
        "No default image connection — create one under Connections (kind: Image).",
      );
    }
    if (!imageConnection.api_key.trim() || !imageConnection.model.trim()) {
      throw new Error("Default image connection needs an API key and model.");
    }

    const appearance = input.character?.data.appearance?.trim() || "";
    const name = input.character?.data.name?.trim() || "Character";
    const photoBrief = input.brief.trim();
    const chatContext = input.chatContext?.trim() || "";
    const situationBlock = [
      chatContext
        ? `Chat context (what is happening / what ${name} is doing — use for setting, pose, props):\n${chatContext}`
        : null,
      photoBrief
        ? `Photo brief from character (shot intent only — do not redefine full appearance):\n${photoBrief}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    let imagePresetVariables: ReturnType<typeof selectedVariableValues> = {};
    let styleLine = "";
    let framingLine = "";
    try {
      const imagePresetEarly = await this.presets.findDefault("image");
      imagePresetVariables = selectedVariableValues(imagePresetEarly.variables);
      styleLine =
        typeof imagePresetVariables.image_style === "string"
          ? imagePresetVariables.image_style.trim()
          : "";
      framingLine =
        typeof imagePresetVariables.image_framing === "string"
          ? imagePresetVariables.image_framing.trim()
          : "";
    } catch {
      // Preset lookup may fail; fall back without style hints.
    }

    const styleIsIllustrated = /anime|illustration|painterly|comic|cel-?shaded|digital painting/i.test(
      styleLine,
    );
    const styleIsPhoto = /photoreal|realistic|photograph|cinematic composition/i.test(
      styleLine,
    );

    const appearanceBlock = appearance
      ? [
          `Subject: ${name}`,
          "Full appearance (use every trait; do not summarize, omit, or replace details):",
          appearance,
        ].join("\n")
      : `Subject: ${name}`;

    let imagePrompt = [
      styleLine || null,
      framingLine || null,
      styleIsIllustrated
        ? `Casual selfie-pose portrait illustration of ${name}.`
        : `Phone photo / casual selfie of ${name}.`,
      appearanceBlock,
      situationBlock || null,
      styleIsIllustrated
        ? "Keep the Style medium (anime/illustration) — not photorealistic, not a real camera photo."
        : styleIsPhoto
          ? "Photorealistic casual phone camera, natural lighting, authentic messaging photo."
          : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const llmConnection = await this.connections.findDefault("llm");
      const imagePreset = await this.presets.findDefault("image");
      const promptContext = buildPresetPromptContext({
        characters: input.character ? [input.character] : undefined,
        generatorBrief: situationBlock || photoBrief,
        characterInfoMode: "image",
        variables: {
          ...selectedVariableValues(imagePreset.variables),
          ...imagePresetVariables,
        },
      });
      const expanded = await completeWithConnectionAndPreset(
        llmConnection,
        imagePreset,
        {
          prompt: {
            variables: promptContext.variables,
            markers: promptContext.markers,
          },
        },
      );
      const raw = (expanded.content || expanded.reply || "").trim();
      const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
      const text = (fenced?.[1] ?? raw).trim();
      try {
        const parsed = JSON.parse(text) as { prompt?: unknown };
        if (typeof parsed.prompt === "string" && parsed.prompt.trim()) {
          imagePrompt = parsed.prompt.trim();
        }
      } catch {
        if (text && !text.startsWith("{")) imagePrompt = text;
      }
    } catch (error) {
      this.logger.warn(
        `Image prompt expand skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Pin Style/Framing + full appearance + chat situation so the expander
    // cannot drop look or current-context details.
    imagePrompt = [
      styleLine,
      framingLine,
      appearanceBlock,
      situationBlock || null,
      imagePrompt,
    ]
      .filter(Boolean)
      .join("\n\n");
    if (styleIsIllustrated) {
      imagePrompt = `${imagePrompt}\n\nMedium lock: anime/illustration only — not photorealistic, not a real photograph.`;
    }

    const custom = imageConnection.custom_parameters ?? {};
    const aspectFromCustom =
      typeof custom.aspect_ratio === "string" ? custom.aspect_ratio : undefined;
    const resolutionFromCustom =
      typeof custom.resolution === "string" ? custom.resolution : undefined;

    const generated = await openRouterGenerateImage(imageConnection.api_key, {
      model: imageConnection.model,
      prompt: imagePrompt,
      preferredProvider: imageConnection.preferred_provider,
      aspectRatio: normalizeImageAspectRatio(
        input.aspectRatio || aspectFromCustom,
      ),
      resolution: normalizeImageResolution(
        input.resolution || resolutionFromCustom,
      ),
      // Only sent when the model lists output_format in supported_parameters.
      outputFormat: "png",
    });

    const fileName = `${name.replace(/[^\w.-]+/g, "_").slice(0, 40) || "photo"}.png`;
    const attachment = {
      ...(await writeChatAttachment({
        chatId: input.chatId,
        attachmentId: randomUUID(),
        buffer: generated.buffer,
        mime: generated.mime,
        name: fileName,
      })),
      prompt: imagePrompt,
      source_command: input.sourceCommand,
    };

    const characterId = input.character?.id?.trim();
    if (characterId) {
      try {
        await this.characters.addGalleryImage(characterId, generated.buffer, {
          mime: generated.mime,
          name: fileName,
          source: "generated",
          prompt: imagePrompt,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to save chat image to character gallery ${characterId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return attachment;
  }

  /**
   * Force-generate an image for an assistant message (same pipeline as
   * conversation `[send_image]`), without requiring the model to emit a tag.
   */
  async generateImage(
    id: string,
    input: GenerateChatImageInput = {},
  ): Promise<Chat> {
    const row = await this.requireRow(id);
    if (row.mode !== "conversation") {
      throw new BadRequestException(
        "Force image generation is only available in conversation chats.",
      );
    }

    row.messages = normalizeChatMessages(row.messages);
    const settings = defaultChatSettings(row.settings);
    const visible = visibleChatMessages(row.messages);

    const messageId = input.messageId?.trim();
    const target =
      (messageId
        ? row.messages.find((message) => message.id === messageId)
        : undefined) ??
      [...visible].reverse().find((message) => message.role === "assistant");

    if (!target || target.role !== "assistant") {
      throw new BadRequestException(
        "No assistant message to attach an image to.",
      );
    }

    const characterId =
      input.characterId?.trim() ||
      target.character_id ||
      primaryCharacterId(settings);

    let speaker: Character | null = null;
    if (characterId) {
      try {
        speaker = await this.characters.findOne(characterId);
      } catch {
        speaker = null;
      }
    }

    const brief =
      input.prompt?.trim() ||
      "Casual phone selfie matching the chat vibe.";
    const sourceCommand = `[send_image: prompt="${escapeQuotesForAttribute(brief)}"]`;

    let characterList: Character[] = [];
    if (speaker) characterList = [speaker];
    else if (settings.character_ids.length) {
      try {
        characterList = await this.loadPromptCharacters(settings);
      } catch {
        characterList = [];
      }
    }

    let userName: string | undefined;
    try {
      const persona = await this.resolvePersona(settings.persona_id);
      userName = persona?.name?.trim() || undefined;
    } catch {
      userName = undefined;
    }

    const attachment = await this.generateConversationImageAttachment({
      chatId: row.id,
      brief,
      sourceCommand,
      character: speaker,
      chatContext: this.buildConversationImageChatContext({
        messages: visible,
        characterList,
        characterId: characterId ?? null,
        settings,
        userName,
      }),
      aspectRatio: settings.image_aspect_ratio,
      resolution: settings.image_resolution,
    });

    const swipeId = target.swipe_id;
    const existingAttachments = activeMessageAttachments(target);
    const existingTags = activeMessageCommandTags(target);
    const updated = assignSwipeCommandTags(
      assignSwipeAttachments(target, swipeId, [
        ...existingAttachments,
        attachment,
      ]),
      swipeId,
      [...existingTags, sourceCommand],
    );

    row.messages = row.messages.map((message) =>
      message.id === target.id ? updated : message,
    );
    row.updated_at = new Date().toISOString();
    const saved = await this.chats.save(row);
    return this.toChat(saved);
  }

  async applyAgentProposal(
    id: string,
    input: { slug?: string; proposalId: string },
  ): Promise<Chat> {
    const row = await this.requireRow(id);
    const slug = input.slug?.trim() || "card-evolution-auditor";
    const state = row.agent_state?.[slug];
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new BadRequestException(`No proposals for agent ${slug}`);
    }
    const record = state as Record<string, unknown>;
    const updates = Array.isArray(record.updates) ? [...record.updates] : [];
    const index = updates.findIndex((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      return String((item as { id?: unknown }).id ?? "") === input.proposalId;
    });
    if (index < 0) {
      throw new NotFoundException(`Proposal ${input.proposalId} not found`);
    }
    const proposal = updates[index] as Record<string, unknown>;
    if (proposal.status === "approved") {
      return this.toChat(row);
    }

    const characterId = String(proposal.characterId ?? "").trim();
    const field = String(proposal.field ?? "").trim();
    const oldText = String(proposal.oldText ?? "");
    const newText = String(proposal.newText ?? "");
    if (!characterId || !field) {
      throw new BadRequestException("Proposal is missing characterId or field");
    }

    const character = await this.characters.findOne(characterId);
    const data = { ...character.data } as Record<string, unknown>;
    const current = data[field];
    if (typeof current !== "string") {
      throw new BadRequestException(`Field "${field}" is not editable text`);
    }
    if (oldText && !current.includes(oldText)) {
      throw new BadRequestException(
        "oldText was not found in the character field (card may have changed)",
      );
    }
    data[field] = oldText
      ? current.replace(oldText, newText)
      : newText;
    await this.characters.update(characterId, {
      data: data as typeof character.data,
    });

    updates[index] = { ...proposal, status: "approved" };
    row.agent_state = {
      ...row.agent_state,
      [slug]: { ...record, updates },
    };
    row.updated_at = new Date().toISOString();
    return this.toChat(await this.chats.save(row));
  }

  async dismissAgentProposal(
    id: string,
    input: { slug?: string; proposalId: string },
  ): Promise<Chat> {
    const row = await this.requireRow(id);
    const slug = input.slug?.trim() || "card-evolution-auditor";
    const state = row.agent_state?.[slug];
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new BadRequestException(`No proposals for agent ${slug}`);
    }
    const record = state as Record<string, unknown>;
    const updates = Array.isArray(record.updates) ? [...record.updates] : [];
    const index = updates.findIndex((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      return String((item as { id?: unknown }).id ?? "") === input.proposalId;
    });
    if (index < 0) {
      throw new NotFoundException(`Proposal ${input.proposalId} not found`);
    }
    const proposal = updates[index] as Record<string, unknown>;
    updates[index] = { ...proposal, status: "dismissed" };
    row.agent_state = {
      ...row.agent_state,
      [slug]: { ...record, updates },
    };
    row.updated_at = new Date().toISOString();
    return this.toChat(await this.chats.save(row));
  }

  async addMessage(id: string, input: CreateChatMessageInput): Promise<Chat> {
    const row = await this.requireRow(id);
    const content = input.content?.trim() ?? "";
    const attachments = await this.resolveAttachments(id, input.attachments);
    if (!content && attachments.length === 0) {
      throw new BadRequestException("content or attachments are required");
    }
    const role = input.role ?? "user";
    const characterId =
      role === "assistant" ? (input.character_id ?? null) : null;
    if (characterId) {
      const settings = defaultChatSettings(row.settings);
      if (!settings.character_ids.includes(characterId)) {
        throw new BadRequestException(
          "character_id must be a member of this chat",
        );
      }
    }
    const message = createChatMessage({
      role,
      content,
      id: randomUUID(),
      character_id: characterId,
      roleplay_dm_source: input.roleplay_dm_source ?? null,
      attachments,
      ...branchParentOf(row.messages),
    });
    row.messages = [...normalizeChatMessages(row.messages), message];
    row.updated_at = new Date().toISOString();
    const saved = await this.chats.save(row);
    return this.toChat(saved);
  }

  async updateMessage(
    id: string,
    messageId: string,
    input: UpdateChatMessageInput,
  ): Promise<Chat> {
    const row = await this.requireRow(id);
    row.messages = normalizeChatMessages(row.messages);
    const index = row.messages.findIndex((message) => message.id === messageId);
    if (index === -1) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    if (input.remove_active_swipe) {
      const existing = row.messages[index];
      if (existing.swipes.length <= 1) {
        row.messages = removeChatMessageSubtree(row.messages, messageId);
        row.updated_at = new Date().toISOString();
        const saved = await this.chats.save(row);
        return this.toChat(saved);
      }
      const swipeId = existing.swipe_id;
      row.messages = removeChatMessageSwipe(row.messages, messageId, swipeId);
      row.updated_at = new Date().toISOString();
      const saved = await this.chats.save(row);
      return this.toChat(saved);
    }

    const message = { ...row.messages[index] };
    if (input.swipe_id !== undefined) {
      if (input.swipe_id < 0 || input.swipe_id >= message.swipes.length) {
        throw new BadRequestException("swipe_id out of range");
      }
      message.swipe_id = input.swipe_id;
    }
    if (input.content !== undefined) {
      const swipes = [...message.swipes];
      swipes[message.swipe_id] = input.content;
      message.swipes = swipes;
    }
    if (input.thinking !== undefined) message.thinking = input.thinking;
    if (input.add_reaction !== undefined) {
      const emoji = input.add_reaction.trim();
      if (!emoji) {
        throw new BadRequestException("add_reaction must be a non-empty emoji");
      }
      if (emoji.length > 32) {
        throw new BadRequestException("add_reaction is too long");
      }
      message.reactions = [
        ...(message.reactions ?? []),
        {
          emoji,
          character_id: null,
          created_at: new Date().toISOString(),
        },
      ];
    }

    row.messages = row.messages.map((item, i) =>
      i === index ? message : item,
    );
    row.updated_at = new Date().toISOString();
    const saved = await this.chats.save(row);
    return this.toChat(saved);
  }

  async removeMessage(id: string, messageId: string): Promise<Chat> {
    const row = await this.requireRow(id);
    row.messages = normalizeChatMessages(row.messages);
    if (!row.messages.some((message) => message.id === messageId)) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }
    row.messages = removeChatMessageSubtree(row.messages, messageId);
    row.updated_at = new Date().toISOString();
    const saved = await this.chats.save(row);
    return this.toChat(saved);
  }

  async generate(
    id: string,
    input: GenerateChatInput,
    emit: StreamEmit,
  ): Promise<void> {
    const row = await this.requireRow(id);

    if (input.continueMessageId) {
      await this.regenerate(id, emit, input.continueMessageId);
      return;
    }

    if (await this.maybeEmitNeedsPresetVariables(row, emit)) {
      return;
    }

    const rawUserText = input.userMessage?.trim() ?? "";
    const attachments = await this.resolveAttachments(id, input.attachments);
    const impersonate = Boolean(input.impersonate);
    // Impersonate direction is ephemeral guidance — do not store it as a user turn.
    if (!impersonate && (rawUserText || attachments.length > 0)) {
      const { command, rest } = parseSlashCommand(rawUserText);
      const storedContent = command
        ? rest.trim() || `/${command}`
        : rawUserText;
      row.messages = normalizeChatMessages(row.messages);
      const userMessage = createChatMessage({
        role: "user",
        content: storedContent,
        id: randomUUID(),
        attachments,
        ...branchParentOf(row.messages),
      });
      row.messages = [...row.messages, userMessage];
      row.updated_at = new Date().toISOString();
      await this.chats.save(row);
      emit({ type: "user_message", message: userMessage });
      if (row.mode === "conversation") {
        this.conversationAutonomous.recordUserActivity(row.id);
      }
    }

    await this.runCompletion(row, emit, {
      mode: "generate",
      forCharacterId: input.forCharacterId,
      queueUserMessage: rawUserText || null,
      generationGuide: input.generationGuide?.trim() || undefined,
      impersonate,
      impersonateDirection: impersonate ? rawUserText || undefined : undefined,
      runDirector: Boolean(input.runDirector),
      autonomous: Boolean(input.autonomous),
      autonomousIntentKey: input.autonomous_intent_key,
      skipPresenceDelay: Boolean(input.skip_presence_delay),
    });
  }

  async regenerate(
    id: string,
    emit: StreamEmit,
    messageId?: string,
  ): Promise<void> {
    const row = await this.requireRow(id);
    row.messages = normalizeChatMessages(row.messages);
    let targetIndex: number | undefined;

    if (messageId) {
      targetIndex = row.messages.findIndex((message) => message.id === messageId);
      if (targetIndex === -1) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }
      const target = row.messages[targetIndex];
      if (target.role !== "assistant" && target.role !== "user") {
        throw new BadRequestException(
          "Only user or assistant messages can be regenerated",
        );
      }
    } else {
      const visible = visibleChatMessages(row.messages);
      const last = [...visible]
        .reverse()
        .find(
          (message) => message.role === "assistant" || message.role === "user",
        );
      targetIndex = last
        ? row.messages.findIndex((message) => message.id === last.id)
        : undefined;
    }

    if (targetIndex === undefined || targetIndex < 0) {
      throw new BadRequestException("No message to regenerate");
    }

    if (await this.maybeEmitNeedsPresetVariables(row, emit)) {
      return;
    }

    await this.runCompletion(row, emit, {
      mode: "regenerate",
      targetIndex,
    });
  }

  /** Emit setup-variables command when chat preset values are incomplete. */
  private async maybeEmitNeedsPresetVariables(
    row: ChatEntity,
    emit: StreamEmit,
  ): Promise<boolean> {
    const settings = defaultChatSettings(row.settings);
    const preset = settings.preset_id
      ? await this.presets.findOne(settings.preset_id)
      : await this.presets.findDefault(row.mode);
    const unresolved = unresolvedPresetVariables(
      preset.variables,
      settings.variables,
    );
    if (unresolved.length === 0) return false;
    emit({
      type: "needs_preset_variables",
      presetId: preset.id,
      variables: unresolved,
    });
    return true;
  }

  /** Build the prompt that would be used to regenerate / continue from a message. */
  async peekPrompt(
    id: string,
    messageId?: string,
  ): Promise<PeekPromptResult> {
    const row = await this.requireRow(id);
    const settings = defaultChatSettings(row.settings);
    const persona = await this.resolvePersona(settings.persona_id);
    const lorebooks = await this.resolveLorebooks(settings);
    const preset = settings.preset_id
      ? await this.presets.findOne(settings.preset_id)
      : await this.presets.findDefault(row.mode);

    let historyMessages = promptVisibleChatMessages(row.messages);
    let turn: SpeakerTurn = { kind: "merged" };
    const includeCharacterIds: string[] = [];

    if (messageId) {
      const index = row.messages.findIndex((message) => message.id === messageId);
      if (index === -1) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }
      const target = row.messages[index];
      if (target.role === "assistant") {
        historyMessages = ancestorChatMessages(row.messages, messageId).filter(
          (message) => !isMessageHiddenFromPrompt(message),
        );
        turn =
          target.character_id &&
          settings.character_ids.includes(target.character_id)
            ? { kind: "character", characterId: target.character_id }
            : { kind: "merged" };
      } else if (target.role === "user") {
        historyMessages = ancestorChatMessages(row.messages, messageId).filter(
          (message) => !isMessageHiddenFromPrompt(message),
        );
        turn = { kind: "impersonate" };
      } else {
        historyMessages = [
          ...ancestorChatMessages(row.messages, messageId),
          target,
        ].filter((message) => !isMessageHiddenFromPrompt(message));
        const primaryId = primaryCharacterId(settings);
        turn =
          settings.group_mode === "individual" && primaryId
            ? { kind: "character", characterId: primaryId }
            : { kind: "merged" };
      }
    }

    if (turn.kind === "character") {
      includeCharacterIds.push(turn.characterId);
    }

    const characterList = await this.loadPromptCharacters(
      settings,
      includeCharacterIds,
    );
    const nameByCharacterId = new Map(
      characterList.map((character) => [
        character.id,
        character.data.name.trim() || "Character",
      ]),
    );

    let chatHistoryOverride: string | undefined;
    let conversationMemory: string | undefined;
    if (row.mode === "conversation") {
      const prepared = await this.conversationSummary.prepareConversationPrompt({
        row,
        historyMessages,
        personaName: persona?.name?.trim() || "User",
        nameByCharacterId,
        wrapFormat: preset.wrap_format,
      });
      if (prepared.rowPatches) {
        Object.assign(row, prepared.rowPatches);
        row.updated_at = new Date().toISOString();
        await this.chats.save(row);
      }
      chatHistoryOverride = prepared.chatHistory;
      conversationMemory = prepared.importantMemory ?? undefined;
    }

    const prompt = await this.buildTurnPrompt({
      mode: row.mode,
      settings,
      preset,
      characterList,
      persona,
      lorebooks,
      nameByCharacterId,
      turn,
      historyMessages,
      chatSummary: row.summary,
      parentChatId: row.parent_chat_id,
      connectedChatIds: this.connectedIdsOf(row),
      chatHistoryOverride,
      conversationMemory,
      chatId: row.id,
      memoryChunks: row.memory_chunks,
      consumeConnectedInfluences: false,
    });

    if (!messageId) return prompt;

    const target = row.messages.find((message) => message.id === messageId);
    if (!target) return prompt;

    const command_tags = activeMessageCommandTags(target);
    const image_prompts = activeMessageAttachments(target)
      .filter(
        (attachment) =>
          Boolean(attachment.prompt?.trim()) ||
          Boolean(attachment.source_command?.trim()),
      )
      .map((attachment) => ({
        name: attachment.name || "image",
        prompt: attachment.prompt?.trim() || "",
        command: attachment.source_command?.trim() || undefined,
      }));

    return {
      ...prompt,
      ...(command_tags.length > 0 ? { command_tags } : {}),
      ...(image_prompts.length > 0 ? { image_prompts } : {}),
    };
  }

  private async runCompletion(
    row: ChatEntity,
    emit: StreamEmit,
    options: {
      mode: "generate" | "regenerate";
      targetIndex?: number;
      forCharacterId?: string;
      queueUserMessage?: string | null;
      generationGuide?: string;
      impersonate?: boolean;
      impersonateDirection?: string;
      runDirector?: boolean;
      autonomous?: boolean;
      autonomousIntentKey?: string;
      skipPresenceDelay?: boolean;
    },
  ): Promise<void> {
    const storedSettings = defaultChatSettings(row.settings);
    row.settings = storedSettings;

    const promptSettings =
      row.mode === "conversation" && !options.impersonate
        ? await this.applyConversationPresenceFilter(storedSettings)
        : storedSettings;

    const connectionId =
      options.impersonate && promptSettings.impersonate_connection_id
        ? promptSettings.impersonate_connection_id
        : promptSettings.connection_id;
    const connection = connectionId
      ? await this.connections.findOne(connectionId)
      : await this.connections.findDefault("llm");

    if (!connection.api_key.trim()) {
      throw new BadRequestException(
        `Connection "${connection.name || connection.id}" has no API key`,
      );
    }
    if (!connection.model.trim()) {
      throw new BadRequestException(
        `Connection "${connection.name || connection.id}" has no model`,
      );
    }

    const presetId =
      options.impersonate && promptSettings.impersonate_preset_id
        ? promptSettings.impersonate_preset_id
        : promptSettings.preset_id;
    const preset = presetId
      ? await this.presets.findOne(presetId)
      : await this.presets.findDefault(row.mode);

    const includeCharacterIds: string[] = [];
    if (options.forCharacterId) {
      includeCharacterIds.push(options.forCharacterId);
    }
    if (options.mode === "regenerate" && options.targetIndex !== undefined) {
      const existing = row.messages[options.targetIndex];
      if (existing?.character_id) {
        includeCharacterIds.push(existing.character_id);
      }
    }

    const characterList = await this.loadPromptCharacters(
      promptSettings,
      includeCharacterIds,
    );
    const persona = await this.resolvePersona(promptSettings.persona_id);
    const lorebooks = await this.resolveLorebooks(promptSettings);
    const nameByCharacterId = new Map(
      characterList.map((character) => [
        character.id,
        character.data.convo_display_name?.trim() ||
          character.data.name.trim() ||
          "Character",
      ]),
    );

    if (options.mode === "regenerate" && options.targetIndex !== undefined) {
      const existing = row.messages[options.targetIndex];
      const turn: SpeakerTurn =
        existing.role === "user"
          ? { kind: "impersonate" }
          : existing.character_id &&
              storedSettings.character_ids.includes(existing.character_id)
            ? { kind: "character", characterId: existing.character_id }
            : { kind: "merged" };
      await this.runSingleTurn({
        row,
        emit,
        connection,
        preset,
        characterList,
        persona,
        lorebooks,
        nameByCharacterId,
        turn,
        historyMessages: ancestorChatMessages(row.messages, existing.id).filter(
          (message) => !isMessageHiddenFromPrompt(message),
        ),
        regenerateIndex: options.targetIndex,
        generationGuide: options.generationGuide,
        impersonateDirection: options.impersonateDirection,
        runDirector: options.runDirector,
        promptSettings,
        autonomous: options.autonomous,
        autonomousIntentKey: options.autonomousIntentKey,
      });
      return;
    }

    const visibleMessages = visibleChatMessages(row.messages);
    const turns = await this.resolveTurns({
      settings: promptSettings,
      characterList,
      messages: visibleMessages,
      userMessage: options.queueUserMessage,
      forCharacterId: options.forCharacterId,
      impersonate: options.impersonate,
      connection,
      nameByCharacterId,
      userName: persona?.name,
    });

    for (const turn of turns) {
      await this.runSingleTurn({
        row,
        emit,
        connection,
        preset,
        characterList,
        persona,
        lorebooks,
        nameByCharacterId,
        turn,
        historyMessages: promptVisibleChatMessages(row.messages),
        generationGuide: options.generationGuide,
        impersonateDirection: options.impersonateDirection,
        runDirector: options.runDirector,
        promptSettings,
        autonomous: options.autonomous,
        autonomousIntentKey: options.autonomousIntentKey,
      });
    }
  }

  private async resolveTurns(input: {
    settings: ChatSettings;
    characterList: Character[];
    messages: ChatMessage[];
    userMessage?: string | null;
    forCharacterId?: string;
    impersonate?: boolean;
    connection: ResolvedConnection;
    nameByCharacterId: Map<string, string>;
    userName?: string;
  }): Promise<SpeakerTurn[]> {
    if (input.impersonate) {
      return [{ kind: "impersonate" }];
    }

    const queued = resolveSpeakerQueue({
      settings: input.settings,
      characters: input.characterList,
      messages: input.messages,
      userMessage: input.userMessage,
      forCharacterId: input.forCharacterId,
    });

    if (queued.status === "error" || queued.status === "empty") {
      throw new BadRequestException(queued.reason);
    }
    if (queued.status === "ready") return queued.turns;

    const smartIds = await this.runSmartSelector({
      connection: input.connection,
      characterList: input.characterList,
      messages: input.messages,
      nameByCharacterId: input.nameByCharacterId,
      userName: input.userName,
    });
    if (smartIds.length) {
      return smartIds.map((characterId) => ({
        kind: "character" as const,
        characterId,
      }));
    }

    const fallback = fallbackSpeakerId(
      activeCharacterIds(input.settings),
      input.messages,
    );
    if (!fallback) {
      throw new BadRequestException(
        "Smart selector failed and no fallback character is available",
      );
    }
    return [{ kind: "character", characterId: fallback }];
  }

  private async runSmartSelector(input: {
    connection: ResolvedConnection;
    characterList: Character[];
    messages: ChatMessage[];
    nameByCharacterId: Map<string, string>;
    userName?: string;
  }): Promise<string[]> {
    const allowedIds = input.characterList.map((c) => c.id);
    const candidates = input.characterList
      .map((character) => formatSmartCandidate(character))
      .join("\n\n");
    const recent = formatRecentHistoryForSmart(
      input.messages,
      input.nameByCharacterId,
      { userName: input.userName, limit: 5 },
    );

    const prompt = [
      "You are selecting which character(s) should speak next in a group chat.",
      'Return ONLY a JSON array of character id strings, e.g. ["id-1"].',
      "Usually pick exactly one character. Pick multiple only when several have a strong reason to speak now.",
      "Prefer more talkative / online characters when the scene is ambiguous.",
      "",
      "<recent_messages>",
      recent || "(none)",
      "</recent_messages>",
      "",
      "<candidates>",
      candidates,
      "</candidates>",
    ].join("\n");

    try {
      const result = await completeWithConnection(
        input.connection,
        [{ role: "user", content: prompt }],
        { parseThinking: true },
      );
      return parseSmartSpeakerIds(result.content || result.reply, allowedIds);
    } catch {
      return [];
    }
  }

  private async runSingleTurn(input: {
    row: ChatEntity;
    emit: StreamEmit;
    connection: ResolvedConnection;
    preset: ResolvedPreset;
    characterList: Character[];
    persona: Awaited<ReturnType<ChatsService["resolvePersona"]>>;
    lorebooks: Awaited<ReturnType<ChatsService["resolveLorebooks"]>>;
    nameByCharacterId: Map<string, string>;
    turn: SpeakerTurn;
    historyMessages: ChatMessage[];
    regenerateIndex?: number;
    generationGuide?: string;
    impersonateDirection?: string;
    runDirector?: boolean;
    promptSettings?: ChatSettings;
    autonomous?: boolean;
    autonomousIntentKey?: string;
  }): Promise<void> {
    const {
      row,
      emit,
      connection,
      preset,
      characterList,
      persona,
      lorebooks,
      nameByCharacterId,
      turn,
      historyMessages,
      regenerateIndex,
      generationGuide,
      impersonateDirection,
      runDirector,
      promptSettings,
      autonomous,
      autonomousIntentKey,
    } = input;
    const settings = promptSettings ?? defaultChatSettings(row.settings);

    const skipAgents =
      turn.kind === "impersonate" && settings.impersonate_skip_agents === true;

    const selectedAgents = skipAgents
      ? []
      : await this.agentRunner.loadSelectedAgents({
          settings,
          mode: row.mode,
          historyMessages,
          runDirector,
          parentChatId: row.parent_chat_id,
        });

    const mutable = {
      summary: row.summary,
      agentState: { ...(row.agent_state ?? {}) },
      messages: [...row.messages],
    };
    let commandAttachments: ChatMessageAttachment[] = [];
    let commandTags: string[] = [];

    const agentCtxBase = {
      chat: this.toChat(row),
      settings,
      connection,
      historyMessages,
      userName: persona?.name,
      lorebooks,
      runDirector,
      emit,
      mutable,
      characterCards: characterList
        .map((character) =>
          JSON.stringify(
            {
              characterId: character.id,
              name: character.data.name,
              description: character.data.description,
              appearance: character.data.appearance,
              personality: character.data.personality,
              relationships: character.data.relationships,
              scenario: character.data.scenario,
              first_mes: character.data.first_mes,
              mes_example: character.data.mes_example,
              creator_notes: character.data.creator_notes,
              system_prompt: character.data.system_prompt,
              post_history_instructions:
                character.data.post_history_instructions,
            },
            null,
            2,
          ),
        )
        .join("\n\n"),
    };

    const pre = await this.agentRunner.runPreGeneration(
      { ...agentCtxBase, characterName: characterList[0]?.data.name },
      selectedAgents,
    );
    if (Object.keys(pre.agentStatePatch).length) {
      mutable.agentState = { ...mutable.agentState, ...pre.agentStatePatch };
      row.agent_state = mutable.agentState;
      agentCtxBase.chat = this.toChat(row);
    }

    let chatHistoryOverride: string | undefined;
    let conversationMemory: string | undefined;
    if (row.mode === "conversation") {
      const prepared = await this.conversationSummary.prepareConversationPrompt({
        row,
        historyMessages,
        personaName: persona?.name?.trim() || "User",
        nameByCharacterId,
        wrapFormat: preset.wrap_format,
      });
      if (prepared.rowPatches) {
        Object.assign(row, prepared.rowPatches);
        row.updated_at = new Date().toISOString();
        await this.chats.save(row);
        agentCtxBase.chat = this.toChat(row);
      }
      chatHistoryOverride = prepared.chatHistory;
      conversationMemory = prepared.importantMemory ?? undefined;
    }

    const built = await this.buildTurnPrompt({
      mode: row.mode,
      settings: this.withAboutMeAgentOverrides(
        settings,
        mutable.agentState,
      ),
      preset,
      characterList,
      persona,
      lorebooks,
      nameByCharacterId,
      turn,
      historyMessages,
      chatSummary: row.summary,
      generationGuide,
      impersonateDirection,
      agentInjectTexts: pre.injectTexts,
      parentChatId: row.parent_chat_id,
      connectedChatIds: this.connectedIdsOf(row),
      chatHistoryOverride,
      conversationMemory,
      chatId: row.id,
      memoryChunks: row.memory_chunks,
      consumeConnectedInfluences: true,
    });

    if (row.mode === "roleplay") {
      const refreshedSettings = await this.chats.findOneBy({ id: row.id });
      if (refreshedSettings) {
        row.settings = refreshedSettings.settings;
        // Keep local settings in sync so a later save does not restore consumed influences.
        Object.assign(settings, defaultChatSettings(refreshedSettings.settings));
      }
    }

    const { characterId, characterName, role, messages: promptMessages } =
      built;

    emit({
      type: "turn_start",
      character_id: characterId,
      character_name: characterName,
    });

    const { connection: generationConnection, enabled_parameters } =
      connectionWithChatParameters(connection, settings.chat_parameters);

    const result = await completeWithConnection(
      generationConnection,
      promptMessages,
      {
        stream: {
          onContentDelta: (delta) => emit({ type: "delta", delta }),
          onReasoningDelta: (delta) => emit({ type: "thinking", delta }),
        },
        parseThinking: true,
        body: { enabled_parameters },
      },
    );

    let content = result.content;
    let thinking: string | null = result.thinking;
    const parsed = extractThinking(
      result.reply,
      generationConnection.thinking_tag,
    );
    if (parsed.thinking) {
      thinking = parsed.thinking || thinking;
      content = parsed.content;
    }

    if (role === "assistant") {
      // Parallel agents (Echo) run alongside post_processing after the stream.
      const parallelWithContent = this.agentRunner.startParallel(
        { ...agentCtxBase, characterName },
        selectedAgents,
        content,
      );
      const post = await this.agentRunner.runPostProcessing(
        { ...agentCtxBase, characterName },
        selectedAgents,
        content,
      );
      content = post.content;
      const parallelPatch = await parallelWithContent.promise;
      mutable.agentState = {
        ...mutable.agentState,
        ...post.agentStatePatch,
        ...parallelPatch,
      };

      if (
        row.mode === "roleplay" &&
        !row.parent_chat_id &&
        settings.allow_character_dms &&
        turn.kind !== "impersonate"
      ) {
        const allCharacters = await this.characters.findAll();
        content = await this.applyRoleplayDmCommands({
          parentId: row.id,
          content,
          settings: defaultChatSettings(row.settings),
          characterList,
          allCharacters,
          historyMessages,
          emit,
        });
        const refreshed = await this.chats.findOneBy({ id: row.id });
        if (refreshed) {
          row.settings = refreshed.settings;
        }
      }

      if (
        row.mode === "roleplay" &&
        turn.kind !== "impersonate"
      ) {
        const linkedConversationIds = this.connectedIdsOf(row);
        if (linkedConversationIds.length) {
          const ooc = parseOocTags(content);
          content = ooc.cleanContent;
          for (const body of ooc.oocBodies) {
            for (const linkedId of linkedConversationIds) {
              try {
                await this.appendChatMessage(linkedId, {
                  role: "assistant",
                  content: body,
                  character_id: characterId,
                });
              } catch (error) {
                this.logger.warn(
                  `Failed to post OOC to linked conversation ${linkedId}: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                );
              }
            }
          }
        }
      }

      let turnCommandAttachments: ChatMessageAttachment[] = [];
      let turnCommandTags: string[] = [];
      if (
        row.mode === "conversation" &&
        settings.character_commands !== false &&
        turn.kind !== "impersonate"
      ) {
        const commandResult = await this.applyConversationCommands({
          row,
          content,
          thinking,
          settings: defaultChatSettings(row.settings),
          characterList,
          characterId,
          historyMessages,
          emit,
        });
        content = commandResult.content;
        thinking = commandResult.thinking;
        turnCommandAttachments = commandResult.attachments;
        turnCommandTags = commandResult.commandTags;
        const refreshed = await this.chats.findOneBy({ id: row.id });
        if (refreshed) {
          row.settings = refreshed.settings;
          row.messages = refreshed.messages;
          mutable.messages = refreshed.messages;
        }
      }

      row.agent_state = mutable.agentState;
      row.summary = mutable.summary;
      row.messages = mutable.messages;
      commandAttachments = turnCommandAttachments;
      commandTags = turnCommandTags;
    }

    const commandOnlyTurn =
      role === "assistant" &&
      row.mode === "conversation" &&
      !content.trim() &&
      !thinking?.trim() &&
      commandAttachments.length === 0;

    let savedMessage: ChatMessage;
    if (regenerateIndex !== undefined) {
      const existing = row.messages[regenerateIndex];
      const swipes = [...existing.swipes, content];
      const nextSwipeId = swipes.length - 1;
      savedMessage = assignSwipeCommandTags(
        assignSwipeAttachments(
          {
            ...existing,
            swipes,
            swipe_id: nextSwipeId,
            thinking: thinking || null,
            character_id: existing.character_id ?? characterId,
          },
          nextSwipeId,
          commandAttachments,
        ),
        nextSwipeId,
        commandTags,
      );
      row.messages = row.messages.map((message, index) =>
        index === regenerateIndex ? savedMessage : message,
      );
    } else if (commandOnlyTurn) {
      row.messages = normalizeChatMessages(row.messages);
      row.updated_at = new Date().toISOString();
      const saved = await this.chats.save(row);
      Object.assign(row, saved);
      const visible = visibleChatMessages(row.messages);
      savedMessage =
        visible[visible.length - 1] ?? row.messages[row.messages.length - 1]!;
    } else {
      row.messages = normalizeChatMessages(row.messages);
      savedMessage = createChatMessage({
        role,
        content,
        id: randomUUID(),
        thinking: role === "assistant" ? thinking || null : null,
        character_id: role === "assistant" ? characterId : null,
        attachments: commandAttachments.length
          ? commandAttachments
          : undefined,
        ...branchParentOf(row.messages),
      });
      if (commandTags.length > 0) {
        savedMessage = assignSwipeCommandTags(savedMessage, 0, commandTags);
      }
      row.messages = [...row.messages, savedMessage];
    }

    if (!commandOnlyTurn) {
      row.updated_at = new Date().toISOString();
      const saved = await this.chats.save(row);
      Object.assign(row, saved);
    }

    if (row.mode === "conversation" && role === "assistant" && characterId) {
      this.conversationAutonomous.recordAssistantActivity(
        row.id,
        characterId,
      );
      if (autonomous) {
        await this.conversationAutonomous.bumpAutonomousBudget(
          row.id,
          characterId,
          autonomousIntentKey,
        );
        const refreshed = await this.chats.findOneBy({ id: row.id });
        if (refreshed) Object.assign(row, refreshed);
      }
    }

    let chatForDone = this.toChat(row);
    if (
      defaultChatSettings(row.settings).enable_memory_recall &&
      savedMessage.role === "assistant" &&
      !regenerateIndex
    ) {
      const synced = await this.syncMemoryChunks(row.id);
      if (synced) {
        chatForDone = synced;
        Object.assign(row, await this.requireRow(row.id));
      }
    }

    if (
      roleplaySummaryEnabled(row.mode) &&
      savedMessage.role === "assistant" &&
      !regenerateIndex
    ) {
      const summaryChat = await this.chatSummary.maybeRunAutomaticSummary(
        row.id,
        savedMessage.id,
      );
      if (summaryChat) {
        chatForDone = summaryChat;
        const latestEntry =
          summaryChat.summary_entries[summaryChat.summary_entries.length - 1];
        if (latestEntry?.origin === "automated") {
          emit({
            type: "chat_summary",
            chat: summaryChat,
            entry_id: latestEntry.id,
          });
        }
      }
    }

    emit({
      type: "done",
      message: savedMessage,
      chat: chatForDone,
    });
  }

  private async buildTurnPrompt(input: {
    mode: ChatMode;
    settings: ChatSettings;
    preset: ResolvedPreset;
    characterList: Character[];
    persona: Awaited<ReturnType<ChatsService["resolvePersona"]>>;
    lorebooks: Awaited<ReturnType<ChatsService["resolveLorebooks"]>>;
    nameByCharacterId: Map<string, string>;
    turn: SpeakerTurn;
    historyMessages: ChatMessage[];
    chatSummary: string;
    generationGuide?: string;
    impersonateDirection?: string;
    agentInjectTexts?: string[];
    parentChatId?: string | null;
    connectedChatIds?: string[];
    chatHistoryOverride?: string;
    conversationMemory?: string;
    chatId?: string;
    memoryChunks?: ChatMemoryChunk[];
    /** When true, clear one-shot influences after injecting them (generation only). */
    consumeConnectedInfluences?: boolean;
  }): Promise<{
    messages: LlmChatMessage[];
    character_id: string | null;
    character_name: string;
    characterId: string | null;
    characterName: string;
    role: ChatMessage["role"];
    lore_hits: PeekPromptLoreHit[];
    lore_token_estimate: number;
  }> {
    const {
      mode,
      settings,
      preset,
      characterList,
      persona,
      lorebooks,
      nameByCharacterId,
      turn,
      historyMessages: rawHistory,
      chatSummary,
      generationGuide,
      impersonateDirection,
      agentInjectTexts,
      parentChatId,
      connectedChatIds = [],
      chatHistoryOverride,
      conversationMemory,
      chatId,
      memoryChunks,
      consumeConnectedInfluences,
    } = input;
    const promptCharacterIds = activeCharacterIds(settings);
    const primary = characterList[0] ?? null;

    const depth = effectiveChatContextLimit(settings);
    const historyMessages =
      rawHistory.length <= depth
        ? rawHistory
        : rawHistory.slice(rawHistory.length - depth);

    let characterId: string | null = null;
    let characterName = "Narrator";
    let promptCharacters = characterList;
    let role: ChatMessage["role"] = "assistant";
    const extraSystemParts: string[] = [];

    if (turn.kind === "impersonate") {
      characterId = null;
      characterName = persona?.name?.trim() || "User";
      role = "user";
      const personaDescription = [
        persona?.description?.trim(),
        persona?.personality?.trim(),
        persona?.appearance?.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");
      extraSystemParts.push(
        buildImpersonateInstruction({
          customPrompt: settings.impersonate_prompt_template,
          direction: impersonateDirection,
          personaName: characterName,
          personaDescription,
        }),
      );
    } else if (turn.kind === "merged") {
      characterId = primary?.id ?? null;
      characterName = primary?.data.name.trim() || "Narrator";
      promptCharacters = characterList;
    } else {
      const speaker =
        characterList.find((c) => c.id === turn.characterId) ?? null;
      if (!speaker) {
        throw new BadRequestException(
          `Character ${turn.characterId} is not in this chat`,
        );
      }
      characterId = speaker.id;
      characterName = speaker.data.name.trim() || "Character";
      promptCharacters = [speaker];
      if (
        settings.add_turn_to_prompt !== false &&
        settings.character_ids.length > 1 &&
        settings.group_mode === "individual"
      ) {
        extraSystemParts.push(
          `Respond ONLY as ${characterName}. Do not speak or narrate for other characters.`,
        );
      }
    }

    if (generationGuide?.trim()) {
      extraSystemParts.push(generationGuide.trim());
    }

    const groupInstructions = buildGroupChatRuntimeInstructions({
      mode,
      settings,
      characterNames: promptCharacterIds.map(
        (id) => nameByCharacterId.get(id) ?? "Character",
      ),
      wrapFormat: preset.wrap_format,
    });
    if (groupInstructions) {
      extraSystemParts.push(groupInstructions);
    }

    if (conversationMemory?.trim()) {
      extraSystemParts.push(conversationMemory.trim());
    }

    if (mode === "conversation" && settings.conversation_about_me_inject) {
      const aboutEntries: Array<{ name: string; about: string }> = [];
      for (const character of promptCharacters) {
        const override =
          settings.conversation_about_me_overrides[character.id]?.trim() ?? "";
        const about =
          override ||
          character.data.about_me?.trim() ||
          "";
        if (about) {
          aboutEntries.push({
            name:
              character.data.convo_display_name?.trim() ||
              character.data.name.trim() ||
              "Character",
            about,
          });
        }
      }
      if (persona) {
        const override =
          settings.conversation_about_me_overrides[persona.id]?.trim() ?? "";
        const about = override || persona.about_me?.trim() || "";
        if (about) {
          aboutEntries.push({
            name: persona.name.trim() || "User",
            about,
          });
        }
      }
      const aboutBlock = buildAboutMePromptBlock({ entries: aboutEntries });
      if (aboutBlock) extraSystemParts.push(aboutBlock);
    }

    if (mode === "conversation") {
      const postHistoryBlocks = promptCharacters
        .map((character) => resolveConvoPostHistoryBlock(character.data))
        .filter((block): block is string => Boolean(block));
      if (postHistoryBlocks.length === 1) {
        extraSystemParts.push(postHistoryBlocks[0]!);
      } else if (postHistoryBlocks.length > 1) {
        extraSystemParts.push(postHistoryBlocks.join("\n\n---\n\n"));
      }
    }

    if (mode === "conversation" && parentChatId) {
      try {
        const parentRow = await this.chats.findOneBy({ id: parentChatId });
        if (parentRow) {
          const parentChat = this.toChat(parentRow);
          const parentNameById = new Map(nameByCharacterId);
          for (const characterId of parentChat.settings.character_ids) {
            if (parentNameById.has(characterId)) continue;
            try {
              const character = await this.characters.findOne(characterId);
              parentNameById.set(
                characterId,
                character.data.name.trim() || "Character",
              );
            } catch {
              // Character may have been deleted; keep id fallback in block.
            }
          }
          const connected = buildConnectedParentChatBlock({
            parentChat,
            personaName: persona?.name?.trim() || "User",
            nameByCharacterId: parentNameById,
          });
          if (connected) extraSystemParts.push(connected);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to inject parent chat context for ${parentChatId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (mode === "conversation" && connectedChatIds.length) {
      for (const linkedId of connectedChatIds) {
        try {
          const linkedRow = await this.chats.findOneBy({ id: linkedId });
          if (linkedRow?.mode !== "roleplay") continue;
          const linkedChat = this.toChat(linkedRow);
          const linkedNameById = new Map(nameByCharacterId);
          for (const id of linkedChat.settings.character_ids) {
            if (linkedNameById.has(id)) continue;
            try {
              const character = await this.characters.findOne(id);
              linkedNameById.set(
                id,
                character.data.name.trim() || "Character",
              );
            } catch {
              // deleted character — id fallback
            }
          }
          const linkedBlock = buildConnectedLinkedRoleplayBlock({
            roleplayChat: linkedChat,
            personaName: persona?.name?.trim() || "User",
            nameByCharacterId: linkedNameById,
          });
          if (linkedBlock) extraSystemParts.push(linkedBlock);

          if (settings.character_commands !== false) {
            const instructions = buildConnectedLinkInstructions({
              roleplayTitle: linkedChat.title || "Connected roleplay",
              influenceEnabled: isConversationCommandEnabled(
                settings.conversation_command_toggles,
                "influence",
              ),
              noteEnabled: isConversationCommandEnabled(
                settings.conversation_command_toggles,
                "note",
              ),
            });
            if (instructions) extraSystemParts.push(instructions);
          }
        } catch (error) {
          this.logger.warn(
            `Failed to inject linked roleplay context for ${linkedId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }

    if (mode === "roleplay" && connectedChatIds.length) {
      const influences = settings.connected_pending_influences ?? [];
      const notes = settings.connected_notes ?? [];
      const influenceBlock = buildConnectedInfluencesBlock(influences);
      if (influenceBlock) {
        extraSystemParts.push(influenceBlock);
        // Consume one-shot influences after injection (generation only).
        if (consumeConnectedInfluences && chatId) {
          try {
            const row = await this.requireRow(chatId);
            row.settings = defaultChatSettings({
              ...row.settings,
              connected_pending_influences: [],
            });
            row.updated_at = new Date().toISOString();
            await this.chats.save(row);
          } catch (error) {
            this.logger.warn(
              `Failed to clear connected influences for ${chatId}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
      }
      const notesBlock = buildConnectedNotesBlock(notes);
      if (notesBlock) extraSystemParts.push(notesBlock);
      extraSystemParts.push(buildConnectedOocInstruction());
    }

    if (
      mode === "conversation" &&
      settings.cross_chat_awareness !== false &&
      chatId
    ) {
      const otherRows = await this.chats.find({
        order: { updated_at: "DESC" },
        take: 40,
      });
      const otherChats = otherRows
        .filter((candidate) => candidate.id !== chatId)
        .map((candidate) => this.toChat(candidate));
      const latestUser = [...historyMessages]
        .reverse()
        .find((message) => message.role === "user");
      const awareness = buildAwarenessBlock({
        currentChatId: chatId,
        characterIds: promptCharacterIds,
        otherChats,
        latestUserText: latestUser
          ? activeMessageText(latestUser)
          : undefined,
        characterMemories: settings.character_memories,
        nameByCharacterId,
      });
      if (awareness) extraSystemParts.push(awareness);
    }

    if (settings.enable_memory_recall) {
      // Query from recent turns (not only the latest user line) so short
      // messages like "to wysyłaj" still retrieve earlier related context.
      const recallQuery = historyMessages
        .slice(-8)
        .map((message) => activeMessageText(message).trim())
        .filter(Boolean)
        .join("\n");
      const chunks = normalizeChatMemoryChunks(memoryChunks ?? []);
      const memories =
        recallMemoryChunks({
          query: recallQuery,
          chunks,
        }) ??
        recallLexicalMemories({
          query: recallQuery,
          messages: historyMessages,
          excludeRecent: 2,
        });
      if (memories) extraSystemParts.push(memories);
    }

    if (agentInjectTexts?.length) {
      extraSystemParts.push(...agentInjectTexts.filter(Boolean));
    }

    const twatterBlock = await this.twatter.buildCarryoverBlock({
      chatMode: mode,
      characterIds: promptCharacterIds,
      personaId: settings.persona_id,
    });
    if (twatterBlock) {
      extraSystemParts.push(twatterBlock);
    }

    const {
      lorebooks: filteredLorebooks,
      hits: loreHits,
      tokenEstimate: loreTokenEstimate,
    } = await this.loreRetrieval.filterLorebooksForPrompt({
      lorebooks,
      historyMessages,
      tokenBudget: settings.lorebook_token_budget,
    });

    const prefixHistorySpeakers = groupHistoryUsesSpeakerPrefix(mode, settings);

    const chatHistoryText =
      chatHistoryOverride ??
      formatChatHistoryMarker(historyMessages, {
        charName: primary?.data.name,
        userName: persona?.name,
        nameByCharacterId,
        prefixSpeakerNames: prefixHistorySpeakers,
        messengerTimestamps: mode === "conversation",
        timezone:
          settings.conversation_timezone?.trim() ||
          settings.prompt_timezone?.trim() ||
          null,
        includeThinking: settings.exclude_past_reasoning === false,
        preferImageCaptions: settings.image_captioning_enabled === true,
      });

    const promptContext = buildPresetPromptContext({
      characters: promptCharacters,
      groupCharacters:
        settings.character_ids.length > 1 && turn.kind === "character"
          ? characterList
          : undefined,
      persona,
      lorebooks: filteredLorebooks,
      variables: {
        ...selectedVariableValues(preset.variables),
        ...settings.variables,
      },
      chatHistory: chatHistoryText,
      chatSummary,
      scenarioOverride: settings.scenario_override,
      characterInfoMode: mode === "conversation" ? "conversation" : "default",
    });

    let promptMessages: LlmChatMessage[] = buildPromptMessages(preset, {
      variables: promptContext.variables,
      markers: promptContext.markers,
    });

    if (extraSystemParts.length) {
      promptMessages = [
        ...promptMessages,
        { role: "system", content: extraSystemParts.join("\n") },
      ];
    }

    if (
      mode === "conversation" &&
      settings.character_ids.length > 1 &&
      turn.kind !== "impersonate"
    ) {
      const turnCharacterName =
        turn.kind === "character" ? characterName : null;
      // Keep group format as system — the final turn cue below is the only
      // user-role message so models don't treat command XML as "the user".
      promptMessages = [
        ...promptMessages,
        {
          role: "system",
          content: buildConversationGroupOutputFormat({
            wrapFormat: preset.wrap_format,
            characterNames: promptCharacterIds.map(
              (id) => nameByCharacterId.get(id) ?? "Character",
            ),
            userName: persona?.name?.trim() || "User",
            turnCharacterName,
          }),
        },
      ];
    }

    const scripts = (await this.regexes.findAll()).filter(
      (script) => script.enabled,
    );
    if (scripts.length) {
      const applied = applyRegexScriptsToPromptMessages(
        promptMessages.map((message) => ({
          role: message.role as "system" | "user" | "assistant",
          content: message.content,
        })),
        scripts,
        { characterId: characterId ?? primaryCharacterId(settings) },
      );
      promptMessages = applied.messages.map((message) => ({
        role: message.role as LlmChatMessage["role"],
        content: message.content,
      }));
    }

    if (
      mode === "roleplay" &&
      settings.allow_character_dms &&
      !parentChatId &&
      turn.kind !== "impersonate"
    ) {
      const reminder = buildRoleplayDmCommandReminder({
        characterNames: promptCharacterIds.map(
          (id) => nameByCharacterId.get(id) ?? "Character",
        ),
        userName: persona?.name?.trim() || "the user",
      });
      promptMessages = [
        ...promptMessages,
        { role: "system", content: reminder },
      ];
    }

    if (
      mode === "conversation" &&
      settings.character_commands !== false &&
      turn.kind !== "impersonate"
    ) {
      const enabledKeys = CONVERSATION_COMMAND_KEYS.filter(
        (key) => settings.conversation_command_toggles[key] !== false,
      );
      if (enabledKeys.length) {
        const reminder = buildConversationCommandsReminder({
          characterNames: promptCharacterIds.map(
            (id) => nameByCharacterId.get(id) ?? "Character",
          ),
          enabledKeys,
        });
        promptMessages = [
          ...promptMessages,
          { role: "system", content: reminder },
        ];
      }
    }

    // Conversation history lives in system sections. Without an explicit
    // user turn cue, models often continue the transcript as the user
    // (especially on regenerate, when the last history line is User: …).
    if (mode === "conversation") {
      const userName = persona?.name?.trim() || "User";
      if (turn.kind === "impersonate") {
        promptMessages = [
          ...promptMessages,
          {
            role: "user",
            content: `Write ONLY the next short SMS as ${characterName} (the user persona). Do not write as anyone else.`,
          },
        ];
      } else {
        promptMessages = [
          ...promptMessages,
          {
            role: "user",
            content: `Continue the DM. Write ONLY the next short SMS as ${characterName}. Never write ${userName}'s messages or continue as ${userName}.`,
          },
        ];
      }
    }

    return {
      messages: promptMessages,
      character_id: characterId,
      character_name: characterName,
      characterId,
      characterName,
      role,
      lore_hits: loreHits.map((hit) => ({
        lorebook_id: hit.lorebook_id,
        lorebook_name: hit.lorebook_name,
        entry_name:
          hit.entry.name?.trim() ||
          hit.entry.keys?.[0] ||
          "Untitled entry",
        source: hit.source,
        score: hit.score,
        preview: (hit.entry.content ?? "").trim().slice(0, 240),
      })),
      lore_token_estimate: loreTokenEstimate,
    };
  }

  private async resolvePersona(personaId: string | null) {
    if (personaId) return this.personas.findOne(personaId);
    const list = await this.personas.findAll();
    const defaultPersona = list.find((persona) => persona.is_default);
    if (!defaultPersona) return null;
    return this.personas.findOne(defaultPersona.id);
  }

  private async resolveLorebooks(settings: ChatSettings) {
    const pinnedIds = [...new Set((settings.lorebook_ids ?? []).filter(Boolean))];
    const all = await this.lorebooks.findAll();
    const globalIds = all
      .filter((book) => book.global && book.enabled)
      .map((book) => book.id);
    const ids = [...new Set([...pinnedIds, ...globalIds])];
    const result = [];
    for (const id of ids) {
      result.push(await this.lorebooks.findOne(id));
    }
    return result;
  }

  async uploadAttachment(
    chatId: string,
    input: { buffer: Buffer; mime: string; name: string },
  ): Promise<ChatMessageAttachment> {
    await this.requireRow(chatId);
    if (!input.buffer.length) {
      throw new BadRequestException("Empty file");
    }
    if (input.buffer.length > 25 * 1024 * 1024) {
      throw new BadRequestException("File exceeds 25MB limit");
    }
    try {
      return await writeChatAttachment({
        chatId,
        attachmentId: randomUUID(),
        buffer: input.buffer,
        mime: input.mime,
        name: input.name,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Failed to store attachment",
      );
    }
  }

  private async resolveAttachments(
    chatId: string,
    attachments: ChatMessageAttachment[] | undefined,
  ): Promise<ChatMessageAttachment[]> {
    if (!attachments?.length) return [];
    const resolved: ChatMessageAttachment[] = [];
    for (const item of attachments) {
      if (!item?.id || typeof item.id !== "string") {
        throw new BadRequestException("Invalid attachment id");
      }
      const expectedUrl = imageApiPaths.chatAttachment(chatId, item.id);
      if (item.url !== expectedUrl) {
        throw new BadRequestException(
          `Attachment ${item.id} does not belong to this chat`,
        );
      }
      if (!(await chatAttachmentExists(chatId, item.id))) {
        throw new BadRequestException(`Attachment ${item.id} was not uploaded`);
      }
      const meta = await readChatAttachmentMeta(chatId, item.id);
      if (!meta) {
        throw new BadRequestException(`Attachment ${item.id} metadata missing`);
      }
      resolved.push({
        id: item.id,
        kind: item.kind === "image" || item.kind === "file" ? item.kind : "file",
        mime: meta.mime,
        url: expectedUrl,
        name: meta.name,
        size: meta.size,
      });
    }
    return resolved;
  }

  private async requireRow(id: string): Promise<ChatEntity> {
    const row = await this.chats.findOneBy({ id });
    if (!row) throw new NotFoundException(`Chat ${id} not found`);
    return row;
  }

  private toChat(row: ChatEntity): Chat {
    const summaryEntries = normalizeChatSummaryEntries(row.summary_entries ?? [], {
      legacy_summary: row.summary,
    });
    const compiledSummary =
      compileChatSummaryEntries(summaryEntries) || row.summary || "";
    return {
      id: row.id,
      title: row.title,
      mode: row.mode,
      settings: defaultChatSettings(row.settings),
      messages: normalizeChatMessages(row.messages ?? []),
      summary: compiledSummary,
      summary_entries: summaryEntries,
      last_automatic_summary_message_id:
        row.last_automatic_summary_message_id ?? null,
      day_summaries: normalizeDaySummaries(row.day_summaries),
      week_summaries: normalizeWeekSummaries(row.week_summaries),
      conversation_summary_failures: normalizeConversationSummaryFailures(
        row.conversation_summary_failures,
      ),
      memory_chunks: normalizeChatMemoryChunks(row.memory_chunks),
      agent_state: row.agent_state ?? {},
      parent_chat_id: row.parent_chat_id ?? null,
      connected_chat_ids: this.connectedIdsOf(row),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async listMemoryChunks(chatId: string): Promise<ChatMemoryChunk[]> {
    const row = await this.requireRow(chatId);
    return normalizeChatMemoryChunks(row.memory_chunks);
  }

  async rebuildChatMemories(chatId: string): Promise<Chat> {
    const row = await this.requireRow(chatId);
    const settings = defaultChatSettings(row.settings);
    const { nameByCharacterId, userName } =
      await this.resolveMemoryNameMap(row);
    row.memory_chunks = rebuildMemoryChunks({
      messages: visibleChatMessages(row.messages ?? []),
      existing: normalizeChatMemoryChunks(row.memory_chunks),
      readBehindMessageCount: effectiveChatContextLimit(settings),
      nameByCharacterId,
      userName,
      createId: () => randomUUID(),
    });
    row.updated_at = new Date().toISOString();
    return this.toChat(await this.chats.save(row));
  }

  async clearChatMemories(chatId: string): Promise<Chat> {
    const row = await this.requireRow(chatId);
    row.memory_chunks = [];
    row.updated_at = new Date().toISOString();
    return this.toChat(await this.chats.save(row));
  }

  async updateMemoryChunk(
    chatId: string,
    chunkId: string,
    content: string,
  ): Promise<Chat> {
    const row = await this.requireRow(chatId);
    const chunks = normalizeChatMemoryChunks(row.memory_chunks);
    const index = chunks.findIndex((chunk) => chunk.id === chunkId);
    if (index < 0) {
      throw new NotFoundException(`Memory chunk ${chunkId} not found`);
    }
    const trimmed = content.trim();
    if (!trimmed) {
      throw new BadRequestException("Memory content cannot be empty");
    }
    chunks[index] = { ...chunks[index]!, content: trimmed };
    row.memory_chunks = chunks;
    row.updated_at = new Date().toISOString();
    return this.toChat(await this.chats.save(row));
  }

  async deleteMemoryChunk(chatId: string, chunkId: string): Promise<Chat> {
    const row = await this.requireRow(chatId);
    const chunks = normalizeChatMemoryChunks(row.memory_chunks);
    const next = chunks.filter((chunk) => chunk.id !== chunkId);
    if (next.length === chunks.length) {
      throw new NotFoundException(`Memory chunk ${chunkId} not found`);
    }
    row.memory_chunks = next;
    row.updated_at = new Date().toISOString();
    return this.toChat(await this.chats.save(row));
  }

  async importMemoryChunks(
    chatId: string,
    chunks: unknown,
    replace = false,
  ): Promise<Chat> {
    const row = await this.requireRow(chatId);
    const incoming = normalizeChatMemoryChunks(chunks).map((chunk) => ({
      ...chunk,
      id: randomUUID(),
      source_chat_id: chunk.source_chat_id || "import",
      created_at: new Date().toISOString(),
    }));
    const existing = replace
      ? normalizeChatMemoryChunks(row.memory_chunks).filter(
          (chunk) => !chunk.source_chat_id,
        )
      : normalizeChatMemoryChunks(row.memory_chunks);
    row.memory_chunks = [...existing, ...incoming].sort((a, b) =>
      a.first_message_at.localeCompare(b.first_message_at),
    );
    row.updated_at = new Date().toISOString();
    return this.toChat(await this.chats.save(row));
  }

  private async syncMemoryChunks(chatId: string): Promise<Chat | null> {
    const row = await this.requireRow(chatId);
    const settings = defaultChatSettings(row.settings);
    if (!settings.enable_memory_recall) return null;
    const existing = normalizeChatMemoryChunks(row.memory_chunks);
    const { nameByCharacterId, userName } =
      await this.resolveMemoryNameMap(row);
    const next = appendPendingMemoryChunks({
      messages: visibleChatMessages(row.messages ?? []),
      existing,
      readBehindMessageCount: effectiveChatContextLimit(settings),
      nameByCharacterId,
      userName,
      createId: () => randomUUID(),
    });
    if (
      next.length === existing.length &&
      next.every((chunk, index) => chunk.id === existing[index]?.id)
    ) {
      return null;
    }
    row.memory_chunks = next;
    row.updated_at = new Date().toISOString();
    return this.toChat(await this.chats.save(row));
  }

  private async resolveMemoryNameMap(row: ChatEntity): Promise<{
    nameByCharacterId: Map<string, string>;
    userName: string;
  }> {
    const settings = defaultChatSettings(row.settings);
    const characterList = await this.loadPromptCharacters(settings);
    const persona = await this.resolvePersona(settings.persona_id);
    const nameByCharacterId = new Map(
      characterList.map((character) => [
        character.id,
        character.data.convo_display_name?.trim() ||
          character.data.name ||
          "Character",
      ]),
    );
    return {
      nameByCharacterId,
      userName: persona?.name?.trim() || "User",
    };
  }

  private toListItem(row: ChatEntity): ChatListItem {
    const messages = visibleChatMessages(row.messages ?? []);
    const last = [...messages]
      .reverse()
      .find((message) => activeMessageText(message).trim());
    return {
      id: row.id,
      title: row.title,
      mode: row.mode,
      created_at: row.created_at,
      updated_at: row.updated_at,
      message_count: messages.length,
      preview: last ? activeMessageText(last).slice(0, 160) : null,
      connected_chat_ids: this.connectedIdsOf(row),
      parent_chat_id: row.parent_chat_id ?? null,
    };
  }
}
