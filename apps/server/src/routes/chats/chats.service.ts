import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
import {
  activeMessageText,
  applyRegexScriptsToPromptMessages,
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
  parseSlashCommand,
  parseSmartSpeakerIds,
  primaryCharacterId,
  resolveSpeakerQueue,
  selectedVariableValues,
  type Agent,
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
  type SpeakerTurn,
  type UpdateChatInput,
  type UpdateChatMessageInput,
} from "@ai-hub/shared";
import { completeWithConnection } from "../../utils/openrouter";
import { AgentsService } from "../agents/agents.service";
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
  constructor(
    @InjectRepository(ChatEntity)
    private readonly chats: Repository<ChatEntity>,
    private readonly connections: ConnectionsService,
    private readonly presets: PresetsService,
    private readonly characters: CharactersService,
    private readonly personas: PersonasService,
    private readonly lorebooks: LorebooksService,
    private readonly agents: AgentsService,
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
        messages.push(greeting);
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
      created_at: now,
      updated_at: now,
    });
    return this.toChat(await this.chats.save(entity));
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
        character_ids:
          input.settings.character_ids ?? row.settings.character_ids ?? [],
        variables: input.settings.variables ?? row.settings.variables ?? {},
      });
    }
    row.updated_at = new Date().toISOString();
    return this.toChat(await this.chats.save(row));
  }

  async remove(id: string): Promise<void> {
    await this.requireRow(id);
    await this.chats.delete({ id });
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
    row.messages = [
      ...row.messages,
      createChatMessage({
        role,
        content,
        id: randomUUID(),
        character_id: characterId,
      }),
    ];
    row.updated_at = new Date().toISOString();
    return this.toChat(await this.chats.save(row));
  }

  async updateMessage(
    id: string,
    messageId: string,
    input: UpdateChatMessageInput,
  ): Promise<Chat> {
    const row = await this.requireRow(id);
    const index = row.messages.findIndex((message) => message.id === messageId);
    if (index === -1) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    if (input.remove_active_swipe) {
      const existing = row.messages[index];
      if (existing.swipes.length <= 1) {
        row.messages = row.messages.filter((message) => message.id !== messageId);
      } else {
        const swipeId = existing.swipe_id;
        const swipes = existing.swipes.filter((_, i) => i !== swipeId);
        const nextSwipeId = Math.min(swipeId, swipes.length - 1);
        row.messages = row.messages.map((item, i) =>
          i === index
            ? {
                ...item,
                swipes,
                swipe_id: nextSwipeId,
              }
            : item,
        );
      }
      row.updated_at = new Date().toISOString();
      return this.toChat(await this.chats.save(row));
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
    return this.toChat(await this.chats.save(row));
  }

  async removeMessage(id: string, messageId: string): Promise<Chat> {
    const row = await this.requireRow(id);
    if (!row.messages.some((message) => message.id === messageId)) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }
    row.messages = row.messages.filter((message) => message.id !== messageId);
    row.updated_at = new Date().toISOString();
    return this.toChat(await this.chats.save(row));
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

    const rawUserText = input.userMessage?.trim() ?? "";
    if (rawUserText) {
      const { command, rest } = parseSlashCommand(rawUserText);
      const storedContent = command
        ? rest.trim() || `/${command}`
        : rawUserText;
      const userMessage = createChatMessage({
        role: "user",
        content: storedContent,
        id: randomUUID(),
      });
      row.messages = [...row.messages, userMessage];
      row.updated_at = new Date().toISOString();
      await this.chats.save(row);
      emit({ type: "user_message", message: userMessage });
    }

    await this.runCompletion(row, emit, {
      mode: "generate",
      forCharacterId: input.forCharacterId,
      queueUserMessage: rawUserText || null,
      generationGuide: input.generationGuide?.trim() || undefined,
      impersonate: Boolean(input.impersonate),
    });
  }

  async regenerate(
    id: string,
    emit: StreamEmit,
    messageId?: string,
  ): Promise<void> {
    const row = await this.requireRow(id);
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
      targetIndex = [...row.messages]
        .map((message, index) => ({ message, index }))
        .reverse()
        .find(
          ({ message }) =>
            message.role === "assistant" || message.role === "user",
        )?.index;
    }

    if (targetIndex === undefined) {
      throw new BadRequestException("No message to regenerate");
    }

    await this.runCompletion(row, emit, {
      mode: "regenerate",
      targetIndex,
    });
  }

  /** Build the prompt that would be used to regenerate / continue from a message. */
  async peekPrompt(
    id: string,
    messageId?: string,
  ): Promise<{
    messages: LlmChatMessage[];
    character_id: string | null;
    character_name: string;
  }> {
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

    let historyMessages = row.messages;
    let turn: SpeakerTurn = { kind: "merged" };

    if (messageId) {
      const index = row.messages.findIndex((message) => message.id === messageId);
      if (index === -1) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }
      const target = row.messages[index];
      if (target.role === "assistant") {
        historyMessages = row.messages.slice(0, index);
        turn =
          target.character_id &&
          settings.character_ids.includes(target.character_id)
            ? { kind: "character", characterId: target.character_id }
            : { kind: "merged" };
      } else if (target.role === "user") {
        historyMessages = row.messages.slice(0, index);
        turn = { kind: "impersonate" };
      } else {
        // Peek "next reply after this message"
        historyMessages = row.messages.slice(0, index + 1);
        turn =
          settings.group_mode === "individual" && settings.character_ids[0]
            ? { kind: "character", characterId: settings.character_ids[0] }
            : { kind: "merged" };
      }
    }

    return this.buildTurnPrompt({
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
        historyMessages: row.messages.slice(0, options.targetIndex),
        regenerateIndex: options.targetIndex,
        generationGuide: options.generationGuide,
      });
      return;
    }

    const turns = await this.resolveTurns({
      settings,
      characterList,
      messages: row.messages,
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
        historyMessages: row.messages,
        generationGuide: options.generationGuide,
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
    } = input;
    const settings = defaultChatSettings(row.settings);

    const built = await this.buildTurnPrompt({
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
      const agentResult = await this.runAgents({
        chat: this.toChat(row),
        settings,
        connection,
        content,
        historyMessages,
        characterName,
        userName: persona?.name,
      });
      content = agentResult.content;
      row.agent_state = { ...row.agent_state, ...agentResult.agentState };
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
      savedMessage = createChatMessage({
        role,
        content,
        id: randomUUID(),
        thinking: role === "assistant" ? thinking || null : null,
        character_id: role === "assistant" ? characterId : null,
      });
      row.messages = [...row.messages, savedMessage];
    }

    row.updated_at = new Date().toISOString();
    const saved = await this.chats.save(row);
    Object.assign(row, saved);
    emit({
      type: "done",
      message: savedMessage,
      chat: this.toChat(saved),
    });
  }

  private async buildTurnPrompt(input: {
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
  }): Promise<{
    messages: LlmChatMessage[];
    character_id: string | null;
    character_name: string;
    characterId: string | null;
    characterName: string;
    role: ChatMessage["role"];
  }> {
    const {
      settings,
      preset,
      characterList,
      persona,
      lorebooks,
      nameByCharacterId,
      turn,
      historyMessages,
      chatSummary,
      generationGuide,
    } = input;
    const primary = characterList[0] ?? null;

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

    const promptContext = buildPresetPromptContext({
      characters: promptCharacters,
      persona,
      lorebooks,
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
        promptMessages,
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
    };
  }

  private async runAgents(input: {
    chat: Chat;
    settings: ChatSettings;
    connection: ResolvedConnection;
    content: string;
    historyMessages: ChatMessage[];
    characterName?: string;
    userName?: string;
  }): Promise<{ content: string; agentState: Record<string, unknown> }> {
    const agentIds = input.settings.agent_ids ?? [];
    if (!agentIds.length) return { content: input.content, agentState: {} };

    const allAgents = await Promise.all(
      agentIds.map((agentId) => this.agents.findOne(agentId).catch(() => null)),
    );
    const selected = allAgents.filter(
      (agent): agent is Agent =>
        Boolean(agent) &&
        !agent!.runtime_disabled &&
        agent!.execution === "llm" &&
        this.agentAllowedForMode(agent!, input.chat.mode),
    );

    let content = input.content;
    const agentState: Record<string, unknown> = {};

    for (const agent of selected.filter(
      (item) =>
        item.phase === "post_processing" && item.result_type === "text_rewrite",
    )) {
      const raw = await this.runAgentLlm(agent, input, content);
      const rewritten = this.parseTextRewrite(raw);
      if (rewritten) content = rewritten;
    }

    for (const agent of selected.filter(
      (item) =>
        !(
          item.phase === "post_processing" &&
          item.result_type === "text_rewrite"
        ),
    )) {
      const raw = await this.runAgentLlm(agent, input, content);
      agentState[agent.slug] = this.tryParseJson(raw) ?? { raw };
    }

    return { content, agentState };
  }

  private agentAllowedForMode(agent: Agent, mode: Chat["mode"]): boolean {
    if (!agent.mode_allowlist?.length) return true;
    return agent.mode_allowlist.includes(mode);
  }

  private async runAgentLlm(
    agent: Agent,
    input: {
      connection: ResolvedConnection;
      historyMessages: ChatMessage[];
      characterName?: string;
      userName?: string;
      chat: Chat;
    },
    assistantResponse: string,
  ): Promise<string> {
    const history = formatChatHistoryMarker(input.historyMessages, {
      charName: input.characterName,
      userName: input.userName,
    });
    const prompt = [
      agent.default_prompt_template,
      "",
      "<chat_history>",
      history,
      "</chat_history>",
      "",
      "<assistant_response>",
      assistantResponse,
      "</assistant_response>",
      "",
      "<current_game_state>",
      JSON.stringify(input.chat.agent_state ?? {}, null, 2),
      "</current_game_state>",
    ].join("\n");

    const result = await completeWithConnection(input.connection, [
      { role: "user", content: prompt },
    ]);
    return result.content || result.reply;
  }

  private parseTextRewrite(raw: string): string | null {
    const json = this.tryParseJson(raw);
    if (
      json &&
      typeof json === "object" &&
      !Array.isArray(json) &&
      (json as { editNeeded?: unknown }).editNeeded === true &&
      typeof (json as { editedText?: unknown }).editedText === "string" &&
      (json as { editedText: string }).editedText.trim()
    ) {
      return (json as { editedText: string }).editedText.trim();
    }
    return null;
  }

  private tryParseJson(raw: string): unknown {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(trimmed.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
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
      messages: row.messages ?? [],
      summary: row.summary ?? "",
      agent_state: row.agent_state ?? {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private toListItem(row: ChatEntity): ChatListItem {
    const messages = row.messages ?? [];
    const settings = defaultChatSettings(row.settings);
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
      character_id: primaryCharacterId(settings),
      character_ids: settings.character_ids,
      preview: last ? activeMessageText(last).slice(0, 160) : null,
    };
  }
}
