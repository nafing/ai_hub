import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconChevronDown,
  IconMessage,
  IconPlayerStop,
  IconSend,
  IconUsers,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  activeMessageText,
  executeSlashCommand,
  activeCharacterIds,
  getSlashCompletions,
  isGroupChat,
  matchSlashCommand,
  normalizeTextForMatch,
  parseGroupedSpeakerSegments,
  parseMentions,
  primaryCharacterId,
  visibleChatMessages,
  visibleChatMessagesThrough,
  type Chat,
  type ChatMessage,
  type GenerateChatInput,
  type SlashCommandAction,
} from "@ai-hub/shared";
import { ActionIcon, Button, Menu, Modal, Textarea, notifications } from "@/components/ui";
import { useApplyRegex } from "@/features/regexes/use-apply-regex";
import { characterAvatarSrc } from "@/features/characters/avatar-url";
import { useCharacters } from "@/features/characters/queries";
import { personaAvatarSrc } from "@/features/personas/avatar-url";
import { usePersonas } from "@/features/personas/queries";
import { api } from "@/lib/api";
import { addChatMessage } from "./api";
import {
  useChatGeneration,
  useChatGenerationStore,
} from "./chatGenerationStore";
import { ChatAgentPanel } from "./ChatAgentPanel";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { PeekPromptModal } from "./PeekPromptModal";
import { useAutonomousMessaging } from "./useAutonomousMessaging";
import {
  chatKeys,
  useDeleteChatMessage,
  useGetOrCreateCharacterDm,
  useUpdateChatMessage,
} from "./queries";
import classes from "./ChatSession.module.css";

type ChatSessionProps = {
  chat: Chat;
  agentsOpen: boolean;
  onAgentsOpenChange: (open: boolean) => void;
};

