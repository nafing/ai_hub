import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Center,
  Combobox,
  Group,
  Loader,
  Menu,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Tooltip,
  useCombobox,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconPlayerStop,
  IconSend,
  IconUsers,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  activeMessageText,
  executeSlashCommand,
  getSlashCompletions,
  isGroupChat,
  matchSlashCommand,
  parseMentions,
  primaryCharacterId,
  type Chat,
  type ChatMessage,
  type ChatStreamEvent,
  type GenerateChatInput,
  type SlashCommandAction,
} from "@ai-hub/shared";
import { useApplyRegex } from "@/features/regexes/use-apply-regex";
import { characterAvatarSrc } from "@/features/characters/avatar-url";
import { useCharacters } from "@/features/characters/queries";
import { personaAvatarSrc } from "@/features/personas/avatar-url";
import { usePersonas } from "@/features/personas/queries";
import { api } from "@/lib/api";
import { addChatMessage, streamGenerate, streamRegenerate } from "./api";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { PeekPromptModal } from "./PeekPromptModal";
import {
  chatKeys,
  useDeleteChatMessage,
  useUpdateChatMessage,
} from "./queries";

type ChatSessionProps = {
  chat: Chat;
};

type StreamSpeaker = {
  character_id: string | null;
  character_name: string;
};

