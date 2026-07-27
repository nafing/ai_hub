import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
import {
  activeMessageText,
  ancestorChatMessages,
  applyRegexScriptsToPromptMessages,
  branchParentOf,
  buildPresetPromptContext,
  buildPromptMessages,
  buildCharacterGreetingMessage,
  createChatMessage,
  defaultChatSettings,
  extractThinking,
  fallbackSpeakerId,
  formatChatHistoryMarker,
  formatRecentHistoryForSmart,
  formatSmartCandidate,
  normalizeChatMessages,
  parseSlashCommand,
  parseSmartSpeakerIds,
  primaryCharacterId,
  removeChatMessageSubtree,
  removeChatMessageSwipe,
  resolveSpeakerQueue,
  selectedVariableValues,
  unresolvedPresetVariables,
  visibleChatMessages,
  type Character,
  type Chat,
  type ChatListItem,
  type ChatMessage,
  type ChatSettings,
  type ChatStreamEvent,
  type CreateChatInput,
  type CreateChatMessageInput,
  type GenerateChatInput,
  type LlmChatMessage,
  type PeekPromptLoreHit,
  type PeekPromptMemoryHit,
  type PeekPromptResult,
  type SpeakerTurn,
  type UpdateChatInput,
  type UpdateChatMessageInput,
} from "@ai-hub/shared";
import { ChatMemoryService } from "../../lancedb/chat-memory.service";
import { LoreRetrievalService } from "../../lancedb/lore-retrieval.service";
import { completeWithConnection } from "../../utils/openrouter";
import { AgentRunnerService } from "../agents/agent-runner.service";
import { CharactersService } from "../characters/characters.service";
import { ConnectionsService } from "../connections/connections.service";
import { LorebooksService } from "../lorebooks/lorebooks.service";
import { PersonasService } from "../personas/personas.service";
import { PresetsService } from "../presets/presets.service";
import { RegexesService } from "../regexes/regexes.service";
import { ChatEntity } from "./chat.entity";

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
    private readonly chatMemory: ChatMemoryService,
    private readonly agentRunner: AgentRunnerService,
    private readonly regexes: RegexesService,
  ) {}

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

      if (!input.skip_greeting) {
        for (const [index, character] of resolvedCharacters.entries()) {
          // Each character gets first_mes + alternate_greetings as swipe branches.
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
      agent_state: {},
      parent_chat_id: input.parent_chat_id?.trim() || null,
      created_at: now,
      updated_at: now,
    });
    const saved = await this.chats.save(entity);
    if (messages.length > 0) {
      void this.chatMemory.indexMessages(saved.id, messages);
    }
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
    await this.chats.delete({ id });
    void this.chatMemory.deleteChat(id);
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

  /**
   * Applies Character DM agent JSON: open/continue side DMs and kick generation.
   */
  private async applyCharacterDmAgent(
    parentId: string,
    state: unknown,
    settings: ChatSettings,
  ): Promise<{
    state: Record<string, unknown>;
    character_dm_chat_ids?: Record<string, string>;
  }> {
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return { state: { error: "invalid character-dm state" } };
    }
    const record = { ...(state as Record<string, unknown>) };
    if (record.error) return { state: record };

    const rawDms = Array.isArray(record.dms) ? record.dms : [];
    const maxDms = 2;
    const started: Array<{
      characterId: string;
      chatId: string;
      reason?: string;
      title?: string;
    }> = [];
    const errors: string[] = [];
    let map = { ...settings.character_dm_chat_ids };

    for (const item of rawDms.slice(0, maxDms)) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const entry = item as Record<string, unknown>;
      const characterId = String(entry.characterId ?? "").trim();
      if (!characterId) continue;
      if (!settings.character_ids.includes(characterId)) {
        errors.push(`skipped unknown characterId ${characterId}`);
        continue;
      }

      const reason =
        typeof entry.reason === "string" ? entry.reason.trim() : "";
      const openingMessage =
        typeof entry.openingMessage === "string"
          ? entry.openingMessage.trim()
          : "";

      try {
        const dm = await this.getOrCreateCharacterDm(parentId, characterId);
        map = { ...map, [characterId]: dm.id };

        if (openingMessage) {
          await this.addMessage(dm.id, {
            role: "user",
            content: openingMessage,
          });
        } else if (dm.messages.length === 0 && reason) {
          await this.addMessage(dm.id, {
            role: "system",
            content: `Private side conversation. Context: ${reason}`,
          });
        }

        void this.generate(dm.id, { forCharacterId: characterId }, () => {}).catch(
          (error) => {
            const message =
              error instanceof Error ? error.message : String(error);
            this.logger.warn(
              `Character DM generate failed for ${dm.id}: ${message}`,
            );
          },
        );

        started.push({
          characterId,
          chatId: dm.id,
          reason: reason || undefined,
          title: dm.title,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        errors.push(`${characterId}: ${message}`);
        this.logger.warn(`Character DM apply failed: ${message}`);
      }
    }

    return {
      state: {
        ...record,
        started,
        ...(errors.length ? { applyErrors: errors } : {}),
        appliedAt: new Date().toISOString(),
      },
      character_dm_chat_ids: map,
    };
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
    const content = input.content?.trim();
    if (!content) throw new BadRequestException("content is required");
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
      ...branchParentOf(row.messages),
    });
    row.messages = [...normalizeChatMessages(row.messages), message];
    row.updated_at = new Date().toISOString();
    const saved = await this.chats.save(row);
    void this.chatMemory.indexMessage(id, message);
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
        void this.chatMemory.deleteMessage(id, messageId);
        return this.toChat(saved);
      }
      const swipeId = existing.swipe_id;
      row.messages = removeChatMessageSwipe(row.messages, messageId, swipeId);
      row.updated_at = new Date().toISOString();
      const saved = await this.chats.save(row);
      const updated = saved.messages.find((message) => message.id === messageId);
      if (updated) void this.chatMemory.indexMessage(id, updated);
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

    row.messages = row.messages.map((item, i) =>
      i === index ? message : item,
    );
    row.updated_at = new Date().toISOString();
    const saved = await this.chats.save(row);
    void this.chatMemory.indexMessage(id, message);
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
    void this.chatMemory.deleteMessage(id, messageId);
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
    if (rawUserText) {
      const { command, rest } = parseSlashCommand(rawUserText);
      const storedContent = command
        ? rest.trim() || `/${command}`
        : rawUserText;
      row.messages = normalizeChatMessages(row.messages);
      const userMessage = createChatMessage({
        role: "user",
        content: storedContent,
        id: randomUUID(),
        ...branchParentOf(row.messages),
      });
      row.messages = [...row.messages, userMessage];
      row.updated_at = new Date().toISOString();
      await this.chats.save(row);
      void this.chatMemory.indexMessage(row.id, userMessage);
      emit({ type: "user_message", message: userMessage });
    }

    await this.runCompletion(row, emit, {
      mode: "generate",
      forCharacterId: input.forCharacterId,
      queueUserMessage: rawUserText || null,
      generationGuide: input.generationGuide?.trim() || undefined,
      impersonate: Boolean(input.impersonate),
      runDirector: Boolean(input.runDirector),
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
    const characterList: Character[] = [];
    for (const characterId of settings.character_ids) {
      characterList.push(await this.characters.findOne(characterId));
    }
    const persona = await this.resolvePersona(settings.persona_id);
    const lorebooks = await this.resolveLorebooks(settings);
    const nameByCharacterId = new Map(
      characterList.map((character) => [
        character.id,
        character.data.name.trim() || "Character",
      ]),
    );
    const preset = settings.preset_id
      ? await this.presets.findOne(settings.preset_id)
      : await this.presets.findDefault(row.mode);

    let historyMessages = visibleChatMessages(row.messages);
    let turn: SpeakerTurn = { kind: "merged" };

    if (messageId) {
      const index = row.messages.findIndex((message) => message.id === messageId);
      if (index === -1) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }
      const target = row.messages[index];
      if (target.role === "assistant") {
        historyMessages = ancestorChatMessages(row.messages, messageId);
        turn =
          target.character_id &&
          settings.character_ids.includes(target.character_id)
            ? { kind: "character", characterId: target.character_id }
            : { kind: "merged" };
      } else if (target.role === "user") {
        historyMessages = ancestorChatMessages(row.messages, messageId);
        turn = { kind: "impersonate" };
      } else {
        // Peek "next reply after this message"
        historyMessages = [
          ...ancestorChatMessages(row.messages, messageId),
          target,
        ];
        turn =
          settings.group_mode === "individual" && settings.character_ids[0]
            ? { kind: "character", characterId: settings.character_ids[0] }
            : { kind: "merged" };
      }
    }

    return this.buildTurnPrompt({
      chatId: row.id,
      settings,
      preset,
      characterList,
      persona,
      lorebooks,
      nameByCharacterId,
      turn,
      historyMessages,
      chatSummary: row.summary,
    });
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
      runDirector?: boolean;
    },
  ): Promise<void> {
    const settings = defaultChatSettings(row.settings);
    row.settings = settings;

    const connection = settings.connection_id
      ? await this.connections.findOne(settings.connection_id)
      : await this.connections.findDefault();

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

    const preset = settings.preset_id
      ? await this.presets.findOne(settings.preset_id)
      : await this.presets.findDefault(row.mode);

    const characterList: Character[] = [];
    for (const characterId of settings.character_ids) {
      characterList.push(await this.characters.findOne(characterId));
    }
    const persona = await this.resolvePersona(settings.persona_id);
    const lorebooks = await this.resolveLorebooks(settings);
    const nameByCharacterId = new Map(
      characterList.map((character) => [
        character.id,
        character.data.name.trim() || "Character",
      ]),
    );

    if (options.mode === "regenerate" && options.targetIndex !== undefined) {
      const existing = row.messages[options.targetIndex];
      const turn: SpeakerTurn =
        existing.role === "user"
          ? { kind: "impersonate" }
          : existing.character_id &&
              settings.character_ids.includes(existing.character_id)
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
        historyMessages: ancestorChatMessages(row.messages, existing.id),
        regenerateIndex: options.targetIndex,
        generationGuide: options.generationGuide,
        runDirector: options.runDirector,
      });
      return;
    }

    const visibleMessages = visibleChatMessages(row.messages);
    const turns = await this.resolveTurns({
      settings,
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
        historyMessages: visibleChatMessages(row.messages),
        generationGuide: options.generationGuide,
        runDirector: options.runDirector,
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
      input.settings.character_ids,
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
      "You are selecting which character(s) should speak next in a roleplay group chat.",
      'Return ONLY a JSON array of character id strings, e.g. ["id-1"].',
      "Usually pick exactly one character. Pick multiple only when several have a strong reason to speak now.",
      "Prefer more talkative characters when the scene is ambiguous.",
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
    runDirector?: boolean;
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
      runDirector,
    } = input;
    const settings = defaultChatSettings(row.settings);

    const selectedAgents = await this.agentRunner.loadSelectedAgents({
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
              personality: character.data.personality,
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

    const built = await this.buildTurnPrompt({
      chatId: row.id,
      settings,
      preset,
      characterList,
      persona,
      lorebooks,
      nameByCharacterId,
      turn,
      historyMessages,
      chatSummary: row.summary,
      generationGuide,
      agentInjectTexts: pre.injectTexts,
    });

    const { characterId, characterName, role, messages: promptMessages } =
      built;

    emit({
      type: "turn_start",
      character_id: characterId,
      character_name: characterName,
    });

    const result = await completeWithConnection(connection, promptMessages, {
      stream: {
        onContentDelta: (delta) => emit({ type: "delta", delta }),
        onReasoningDelta: (delta) => emit({ type: "thinking", delta }),
      },
      parseThinking: true,
    });

    let content = result.content;
    let thinking = result.thinking;
    const parsed = extractThinking(result.reply, connection.thinking_tag);
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
        !row.parent_chat_id &&
        settings.allow_character_dms &&
        mutable.agentState["character-dm"]
      ) {
        const applied = await this.applyCharacterDmAgent(
          row.id,
          mutable.agentState["character-dm"],
          settings,
        );
        mutable.agentState["character-dm"] = applied.state;
        if (applied.character_dm_chat_ids) {
          row.settings = defaultChatSettings({
            ...defaultChatSettings(row.settings),
            character_dm_chat_ids: applied.character_dm_chat_ids,
          });
        }
      }

      row.agent_state = mutable.agentState;
      row.summary = mutable.summary;
      row.messages = mutable.messages;
    }

    let savedMessage: ChatMessage;
    if (regenerateIndex !== undefined) {
      const existing = row.messages[regenerateIndex];
      const swipes = [...existing.swipes, content];
      savedMessage = {
        ...existing,
        swipes,
        swipe_id: swipes.length - 1,
        thinking: thinking || null,
        character_id: existing.character_id ?? characterId,
      };
      row.messages = row.messages.map((message, index) =>
        index === regenerateIndex ? savedMessage : message,
      );
    } else {
      row.messages = normalizeChatMessages(row.messages);
      savedMessage = createChatMessage({
        role,
        content,
        id: randomUUID(),
        thinking: role === "assistant" ? thinking || null : null,
        character_id: role === "assistant" ? characterId : null,
        ...branchParentOf(row.messages),
      });
      row.messages = [...row.messages, savedMessage];
    }

    row.updated_at = new Date().toISOString();
    const saved = await this.chats.save(row);
    Object.assign(row, saved);
    void this.chatMemory.indexMessage(row.id, savedMessage);
    emit({
      type: "done",
      message: savedMessage,
      chat: this.toChat(saved),
    });
  }

  private async buildTurnPrompt(input: {
    chatId: string;
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
    agentInjectTexts?: string[];
  }): Promise<{
    messages: LlmChatMessage[];
    character_id: string | null;
    character_name: string;
    characterId: string | null;
    characterName: string;
    role: ChatMessage["role"];
    lore_hits: PeekPromptLoreHit[];
    lore_token_estimate: number;
    memory_hits: PeekPromptMemoryHit[];
    memory_token_estimate: number;
  }> {
    const {
      chatId,
      settings,
      preset,
      characterList,
      persona,
      lorebooks,
      nameByCharacterId,
      turn,
      historyMessages: rawHistory,
      chatSummary: rawSummary,
      generationGuide,
      agentInjectTexts,
    } = input;
    const primary = characterList[0] ?? null;

    const memory = await this.chatMemory.preparePromptMemory({
      chatId,
      settings,
      historyMessages: rawHistory,
      chatSummary: rawSummary,
      nameByCharacterId,
      charName: primary?.data.name,
      userName: persona?.name,
    });
    const historyMessages = memory.historyMessages;
    const chatSummary = memory.chatSummary;

    let characterId: string | null = null;
    let characterName = "Narrator";
    let promptCharacters = characterList;
    let role: ChatMessage["role"] = "assistant";
    const extraSystemParts: string[] = [];

    if (turn.kind === "impersonate") {
      characterId = null;
      characterName = persona?.name?.trim() || "User";
      role = "user";
      extraSystemParts.push(
        `Write the next message as ${characterName} (the user persona). Do not write as any other character.`,
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
      promptCharacters = [
        speaker,
        ...characterList.filter((c) => c.id !== speaker.id),
      ];
      if (
        settings.add_turn_to_prompt &&
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
    if (agentInjectTexts?.length) {
      extraSystemParts.push(...agentInjectTexts.filter(Boolean));
    }

    const {
      lorebooks: filteredLorebooks,
      hits: loreHits,
      tokenEstimate: loreTokenEstimate,
    } = await this.loreRetrieval.filterLorebooksForPrompt({
      lorebooks,
      historyMessages,
    });

    const promptContext = buildPresetPromptContext({
      characters: promptCharacters,
      persona,
      lorebooks: filteredLorebooks,
      variables: {
        ...selectedVariableValues(preset.variables),
        ...settings.variables,
      },
      chatHistory: formatChatHistoryMarker(historyMessages, {
        charName: primary?.data.name,
        userName: persona?.name,
        nameByCharacterId,
      }),
      chatSummary,
      scenarioOverride: settings.scenario_override,
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
      memory_hits: memory.hits.map((hit) => ({
        message_id: hit.message_id,
        role: hit.role,
        score: hit.score,
        preview: hit.content.slice(0, 240),
      })),
      memory_token_estimate: memory.tokenEstimate,
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
    const ids = settings.lorebook_ids ?? [];
    if (!ids.length) {
      const all = await this.lorebooks.findAll();
      const result = [];
      for (const item of all.filter((book) => book.global && book.enabled)) {
        result.push(await this.lorebooks.findOne(item.id));
      }
      return result;
    }
    const result = [];
    for (const id of ids) {
      result.push(await this.lorebooks.findOne(id));
    }
    return result;
  }

  private async requireRow(id: string): Promise<ChatEntity> {
    const row = await this.chats.findOneBy({ id });
    if (!row) throw new NotFoundException(`Chat ${id} not found`);
    return row;
  }

  private toChat(row: ChatEntity): Chat {
    return {
      id: row.id,
      title: row.title,
      mode: row.mode,
      settings: defaultChatSettings(row.settings),
      messages: normalizeChatMessages(row.messages ?? []),
      summary: row.summary ?? "",
      agent_state: row.agent_state ?? {},
      parent_chat_id: row.parent_chat_id ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
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
    };
  }
}