export function ChatSession({
  chat,
  agentsOpen,
  onAgentsOpenChange,
}: ChatSessionProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateMessage = useUpdateChatMessage();
  const deleteMessage = useDeleteChatMessage();
  const openDmMutation = useGetOrCreateCharacterDm();
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const apiBase = String(api.defaults.baseURL ?? "/v1/api");
  const { applyToText } = useApplyRegex({
    characterId: primaryCharacterId(chat.settings),
  });
  const {
    streaming,
    streamText,
    streamThinking,
    streamSpeaker,
    agentStatus,
    regenHideAfterId,
  } = useChatGeneration(chat.id);
  const generateInBackground = useChatGenerationStore((s) => s.generate);
  const regenerateInBackground = useChatGenerationStore((s) => s.regenerate);
  const stopGeneration = useChatGenerationStore((s) => s.stop);

  const chatCharacters = useMemo(() => {
    const all = charactersQuery.data ?? [];
    return chat.settings.character_ids
      .map((id) => all.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [charactersQuery.data, chat.settings.character_ids]);

  const activeChatCharacters = useMemo(() => {
    const activeIds = new Set(activeCharacterIds(chat.settings));
    return chatCharacters.filter((character) => activeIds.has(character.id));
  }, [chatCharacters, chat.settings]);

  const characterNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const character of charactersQuery.data ?? []) {
      map.set(character.id, character.name || "Character");
    }
    return map;
  }, [charactersQuery.data]);

  const characterAvatarById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const character of charactersQuery.data ?? []) {
      map.set(character.id, characterAvatarSrc(character.avatar, apiBase));
    }
    return map;
  }, [charactersQuery.data, apiBase]);

  const characterColorsById = useMemo(() => {
    const map = new Map<
      string,
      { nameColor: string | null; dialogueColor: string | null }
    >();
    for (const character of charactersQuery.data ?? []) {
      map.set(character.id, {
        nameColor: character.name_color ?? null,
        dialogueColor: character.dialogue_color ?? null,
      });
    }
    return map;
  }, [charactersQuery.data]);

  const personaAvatar = useMemo(() => {
    const list = personasQuery.data ?? [];
    const personaId = chat.settings.persona_id;
    const persona =
      (personaId ? list.find((p) => p.id === personaId) : null) ??
      list.find((p) => p.is_default) ??
      null;
    return personaAvatarSrc(persona?.avatar, apiBase);
  }, [chat.settings.persona_id, personasQuery.data, apiBase]);

  const personaName = useMemo(() => {
    const personaId = chat.settings.persona_id;
    if (personaId) {
      const persona = (personasQuery.data ?? []).find((p) => p.id === personaId);
      if (persona?.name.trim()) return persona.name.trim();
    }
    const defaultPersona = (personasQuery.data ?? []).find((p) => p.is_default);
    return defaultPersona?.name.trim() || "You";
  }, [chat.settings.persona_id, personasQuery.data]);

  const primaryCharName = useMemo(() => {
    const primaryId = primaryCharacterId(chat.settings);
    if (!primaryId) return "Character";
    return characterNameById.get(primaryId) || "Character";
  }, [chat.settings, characterNameById]);

  const macroValues = useMemo(
    () => ({
      char: primaryCharName,
      user: personaName,
    }),
    [primaryCharName, personaName],
  );

  function speakerNameFor(message: ChatMessage): string {
    if (message.role === "user") return personaName;
    if (message.role === "system") return "System";
    if (message.character_id) {
      return characterNameById.get(message.character_id) || "Assistant";
    }
    const primaryId = primaryCharacterId(chat.settings);
    if (primaryId) {
      return characterNameById.get(primaryId) || "Assistant";
    }
    return "Assistant";
  }

  function avatarFor(message: ChatMessage): string | null {
    if (message.role === "user") return personaAvatar;
    if (message.character_id) {
      return characterAvatarById.get(message.character_id) ?? null;
    }
    const primaryId = primaryCharacterId(chat.settings);
    return primaryId ? characterAvatarById.get(primaryId) ?? null : null;
  }

  function colorsForCharacterId(characterId: string | null | undefined): {
    nameColor: string | null;
    dialogueColor: string | null;
  } {
    if (!characterId) {
      const primaryId = primaryCharacterId(chat.settings);
      if (!primaryId) return { nameColor: null, dialogueColor: null };
      return (
        characterColorsById.get(primaryId) ?? {
          nameColor: null,
          dialogueColor: null,
        }
      );
    }
    return (
      characterColorsById.get(characterId) ?? {
        nameColor: null,
        dialogueColor: null,
      }
    );
  }

  const group = isGroupChat(chat.settings);
  const individual = group && chat.settings.group_mode === "individual";
  const mergedGroup = group && chat.settings.group_mode === "merged";
  const manualOrder = individual && chat.settings.response_order === "manual";

  const knownSpeakerNames = useMemo(() => {
    const names = new Set<string>();
    for (const character of chatCharacters) {
      const name = character.name?.trim();
      if (name) names.add(normalizeTextForMatch(name));
    }
    return names;
  }, [chatCharacters]);

  function resolveCharacterIdByName(
    name: string | null | undefined,
  ): string | null {
    if (!name?.trim()) return null;
    const target = normalizeTextForMatch(name);
    for (const character of chatCharacters) {
      if (normalizeTextForMatch(character.name) === target) return character.id;
    }
    return null;
  }

  const [draft, setDraft] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    primaryCharacterId(chat.settings),
  );
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>(
    chat.messages,
  );
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);
  const [commandFilter, setCommandFilter] = useState<string | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [peekMessageId, setPeekMessageId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalMessages(chat.messages);
  }, [chat.messages]);

  useEffect(() => {
    const primary = primaryCharacterId(chat.settings);
    const activeIds = activeCharacterIds(chat.settings);
    if (
      selectedCharacterId &&
      !activeIds.includes(selectedCharacterId)
    ) {
      setSelectedCharacterId(primary);
    } else if (!selectedCharacterId && primary) {
      setSelectedCharacterId(primary);
    }
  }, [chat.settings, selectedCharacterId]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [localMessages, streamText, streamSpeaker]);

  const displayMessages = useMemo(() => {
    const branch = regenHideAfterId
      ? visibleChatMessagesThrough(localMessages, regenHideAfterId)
      : visibleChatMessages(localMessages);
    type DisplayRow = {
      key: string;
      message: ChatMessage;
      displayText: string;
      segmentSpeaker?: string | null;
      showMessageActions?: boolean;
    };
    const rows: DisplayRow[] = [];

    for (let index = 0; index < branch.length; index++) {
      const message = branch[index]!;
      const depth = branch.length - 1 - index;
      const raw = activeMessageText(message);
      const displayText = applyToText(raw, { role: message.role }, depth).text;

      if (
        mergedGroup &&
        message.role === "assistant" &&
        displayText.trim()
      ) {
        const leadingSpeaker = message.character_id
          ? characterNameById.get(message.character_id) ?? null
          : null;
        const segments = parseGroupedSpeakerSegments(
          displayText,
          knownSpeakerNames,
          leadingSpeaker,
        );
        if (segments && segments.length > 0) {
          segments.forEach((segment, segmentIndex) => {
            const segmentText = segment.lines.join("\n").trim();
            if (!segmentText) return;
            rows.push({
              key: `${message.id}:seg:${segmentIndex}`,
              message,
              displayText: segmentText,
              segmentSpeaker: segment.speaker,
              showMessageActions: segmentIndex === segments.length - 1,
            });
          });
          continue;
        }
      }

      rows.push({
        key: message.id,
        message,
        displayText,
        showMessageActions: true,
      });
    }

    return rows;
  }, [
    localMessages,
    applyToText,
    regenHideAfterId,
    mergedGroup,
    knownSpeakerNames,
    characterNameById,
  ]);

  const mentionCharacters = useMemo(() => {
    return activeChatCharacters.map((item) => ({
      id: item.id,
      data: { name: item.name || "" },
    }));
  }, [activeChatCharacters]);

  const characterSelectOptions = useMemo(
    () =>
      activeChatCharacters.map((item) => ({
        value: item.id,
        label: item.name || "Unnamed",
      })),
    [activeChatCharacters],
  );

  const selectedCharacterLabel = useMemo(() => {
    if (!selectedCharacterId) return "Select character";
    return (
      characterSelectOptions.find((option) => option.value === selectedCharacterId)
        ?.label ?? "Select character"
    );
  }, [characterSelectOptions, selectedCharacterId]);

  const selectedCharacterAvatar = selectedCharacterId
    ? characterAvatarById.get(selectedCharacterId) ?? null
    : null;

  const showResponseAsPicker = characterSelectOptions.length > 0;

  const mentionSuggestions = useMemo(() => {
    if (mentionFilter === null) return [];
    const q = mentionFilter.toLowerCase();
    return activeChatCharacters.filter((item) => {
      const name = (item.name || "").toLowerCase();
      return !q || name.includes(q) || name.startsWith(q);
    });
  }, [activeChatCharacters, mentionFilter]);

  const commandSuggestions = useMemo(() => {
    if (commandFilter === null) return [];
    const mode = chat.mode === "conversation" ? "conversation" : "roleplay";
    return getSlashCompletions(`/${commandFilter}`, mode).map((cmd) => ({
      id: cmd.name,
      label: `/${cmd.name}`,
      description: cmd.description,
    }));
  }, [commandFilter, chat.mode]);

  const suggestMode =
    commandFilter !== null
      ? "command"
      : mentionFilter !== null
        ? "mention"
        : null;

  const suggestionCount =
    suggestMode === "command"
      ? commandSuggestions.length
      : suggestMode === "mention"
        ? mentionSuggestions.length
        : 0;

  const showSuggestions =
    suggestOpen && suggestMode !== null && suggestionCount > 0;

  useEffect(() => {
    setSelectedIndex(0);
  }, [commandFilter, mentionFilter, suggestionCount]);

  function closeSuggestions() {
    setSuggestOpen(false);
    setMentionFilter(null);
    setCommandFilter(null);
    setSelectedIndex(0);
  }

  function selectSuggestion(index: number) {
    if (suggestMode === "command") {
      const cmd = commandSuggestions[index];
      if (cmd) updateDraftWithCommand(cmd.id);
      return;
    }
    if (suggestMode === "mention") {
      const character = mentionSuggestions[index];
      if (character?.name) updateDraftWithMention(character.name);
    }
  }

  function draftHasMention(text: string): boolean {
    return parseMentions(text, mentionCharacters).length > 0;
  }

  function canSend(text: string): boolean {
    if (streaming) return false;
    const trimmed = text.trim();
    // Empty composer → impersonate (write as user persona).
    if (!trimmed) return true;
    if (
      matchSlashCommand(
        trimmed,
        chat.mode === "conversation" ? "conversation" : "roleplay",
      )
    ) {
      return true;
    }
    if (!manualOrder) return true;
    if (draftHasMention(trimmed)) return true;
    if (selectedCharacterId) return true;
    return false;
  }

  async function runGenerate(input: GenerateChatInput) {
    const result = await generateInBackground(chat.id, input);
    if (result === "cancelled" && input.userMessage) {
      setDraft(input.userMessage);
    }
  }

  useAutonomousMessaging({
    chat,
    streaming,
    generate: runGenerate,
  });
  async function applySlashActions(actions: SlashCommandAction[]) {
    for (const action of actions) {
      if (action.type === "feedback") {
        notifications.show({
          title: "Slash command",
          message: action.message,
          color: "blue",
          autoClose: action.message.includes("\n") ? 12000 : 6000,
        });
        continue;
      }
      if (action.type === "create_message") {
        const updated = await addChatMessage(chat.id, {
          role: action.role,
          content: action.content,
          ...(action.characterId
            ? { character_id: action.characterId }
            : {}),
        });
        setLocalMessages(updated.messages);
        queryClient.setQueryData(chatKeys.detail(chat.id), updated);
        void queryClient.invalidateQueries({ queryKey: chatKeys.list() });
        continue;
      }
      if (action.type === "generate") {
        await runGenerate({
          ...(action.userMessage ? { userMessage: action.userMessage } : {}),
          ...(action.forCharacterId
            ? { forCharacterId: action.forCharacterId }
            : {}),
          ...(action.generationGuide
            ? { generationGuide: action.generationGuide }
            : {}),
          ...(action.impersonate ? { impersonate: true } : {}),
          ...(action.continueMessageId
            ? { continueMessageId: action.continueMessageId }
            : {}),
        });
      }
    }
  }

  async function handleSend() {
    const text = draft.trim();
    if (!canSend(draft)) return;

    // Empty send = impersonate (same as /impersonate without direction).
    if (!text) {
      setDraft("");
      closeSuggestions();
      await runGenerate({ impersonate: true });
      return;
    }

    const mode = chat.mode === "conversation" ? "conversation" : "roleplay";
    const slashMatched = matchSlashCommand(text, mode);

    setDraft("");
    closeSuggestions();

    if (slashMatched) {
      const lastMessage = localMessages[localMessages.length - 1];
      const latestAssistant = [...localMessages]
        .reverse()
        .find((message) => message.role === "assistant");
      const result = await executeSlashCommand(text, {
        mode,
        characters: activeChatCharacters.map((item) => ({
          id: item.id,
          name: item.name || "Unnamed",
        })),
        requiresManualGuideTarget: manualOrder,
        latestAssistantMessageId: latestAssistant?.id ?? null,
        lastMessageRole: lastMessage?.role ?? null,
      });
      if (result?.handled) {
        try {
          await applySlashActions(result.actions);
        } catch (error) {
          notifications.show({
            title: "Command failed",
            message: error instanceof Error ? error.message : "Unknown error",
            color: "red",
          });
        }
        return;
      }
    }

    let forCharacterId: string | undefined;
    if (manualOrder && selectedCharacterId && !draftHasMention(text)) {
      forCharacterId = selectedCharacterId;
    }

    await runGenerate({
      userMessage: text,
      ...(forCharacterId ? { forCharacterId } : {}),
    });
  }

  async function handleTriggerResponse(characterId?: string) {
    const targetId = characterId ?? selectedCharacterId;
    if (streaming || !targetId) return;

    setSelectedCharacterId(targetId);
    await generateInBackground(chat.id, { forCharacterId: targetId });
  }

  async function handleOpenCharacterDm(characterId: string) {
    if (streaming || openDmMutation.isPending) return;
    try {
      const dm = await openDmMutation.mutateAsync({
        chatId: chat.id,
        characterId,
      });
      await navigate({
        to: "/chats/$chatId",
        params: { chatId: dm.id },
      });
    } catch (error) {
      notifications.show({
        title: "Could not open DM",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  async function handleRegenerate(messageId?: string) {
    if (streaming) return;
    const visible = visibleChatMessages(localMessages);
    const targetId =
      messageId ??
      [...visible]
        .reverse()
        .find((m) => m.role === "assistant" || m.role === "user")?.id;
    if (!targetId) return;
    const target = localMessages.find((m) => m.id === targetId);
    if (!target || (target.role !== "assistant" && target.role !== "user")) {
      return;
    }

    await regenerateInBackground(chat.id, targetId);
  }

  function handleStop() {
    stopGeneration(chat.id);
  }

  function handleSwipe(messageId: string, swipeId: number) {
    setLocalMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? { ...message, swipe_id: swipeId } : message,
      ),
    );
    updateMessage.mutate({
      id: chat.id,
      messageId,
      input: { swipe_id: swipeId },
    });
  }

  function handleEdit(messageId: string, content: string) {
    setLocalMessages((prev) =>
      prev.map((message) => {
        if (message.id !== messageId) return message;
        const swipes = [...message.swipes];
        swipes[message.swipe_id] = content;
        return { ...message, swipes };
      }),
    );
    updateMessage.mutate({
      id: chat.id,
      messageId,
      input: { content },
    });
  }

  function handleReact(messageId: string, emoji: string) {
    setLocalMessages((prev) =>
      prev.map((message) => {
        if (message.id !== messageId) return message;
        return {
          ...message,
          reactions: [
            ...(message.reactions ?? []),
            {
              emoji,
              character_id: null,
              created_at: new Date().toISOString(),
            },
          ],
        };
      }),
    );
    updateMessage.mutate({
      id: chat.id,
      messageId,
      input: { add_reaction: emoji },
    });
  }

  function handleDelete(message: ChatMessage) {
    setDeleteTarget(message);
  }

  function closeDeleteModal() {
    setDeleteTarget(null);
  }

  function handleDeleteActiveSwipe() {
    if (!deleteTarget) return;
    const message = deleteTarget;
    closeDeleteModal();
    updateMessage.mutate(
      {
        id: chat.id,
        messageId: message.id,
        input: { remove_active_swipe: true },
      },
      {
        onSuccess: (next) => {
          setLocalMessages(next.messages);
        },
        onError: (error) => {
          notifications.show({
            title: "Delete failed",
            message:
              error instanceof Error ? error.message : "Unknown error",
            color: "red",
          });
        },
      },
    );
  }

  function handleDeleteEntireMessage() {
    if (!deleteTarget) return;
    const message = deleteTarget;
    closeDeleteModal();
    deleteMessage.mutate(
      { id: chat.id, messageId: message.id },
      {
        onSuccess: (next) => {
          setLocalMessages(next.messages);
        },
        onError: (error) => {
          notifications.show({
            title: "Delete failed",
            message:
              error instanceof Error ? error.message : "Unknown error",
            color: "red",
          });
        },
      },
    );
  }

  function updateDraftWithMention(name: string) {
    const at = draft.lastIndexOf("@");
    if (at < 0) {
      setDraft(`${draft}@${name} `);
    } else {
      setDraft(`${draft.slice(0, at)}@${name} `);
    }
    closeSuggestions();
  }

  function updateDraftWithCommand(commandId: string) {
    const trimmedStart = draft.trimStart();
    const leading = draft.slice(0, draft.length - trimmedStart.length);
    const match = trimmedStart.match(/^\/[^\s]*/);
    const rest = match
      ? trimmedStart.slice(match[0].length).replace(/^\s*/, "")
      : trimmedStart.replace(/^\//, "");
    setDraft(`${leading}/${commandId}${rest ? ` ${rest}` : " "}`);
    closeSuggestions();
  }

  function onDraftChange(value: string) {
    setDraft(value);

    const trimmedStart = value.trimStart();
    const slashMatch = trimmedStart.match(/^\/([^\s]*)$/);
    if (slashMatch) {
      setCommandFilter(slashMatch[1] ?? "");
      setMentionFilter(null);
      setSuggestOpen(true);
      return;
    }

    const at = value.lastIndexOf("@");
    if (at >= 0 && group) {
      const after = value.slice(at + 1);
      if (!/\s/.test(after)) {
        setMentionFilter(after);
        setCommandFilter(null);
        setSuggestOpen(true);
        return;
      }
    }

    setMentionFilter(null);
    setCommandFilter(null);
    setSuggestOpen(false);
    setSelectedIndex(0);
  }

  const streamingCharacterId =
    streamSpeaker?.character_id ?? primaryCharacterId(chat.settings);
  const streamingSpeakerName =
    streamSpeaker?.character_name ||
    speakerNameFor({
      id: "streaming",
      role: "assistant",
      swipes: [streamText],
      swipe_id: 0,
      character_id: streamingCharacterId,
      parent_id: null,
      parent_swipe_id: null,
      created_at: new Date().toISOString(),
    });

  const deleteSwipeCount = deleteTarget?.swipes.length ?? 0;
  const deleteHasMultipleSwipes = deleteSwipeCount > 1;

  return (
    <div className={classes.root}>
      <div ref={viewportRef} className={classes.messages}>
        <div className={classes.messageList}>
          {displayMessages.map(
            ({
              key,
              message,
              displayText,
              segmentSpeaker,
              showMessageActions = true,
            }) => {
              const segmentCharacterId = resolveCharacterIdByName(segmentSpeaker);
              const resolvedSpeakerName = segmentSpeaker
                ? segmentSpeaker
                : speakerNameFor(message);
              const resolvedAvatar = segmentCharacterId
                ? characterAvatarById.get(segmentCharacterId) ?? null
                : avatarFor(message);
              const colorSourceId =
                message.role === "user"
                  ? null
                  : (segmentCharacterId ?? message.character_id);
              const colors =
                message.role === "assistant"
                  ? colorsForCharacterId(colorSourceId)
                  : { nameColor: null, dialogueColor: null };

              return (
                <ChatMessageBubble
                  key={key}
                  message={message}
                  displayText={displayText}
                  speakerName={resolvedSpeakerName}
                  nameColor={colors.nameColor}
                  dialogueColor={colors.dialogueColor}
                  avatarUrl={resolvedAvatar}
                  macroValues={macroValues}
                  disabled={streaming}
                  onSwipe={
                    showMessageActions &&
                    (message.role === "assistant" || message.role === "user")
                      ? (swipeId) => handleSwipe(message.id, swipeId)
                      : undefined
                  }
                  onEdit={
                    showMessageActions
                      ? (content) => handleEdit(message.id, content)
                      : undefined
                  }
                  onRegenerate={
                    showMessageActions &&
                    (message.role === "assistant" || message.role === "user")
                      ? () => void handleRegenerate(message.id)
                      : undefined
                  }
                  onPeekPrompt={
                    showMessageActions
                      ? () => setPeekMessageId(message.id)
                      : undefined
                  }
                  onDelete={
                    showMessageActions ? () => handleDelete(message) : undefined
                  }
                  onReact={
                    showMessageActions &&
                    (message.role === "assistant" || message.role === "user")
                      ? (emoji) => handleReact(message.id, emoji)
                      : undefined
                  }
                />
              );
            },
          )}

          {streaming && (streamText || streamThinking) ? (
            <ChatMessageBubble
              message={{
                id: "streaming",
                role: "assistant",
                swipes: [streamText],
                swipe_id: 0,
                thinking: streamThinking || null,
                character_id: streamingCharacterId,
                parent_id: null,
                parent_swipe_id: null,
                created_at: new Date().toISOString(),
              }}
              displayText={streamText}
              speakerName={streamingSpeakerName}
              nameColor={colorsForCharacterId(streamingCharacterId).nameColor}
              dialogueColor={
                colorsForCharacterId(streamingCharacterId).dialogueColor
              }
              avatarUrl={
                streamingCharacterId
                  ? characterAvatarById.get(streamingCharacterId) ?? null
                  : null
              }
              macroValues={macroValues}
              isStreaming
            />
          ) : null}

          {streaming && !streamText && !streamThinking ? (
            <div className={classes.streamingStatus}>
              <span className={classes.spinner} aria-hidden />
              {streamSpeaker ? (
                <span className={classes.streamingLabel}>
                  {streamSpeaker.character_name}…
                </span>
              ) : agentStatus ? (
                <span className={classes.streamingLabel}>
                  {agentStatus.name}…
                </span>
              ) : null}
            </div>
          ) : null}

          {!displayMessages.length && !streaming ? (
            <p className={classes.emptyHint}>Send a message to start.</p>
          ) : null}
        </div>
      </div>

      <ChatAgentPanel
        chat={chat}
        opened={agentsOpen}
        onClose={() => onAgentsOpenChange(false)}
        disabled={streaming}
        agentStatus={agentStatus}
        onSendChoice={(text) => {
          void runGenerate({ userMessage: text });
        }}
        onRunDirector={() => {
          onAgentsOpenChange(false);
          void runGenerate({ runDirector: true });
        }}
      />

      <PeekPromptModal
        opened={Boolean(peekMessageId)}
        onClose={() => setPeekMessageId(null)}
        chatId={chat.id}
        messageId={peekMessageId ?? ""}
      />

      <Modal
        opened={Boolean(deleteTarget)}
        onClose={closeDeleteModal}
        title="Delete"
        size="sm"
      >
        <div className={classes.deleteStack}>
          <p className={classes.deleteHint}>
            {deleteHasMultipleSwipes
              ? `This message has ${deleteSwipeCount} swipes. Choose what to remove.`
              : "Remove this message from the chat."}
          </p>
          <div className={classes.deleteActions}>
            {deleteHasMultipleSwipes && deleteTarget ? (
              <Button variant="danger" type="button"
                onClick={handleDeleteActiveSwipe}>
                Delete active swipe ({deleteTarget.swipe_id + 1}/{deleteSwipeCount})
              </Button>
            ) : null}
            <Button variant="dangerSolid" type="button"
              onClick={handleDeleteEntireMessage}>
              {deleteHasMultipleSwipes
                ? "Delete entire message (all swipes)"
                : "Delete message"}
            </Button>
            <Button variant="default" type="button"
              onClick={closeDeleteModal}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <div className={classes.composerWrap}>
        {showResponseAsPicker ? (
          <div className={classes.composerToolbar}>
            <Menu>
              <Menu.Target>
                <Button
                  type="button"
                  variant="subtle"
                  size="sm"
                  className={classes.responseAsButton}
                  disabled={streaming}
                  leftSection={
                    <span className={classes.responseAsAvatar}>
                      {selectedCharacterAvatar ? (
                        <img src={selectedCharacterAvatar} alt="" />
                      ) : (
                        selectedCharacterLabel.slice(0, 1).toUpperCase()
                      )}
                    </span>
                  }
                  rightSection={<IconChevronDown size={14} aria-hidden />}
                >
                  <span className={classes.responseAsText}>
                    <span className={classes.responseAsLabel}>Response as</span>
                    <span className={classes.responseAsName}>
                      {selectedCharacterLabel}
                    </span>
                  </span>
                </Button>
              </Menu.Target>
              <Menu.Dropdown className={classes.menuDropdownAbove}>
                <Menu.Label>Response as</Menu.Label>
                {characterSelectOptions.map((option) => {
                  const avatarUrl = characterAvatarById.get(option.value) || null;
                  const isSelected = option.value === selectedCharacterId;
                  return (
                    <Menu.Item
                      key={option.value}
                      className={streaming ? classes.menuItemDisabled : undefined}
                      aria-selected={isSelected}
                      leftSection={
                        <span className={classes.menuAvatar}>
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="" />
                          ) : (
                            option.label.slice(0, 1).toUpperCase()
                          )}
                        </span>
                      }
                      onClick={() => {
                        if (streaming) return;
                        setSelectedCharacterId(option.value);
                      }}
                    >
                      {option.label}
                    </Menu.Item>
                  );
                })}
              </Menu.Dropdown>
            </Menu>
          </div>
        ) : null}
        <div className={classes.composerBar} data-glass-surface>
          <div className={classes.composerInputWrap}>
            {showSuggestions ? (
              <ul
                className={classes.suggestDropdown}
                role="listbox"
                aria-label={
                  suggestMode === "command"
                    ? "Slash commands"
                    : "Character mentions"
                }
              >
                {suggestMode === "command"
                  ? commandSuggestions.map((cmd, index) => (
                      <li key={cmd.id} role="presentation">
                        <Button
                          type="button"
                          role="option"
                          aria-selected={index === selectedIndex}
                          variant="ghost"
                          className={[
                            classes.suggestOption,
                            index === selectedIndex
                              ? classes.suggestOptionSelected
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => updateDraftWithCommand(cmd.id)}
                        >
                          <span className={classes.suggestOptionCommand}>
                            <span className={classes.suggestCommandLabel}>
                              {cmd.label}
                            </span>
                            <span className={classes.suggestCommandDesc}>
                              {cmd.description}
                            </span>
                          </span>
                        </Button>
                      </li>
                    ))
                  : mentionSuggestions.map((item, index) => (
                      <li key={item.id} role="presentation">
                        <Button
                          type="button"
                          role="option"
                          aria-selected={index === selectedIndex}
                          variant="ghost"
                          className={[
                            classes.suggestOption,
                            index === selectedIndex
                              ? classes.suggestOptionSelected
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() =>
                            updateDraftWithMention(item.name || "Unnamed")
                          }
                        >
                          @{item.name || "Unnamed"}
                        </Button>
                      </li>
                    ))}
              </ul>
            ) : null}

            <Textarea
              className={classes.composerInput}
              placeholder="Write your response, / for commands"
              value={draft}
              disabled={streaming}
              onChange={(event) => onDraftChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (showSuggestions) {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSelectedIndex((index) =>
                      Math.min(index + 1, suggestionCount - 1),
                    );
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSelectedIndex((index) => Math.max(index - 1, 0));
                    return;
                  }
                  if (event.key === "Enter" && suggestionCount > 0) {
                    event.preventDefault();
                    selectSuggestion(selectedIndex);
                    return;
                  }
                  if (event.key === "Escape") {
                    closeSuggestions();
                    return;
                  }
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
            />
          </div>

          {chat.settings.allow_character_dms &&
          characterSelectOptions.length > 0 ? (
            <Menu>
              <Menu.Target>
                <ActionIcon
                  type="button"
                  variant="ghost"
                  aria-label="Open character DM"
                  title="Open character DM"
                  disabled={streaming || openDmMutation.isPending}
                >
                  <IconMessage size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown className={classes.menuDropdownAbove}>
                <Menu.Label>Character DMs</Menu.Label>
                {characterSelectOptions.map((option) => {
                  const avatarUrl =
                    characterAvatarById.get(option.value) || null;
                  return (
                    <Menu.Item
                      key={option.value}
                      className={
                        streaming || openDmMutation.isPending
                          ? classes.menuItemDisabled
                          : undefined
                      }
                      leftSection={
                        <span className={classes.menuAvatar}>
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="" />
                          ) : (
                            option.label.slice(0, 1).toUpperCase()
                          )}
                        </span>
                      }
                      onClick={() => {
                        if (streaming || openDmMutation.isPending) return;
                        void handleOpenCharacterDm(option.value);
                      }}
                    >
                      {option.label}
                    </Menu.Item>
                  );
                })}
              </Menu.Dropdown>
            </Menu>
          ) : null}

          {group ? (
            <Menu>
              <Menu.Target>
                <ActionIcon type="button" variant="ghost" aria-label="Trigger character" title="Trigger character" disabled={streaming}>
                  <IconUsers size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown className={classes.menuDropdownAbove}>
                <Menu.Label>Trigger character</Menu.Label>
                {characterSelectOptions.map((option) => {
                  const avatarUrl =
                    characterAvatarById.get(option.value) || null;
                  return (
                    <Menu.Item
                      key={option.value}
                      className={streaming ? classes.menuItemDisabled : undefined}
                      leftSection={
                        <span className={classes.menuAvatar}>
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="" />
                          ) : (
                            option.label.slice(0, 1).toUpperCase()
                          )}
                        </span>
                      }
                      onClick={() => {
                        if (streaming) return;
                        void handleTriggerResponse(option.value);
                      }}
                    >
                      {option.label}
                    </Menu.Item>
                  );
                })}
              </Menu.Dropdown>
            </Menu>
          ) : null}

          {streaming ? (
            <ActionIcon type="button" variant="ghostDanger" aria-label="Stop" title="Stop" onClick={handleStop}>
              <IconPlayerStop size={16} />
            </ActionIcon>
          ) : (
            <ActionIcon
              type="button"
              variant="ghost"
              aria-label={draft.trim() ? "Send" : "Impersonate"}
              title={
                draft.trim()
                  ? "Send"
                  : "Impersonate (empty send writes as your persona)"
              }
              disabled={!canSend(draft)}
              onClick={() => void handleSend()}
            >
              <IconSend size={16} />
            </ActionIcon>
          )}
        </div>
      </div>
    </div>
  );
}