export function ChatSession({ chat }: ChatSessionProps) {
  const queryClient = useQueryClient();
  const updateMessage = useUpdateChatMessage();
  const deleteMessage = useDeleteChatMessage();
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const apiBase = String(api.defaults.baseURL ?? "/v1/api");
  const { applyToText } = useApplyRegex({
    characterId: primaryCharacterId(chat.settings),
  });

  const chatCharacters = useMemo(() => {
    const all = charactersQuery.data ?? [];
    return chat.settings.character_ids
      .map((id) => all.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [charactersQuery.data, chat.settings.character_ids]);

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

  const group = isGroupChat(chat.settings);
  const individual = group && chat.settings.group_mode === "individual";
  const manualOrder = individual && chat.settings.response_order === "manual";

  const [draft, setDraft] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    primaryCharacterId(chat.settings),
  );
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamThinking, setStreamThinking] = useState("");
  const [streamSpeaker, setStreamSpeaker] = useState<StreamSpeaker | null>(
    null,
  );
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>(
    chat.messages,
  );
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);
  const [commandFilter, setCommandFilter] = useState<string | null>(null);
  const [peekMessageId, setPeekMessageId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const suggestCombobox = useCombobox();

  useEffect(() => {
    if (!streaming) setLocalMessages(chat.messages);
  }, [chat.messages, streaming]);

  useEffect(() => {
    const primary = primaryCharacterId(chat.settings);
    if (
      selectedCharacterId &&
      !chat.settings.character_ids.includes(selectedCharacterId)
    ) {
      setSelectedCharacterId(primary);
    } else if (!selectedCharacterId && primary) {
      setSelectedCharacterId(primary);
    }
  }, [chat.settings.character_ids, selectedCharacterId, chat.settings]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [localMessages, streamText, streamSpeaker]);

  const displayMessages = useMemo(() => {
    return localMessages.map((message, index, arr) => {
      const depth = arr.length - 1 - index;
      const raw = activeMessageText(message);
      const displayText = applyToText(raw, { role: message.role }, depth).text;
      return { message, displayText };
    });
  }, [localMessages, applyToText]);

  const mentionCharacters = useMemo(() => {
    // Lightweight stand-ins for parseMentions (needs data.name)
    return chatCharacters.map((item) => ({
      id: item.id,
      data: { name: item.name || "" },
    }));
  }, [chatCharacters]);

  const characterSelectOptions = useMemo(
    () =>
      chatCharacters.map((item) => ({
        value: item.id,
        label: item.name || "Unnamed",
      })),
    [chatCharacters],
  );

  const mentionSuggestions = useMemo(() => {
    if (mentionFilter === null) return [];
    const q = mentionFilter.toLowerCase();
    return chatCharacters.filter((item) => {
      const name = (item.name || "").toLowerCase();
      return !q || name.includes(q) || name.startsWith(q);
    });
  }, [chatCharacters, mentionFilter]);

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

  function applyStreamEvent(event: ChatStreamEvent) {
    if (event.type === "user_message") {
      setLocalMessages((prev) => [...prev, event.message]);
      return;
    }
    if (event.type === "turn_start") {
      setStreamText("");
      setStreamThinking("");
      setStreamSpeaker({
        character_id: event.character_id,
        character_name: event.character_name,
      });
      return;
    }
    if (event.type === "delta") {
      setStreamText((prev) => prev + event.delta);
      return;
    }
    if (event.type === "thinking") {
      setStreamThinking((prev) => prev + event.delta);
      return;
    }
    if (event.type === "error") {
      notifications.show({
        title: "Generation failed",
        message: event.message,
        color: "red",
      });
      return;
    }
    if (event.type === "done") {
      setLocalMessages(event.chat.messages);
      queryClient.setQueryData(chatKeys.detail(chat.id), event.chat);
      void queryClient.invalidateQueries({ queryKey: chatKeys.list() });
      setStreamText("");
      setStreamThinking("");
      setStreamSpeaker(null);
    }
  }

  function draftHasMention(text: string): boolean {
    return parseMentions(text, mentionCharacters).length > 0;
  }

  function canSend(text: string): boolean {
    if (!text.trim() || streaming) return false;
    if (matchSlashCommand(text.trim(), chat.mode === "conversation" ? "conversation" : "roleplay")) {
      return true;
    }
    if (!manualOrder) return true;
    if (draftHasMention(text)) return true;
    if (selectedCharacterId) return true;
    return false;
  }

  async function runGenerate(input: GenerateChatInput) {
    setStreaming(true);
    setStreamText("");
    setStreamThinking("");
    setStreamSpeaker(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamGenerate(chat.id, input, applyStreamEvent, controller.signal);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        notifications.show({
          title: "Send failed",
          message: error instanceof Error ? error.message : "Unknown error",
          color: "red",
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      setStreamText("");
      setStreamThinking("");
      setStreamSpeaker(null);
    }
  }

  async function applySlashActions(actions: SlashCommandAction[]) {
    for (const action of actions) {
      if (action.type === "feedback") {
        notifications.show({
          title: "Slash command",
          message: action.message,
          color: "blue",
          autoClose: action.message.includes("\n") ? 12000 : 6000,
          styles: {
            description: { whiteSpace: "pre-wrap" },
          },
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
    if (!canSend(text)) return;

    const mode = chat.mode === "conversation" ? "conversation" : "roleplay";
    const slashMatched = matchSlashCommand(text, mode);

    setDraft("");
    setMentionFilter(null);
    setCommandFilter(null);
    suggestCombobox.closeDropdown();

    if (slashMatched) {
      const lastMessage = localMessages[localMessages.length - 1];
      const latestAssistant = [...localMessages]
        .reverse()
        .find((message) => message.role === "assistant");
      const result = await executeSlashCommand(text, {
        mode,
        characters: chatCharacters.map((item) => ({
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
    setStreaming(true);
    setStreamText("");
    setStreamThinking("");
    setStreamSpeaker(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamGenerate(
        chat.id,
        { forCharacterId: targetId },
        applyStreamEvent,
        controller.signal,
      );
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        notifications.show({
          title: "Trigger failed",
          message: error instanceof Error ? error.message : "Unknown error",
          color: "red",
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      setStreamText("");
      setStreamThinking("");
      setStreamSpeaker(null);
    }
  }

  async function handleRegenerate(messageId?: string) {
    if (streaming) return;
    if (messageId) {
      const target = localMessages.find((m) => m.id === messageId);
      if (!target || (target.role !== "assistant" && target.role !== "user")) {
        return;
      }
    } else if (!localMessages.some((m) => m.role === "assistant" || m.role === "user")) {
      return;
    }

    setStreaming(true);
    setStreamText("");
    setStreamThinking("");
    setStreamSpeaker(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamRegenerate(
        chat.id,
        applyStreamEvent,
        controller.signal,
        messageId,
      );
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        notifications.show({
          title: "Regenerate failed",
          message: error instanceof Error ? error.message : "Unknown error",
          color: "red",
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      setStreamText("");
      setStreamThinking("");
      setStreamSpeaker(null);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
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

  function handleDelete(message: ChatMessage) {
    const swipeCount = message.swipes.length;
    const hasMultipleSwipes = swipeCount > 1;

    modals.open({
      title: "Delete",
      children: (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {hasMultipleSwipes
              ? `This message has ${swipeCount} swipes. Choose what to remove.`
              : "Remove this message from the chat."}
          </Text>
          <Stack gap="xs">
            {hasMultipleSwipes ? (
              <Button
                variant="light"
                color="red"
                onClick={() => {
                  modals.closeAll();
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
                            error instanceof Error
                              ? error.message
                              : "Unknown error",
                          color: "red",
                        });
                      },
                    },
                  );
                }}
              >
                Delete active swipe ({message.swipe_id + 1}/{swipeCount})
              </Button>
            ) : null}
            <Button
              color="red"
              onClick={() => {
                modals.closeAll();
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
                          error instanceof Error
                            ? error.message
                            : "Unknown error",
                        color: "red",
                      });
                    },
                  },
                );
              }}
            >
              {hasMultipleSwipes
                ? "Delete entire message (all swipes)"
                : "Delete message"}
            </Button>
            <Button variant="default" onClick={() => modals.closeAll()}>
              Cancel
            </Button>
          </Stack>
        </Stack>
      ),
    });
  }

  function updateDraftWithMention(name: string) {
    const at = draft.lastIndexOf("@");
    if (at < 0) {
      setDraft(`${draft}@${name} `);
    } else {
      setDraft(`${draft.slice(0, at)}@${name} `);
    }
    setMentionFilter(null);
    setCommandFilter(null);
    suggestCombobox.closeDropdown();
  }

  function updateDraftWithCommand(commandId: string) {
    const trimmedStart = draft.trimStart();
    const leading = draft.slice(0, draft.length - trimmedStart.length);
    const match = trimmedStart.match(/^\/[^\s]*/);
    const rest = match
      ? trimmedStart.slice(match[0].length).replace(/^\s*/, "")
      : trimmedStart.replace(/^\//, "");
    setDraft(`${leading}/${commandId}${rest ? ` ${rest}` : " "}`);
    setMentionFilter(null);
    setCommandFilter(null);
    suggestCombobox.closeDropdown();
  }

  function onDraftChange(value: string) {
    setDraft(value);

    const trimmedStart = value.trimStart();
    const slashMatch = trimmedStart.match(/^\/([^\s]*)$/);
    if (slashMatch) {
      setCommandFilter(slashMatch[1] ?? "");
      setMentionFilter(null);
      suggestCombobox.openDropdown();
      return;
    }

    const at = value.lastIndexOf("@");
    if (at >= 0 && group) {
      const after = value.slice(at + 1);
      if (!/\s/.test(after)) {
        setMentionFilter(after);
        setCommandFilter(null);
        suggestCombobox.openDropdown();
        return;
      }
    }

    setMentionFilter(null);
    setCommandFilter(null);
    suggestCombobox.closeDropdown();
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
      created_at: new Date().toISOString(),
    });

  return (
    <Stack h="100%" gap={0}>
      <ScrollArea style={{ flex: 1 }} viewportRef={viewportRef} p="md">
        <Stack gap="sm">
          {displayMessages.map(({ message, displayText }) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              displayText={displayText}
              speakerName={speakerNameFor(message)}
              avatarUrl={avatarFor(message)}
              disabled={streaming}
              onSwipe={
                message.role === "assistant" || message.role === "user"
                  ? (swipeId) => handleSwipe(message.id, swipeId)
                  : undefined
              }
              onEdit={(content) => handleEdit(message.id, content)}
              onRegenerate={
                message.role === "assistant" || message.role === "user"
                  ? () => void handleRegenerate(message.id)
                  : undefined
              }
              onPeekPrompt={() => setPeekMessageId(message.id)}
              onDelete={() => handleDelete(message)}
            />
          ))}

          {streaming && (streamText || streamThinking) ? (
            <ChatMessageBubble
              message={{
                id: "streaming",
                role: "assistant",
                swipes: [streamText],
                swipe_id: 0,
                thinking: streamThinking || null,
                character_id: streamingCharacterId,
                created_at: new Date().toISOString(),
              }}
              displayText={streamText}
              speakerName={streamingSpeakerName}
              avatarUrl={
                streamingCharacterId
                  ? characterAvatarById.get(streamingCharacterId) ?? null
                  : null
              }
              isStreaming
            />
          ) : null}

          {streaming && !streamText && !streamThinking ? (
            <Center py="md">
              <Loader size="sm" />
              {streamSpeaker ? (
                <Text size="sm" c="dimmed" ml="sm">
                  {streamSpeaker.character_name}…
                </Text>
              ) : null}
            </Center>
          ) : null}

          {!displayMessages.length && !streaming ? (
            <Text c="dimmed" size="sm" ta="center" py="xl">
              Send a message to start.
            </Text>
          ) : null}
        </Stack>
      </ScrollArea>

      <PeekPromptModal
        opened={Boolean(peekMessageId)}
        onClose={() => setPeekMessageId(null)}
        chatId={chat.id}
        messageId={peekMessageId ?? ""}
      />

      <Box px="md" pb="md" pt="sm">
        <Combobox
          store={suggestCombobox}
          onOptionSubmit={(value) => {
            if (suggestMode === "command") {
              updateDraftWithCommand(value);
              return;
            }
            const character = chatCharacters.find((c) => c.id === value);
            if (character?.name) updateDraftWithMention(character.name);
          }}
        >
          <Combobox.Target>
            <Group
              gap={6}
              wrap="nowrap"
              px={10}
              py={6}
              style={{
                borderRadius: 999,
                border:
                  "1px solid var(--mantine-color-dark-4, var(--mantine-color-default-border))",
                background:
                  "var(--mantine-color-dark-7, var(--mantine-color-body))",
                alignItems: "center",
              }}
            >
              <Textarea
                flex={1}
                variant="unstyled"
                size="sm"
                placeholder="Write your response, / for commands"
                autosize
                minRows={1}
                maxRows={6}
                value={draft}
                disabled={streaming}
                styles={{
                  input: {
                    paddingTop: 4,
                    paddingBottom: 4,
                    paddingLeft: 4,
                    paddingRight: 4,
                    minHeight: 28,
                    lineHeight: 1.4,
                  },
                }}
                onChange={(event) => onDraftChange(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (suggestCombobox.dropdownOpened) {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      suggestCombobox.selectNextOption();
                      return;
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      suggestCombobox.selectPreviousOption();
                      return;
                    }
                    const hasOptions =
                      suggestMode === "command"
                        ? commandSuggestions.length > 0
                        : mentionSuggestions.length > 0;
                    if (event.key === "Enter" && hasOptions) {
                      event.preventDefault();
                      suggestCombobox.clickSelectedOption();
                      return;
                    }
                    if (event.key === "Escape") {
                      suggestCombobox.closeDropdown();
                      setMentionFilter(null);
                      setCommandFilter(null);
                      return;
                    }
                  }
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />

              {group ? (
                <Menu shadow="md" width={220} position="top-end">
                  <Menu.Target>
                    <Tooltip label="Trigger character">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        radius="xl"
                        aria-label="Trigger character"
                        disabled={streaming}
                      >
                        <IconUsers size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Trigger character</Menu.Label>
                    {characterSelectOptions.map((option) => (
                      <Menu.Item
                        key={option.value}
                        leftSection={
                          <Avatar
                            src={
                              characterAvatarById.get(option.value) || undefined
                            }
                            size={20}
                            radius="xl"
                          >
                            {option.label.slice(0, 1).toUpperCase()}
                          </Avatar>
                        }
                        disabled={streaming}
                        onClick={() => {
                          void handleTriggerResponse(option.value);
                        }}
                      >
                        {option.label}
                      </Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>
              ) : null}

              {streaming ? (
                <Tooltip label="Stop">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    radius="xl"
                    aria-label="Stop"
                    onClick={handleStop}
                  >
                    <IconPlayerStop size={16} />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <Tooltip label="Send">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    radius="xl"
                    aria-label="Send"
                    disabled={!canSend(draft)}
                    onClick={() => void handleSend()}
                  >
                    <IconSend size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Combobox.Target>
          <Combobox.Dropdown
            hidden={
              suggestMode === null ||
              (suggestMode === "command"
                ? commandSuggestions.length === 0
                : mentionSuggestions.length === 0)
            }
          >
            <Combobox.Options>
              {suggestMode === "command"
                ? commandSuggestions.map((cmd) => (
                    <Combobox.Option value={cmd.id} key={cmd.id}>
                      <Stack gap={0}>
                        <Text size="sm" fw={600}>
                          {cmd.label}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {cmd.description}
                        </Text>
                      </Stack>
                    </Combobox.Option>
                  ))
                : mentionSuggestions.map((item) => (
                    <Combobox.Option value={item.id} key={item.id}>
                      @{item.name || "Unnamed"}
                    </Combobox.Option>
                  ))}
            </Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>
      </Box>
    </Stack>
  );
}
