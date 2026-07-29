import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  IconBraces,
  IconMessage,
  IconPaperclip,
  IconPlayerStop,
  IconSend,
  IconUsers,
  IconX,
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
  type ChatMessageAttachment,
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
import { addChatMessage, uploadChatAttachment } from "./api";
import {
  useChatGeneration,
  useChatGenerationStore,
} from "./chatGenerationStore";
import { ChatAgentPanel } from "./ChatAgentPanel";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { PeekPromptModal } from "./PeekPromptModal";
import { useAutonomousMessaging } from "../conversation/useAutonomousMessaging";
import {
  chatKeys,
  useDeleteChatMessage,
  useGenerateChatImage,
  useGetOrCreateCharacterDm,
  useUpdateChatMessage,
} from "./queries";
import classes from "./ChatSession.module.css";

const CHAT_INSERT_MACROS: Array<{ syntax: string; label: string }> = [
  { syntax: "{{user}}", label: "Persona name" },
  { syntax: "{{char}}", label: "Primary character" },
  { syntax: "{{characters}}", label: "All characters" },
  { syntax: "{{group}}", label: "Other cast (excl. char)" },
  { syntax: "{{user_appearance}}", label: "Persona appearance" },
  { syntax: "{{char_appearance}}", label: "Character appearance" },
];

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
  const generateImageMutation = useGenerateChatImage();
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
      {
        nameColor: string | null;
        dialogueColor: string | null;
        messageBoxColor: string | null;
      }
    >();
    for (const character of charactersQuery.data ?? []) {
      map.set(character.id, {
        nameColor: character.name_color ?? null,
        dialogueColor: character.dialogue_color ?? null,
        messageBoxColor: character.message_box_color ?? null,
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
    messageBoxColor: string | null;
  } {
    if (!characterId) {
      const primaryId = primaryCharacterId(chat.settings);
      if (!primaryId) {
        return {
          nameColor: null,
          dialogueColor: null,
          messageBoxColor: null,
        };
      }
      return (
        characterColorsById.get(primaryId) ?? {
          nameColor: null,
          dialogueColor: null,
          messageBoxColor: null,
        }
      );
    }
    return (
      characterColorsById.get(characterId) ?? {
        nameColor: null,
        dialogueColor: null,
        messageBoxColor: null,
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
  const [pendingAttachments, setPendingAttachments] = useState<
    Array<{
      localId: string;
      file: File;
      previewUrl: string | null;
    }>
  >([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
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
    return () => {
      for (const item of pendingAttachments) {
        if (item.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
    };
    // Only revoke on unmount; chip removal handles live cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function revokePendingPreview(previewUrl: string | null) {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }

  function clearPendingAttachments() {
    setPendingAttachments((prev) => {
      for (const item of prev) revokePendingPreview(item.previewUrl);
      return [];
    });
  }

  function removePendingAttachment(localId: string) {
    setPendingAttachments((prev) => {
      const next = [];
      for (const item of prev) {
        if (item.localId === localId) {
          revokePendingPreview(item.previewUrl);
          continue;
        }
        next.push(item);
      }
      return next;
    });
  }

  function handlePickAttachments(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next = Array.from(fileList).slice(0, 8).map((file) => ({
      localId: crypto.randomUUID(),
      file,
      previewUrl: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
    }));
    setPendingAttachments((prev) => [...prev, ...next].slice(0, 8));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function canSend(text: string): boolean {
    if (streaming || uploadingAttachments) return false;
    const trimmed = text.trim();
    const hasAttachments = pendingAttachments.length > 0;
    // Empty composer without attachments → impersonate (write as user persona).
    if (!trimmed && !hasAttachments) return true;
    if (
      trimmed &&
      matchSlashCommand(
        trimmed,
        chat.mode === "conversation" ? "conversation" : "roleplay",
      )
    ) {
      return true;
    }
    if (!manualOrder) return true;
    if (trimmed && draftHasMention(trimmed)) return true;
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
    const pending = pendingAttachments;
    if (!canSend(draft)) return;

    // Empty send without attachments = impersonate (same as /impersonate).
    if (!text && pending.length === 0) {
      setDraft("");
      closeSuggestions();
      await runGenerate({ impersonate: true });
      return;
    }

    const mode = chat.mode === "conversation" ? "conversation" : "roleplay";
    const slashMatched = text ? matchSlashCommand(text, mode) : null;

    if (slashMatched && pending.length > 0) {
      notifications.show({
        title: "Attachments ignored",
        message: "Slash commands cannot include file attachments.",
        color: "yellow",
      });
    }

    setDraft("");
    closeSuggestions();

    if (slashMatched) {
      clearPendingAttachments();
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

    let attachments: ChatMessageAttachment[] = [];
    if (pending.length > 0) {
      setUploadingAttachments(true);
      try {
        attachments = [];
        for (const item of pending) {
          attachments.push(await uploadChatAttachment(chat.id, item.file));
        }
        clearPendingAttachments();
      } catch (error) {
        setDraft(text);
        notifications.show({
          title: "Upload failed",
          message: error instanceof Error ? error.message : "Unknown error",
          color: "red",
        });
        return;
      } finally {
        setUploadingAttachments(false);
      }
    }

    let forCharacterId: string | undefined;
    if (manualOrder && selectedCharacterId && !draftHasMention(text)) {
      forCharacterId = selectedCharacterId;
    }

    await runGenerate({
      ...(text ? { userMessage: text } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
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

  function handleGenerateImage(messageId: string) {
    if (streaming || generateImageMutation.isPending) return;
    generateImageMutation.mutate(
      { id: chat.id, input: { messageId } },
      {
        onSuccess: () => {
          notifications.show({
            title: "Image generated",
            message: "Attached to the message.",
            color: "green",
          });
        },
        onError: (error) => {
          notifications.show({
            title: "Image generation failed",
            message: error instanceof Error ? error.message : "Unknown error",
            color: "red",
          });
        },
      },
    );
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

  function insertMacro(syntax: string) {
    if (streaming) return;
    const el = composerInputRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${syntax}${draft.slice(end)}`;
    const caret = start + syntax.length;
    onDraftChange(next);
    requestAnimationFrame(() => {
      const input = composerInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(caret, caret);
    });
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

  const backgroundSrc = characterAvatarSrc(
    chat.settings.background_image_url,
    apiBase,
  );

  return (
    <div
      className={[classes.root, backgroundSrc ? classes.rootWithBg : ""]
        .filter(Boolean)
        .join(" ")}
      style={
        backgroundSrc
          ? ({
              "--chat-bg-image": `url(${JSON.stringify(backgroundSrc)})`,
            } as CSSProperties)
          : undefined
      }
    >
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
                  : {
                      nameColor: null,
                      dialogueColor: null,
                      messageBoxColor: null,
                    };

              return (
                <ChatMessageBubble
                  key={key}
                  message={message}
                  displayText={displayText}
                  speakerName={resolvedSpeakerName}
                  nameColor={colors.nameColor}
                  dialogueColor={colors.dialogueColor}
                  messageBoxColor={colors.messageBoxColor}
                  elevated={Boolean(backgroundSrc)}
                  avatarUrl={resolvedAvatar}
                  macroValues={macroValues}
                  disabled={streaming || generateImageMutation.isPending}
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
                  onGenerateImage={
                    showMessageActions &&
                    chat.mode === "conversation" &&
                    message.role === "assistant"
                      ? () => handleGenerateImage(message.id)
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
              messageBoxColor={
                colorsForCharacterId(streamingCharacterId).messageBoxColor
              }
              elevated={Boolean(backgroundSrc)}
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
        <div className={classes.composerBar} data-glass-surface>
          <div className={classes.composerInputWrap}>
            {pendingAttachments.length > 0 ? (
              <div
                className={classes.composerAttachments}
                aria-label="Pending attachments"
              >
                {pendingAttachments.map((item) => (
                  <div
                    key={item.localId}
                    className={classes.composerAttachmentChip}
                  >
                    {item.previewUrl ? (
                      <img
                        className={classes.composerAttachmentThumb}
                        src={item.previewUrl}
                        alt=""
                      />
                    ) : (
                      <span className={classes.composerAttachmentFileIcon}>
                        {item.file.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className={classes.composerAttachmentName}>
                      {item.file.name}
                    </span>
                    <ActionIcon
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${item.file.name}`}
                      disabled={streaming || uploadingAttachments}
                      onClick={() => removePendingAttachment(item.localId)}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </div>
                ))}
              </div>
            ) : null}

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
              ref={composerInputRef}
              className={classes.composerInput}
              placeholder="Write a message…  (/ commands, @ mentions)"
              value={draft}
              disabled={streaming}
              rows={1}
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

          <div className={classes.composerFooter}>
            <div className={classes.composerTools}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,.md,.txt,.pdf,.json"
                className={classes.hiddenFileInput}
                onChange={(event) => handlePickAttachments(event.target.files)}
              />
              <ActionIcon
                type="button"
                variant="subtle"
                aria-label="Attach files"
                title="Attach images or files"
                disabled={streaming || uploadingAttachments}
                onClick={() => fileInputRef.current?.click()}
              >
                <IconPaperclip size={17} stroke={1.6} />
              </ActionIcon>

              <Menu>
                <Menu.Target>
                  <ActionIcon
                    type="button"
                    variant="subtle"
                    aria-label="Insert macro"
                    title="Insert roleplay macro"
                    disabled={streaming}
                  >
                    <IconBraces size={17} stroke={1.6} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown className={classes.menuDropdownAbove}>
                  <Menu.Label>Roleplay macros</Menu.Label>
                  {CHAT_INSERT_MACROS.map((macro) => (
                    <Menu.Item
                      key={macro.syntax}
                      onClick={() => insertMacro(macro.syntax)}
                    >
                      <span className={classes.macroMenuItem}>
                        <span className={classes.macroSyntax}>
                          {macro.syntax}
                        </span>
                        <span className={classes.macroLabel}>{macro.label}</span>
                      </span>
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>

              {chat.settings.allow_character_dms &&
              characterSelectOptions.length > 0 ? (
                <Menu>
                  <Menu.Target>
                    <ActionIcon
                      type="button"
                      variant="subtle"
                      aria-label="Open character DM"
                      title="Open character DM"
                      disabled={streaming || openDmMutation.isPending}
                    >
                      <IconMessage size={17} stroke={1.6} />
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

              {showResponseAsPicker ? (
                <Menu>
                  <Menu.Target>
                    <ActionIcon
                      type="button"
                      variant="subtle"
                      aria-label="Response as"
                      title="Response as"
                      disabled={streaming}
                    >
                      <IconUsers size={17} stroke={1.6} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown className={classes.menuDropdownAbove}>
                    <Menu.Label>Response as</Menu.Label>
                    {characterSelectOptions.map((option) => {
                      const avatarUrl =
                        characterAvatarById.get(option.value) || null;
                      return (
                        <Menu.Item
                          key={option.value}
                          className={
                            streaming ? classes.menuItemDisabled : undefined
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
            </div>

            <div className={classes.composerSendGroup}>
              <span className={classes.composerHint}>
                {streaming
                  ? "Generating…"
                  : uploadingAttachments
                    ? "Uploading…"
                    : draft.trim() || pendingAttachments.length > 0
                      ? "Enter to send · Shift+Enter for new line"
                      : "Empty send impersonates"}
              </span>
              {streaming ? (
                <ActionIcon
                  type="button"
                  variant="ghostDanger"
                  className={classes.composerSend}
                  aria-label="Stop"
                  title="Stop"
                  onClick={handleStop}
                >
                  <IconPlayerStop size={18} stroke={1.6} />
                </ActionIcon>
              ) : (
                <ActionIcon
                  type="button"
                  variant={
                    draft.trim() || pendingAttachments.length > 0
                      ? "primary"
                      : "default"
                  }
                  className={classes.composerSend}
                  aria-label={
                    draft.trim() || pendingAttachments.length > 0
                      ? "Send"
                      : "Impersonate"
                  }
                  title={
                    uploadingAttachments
                      ? "Uploading…"
                      : draft.trim() || pendingAttachments.length > 0
                        ? "Send"
                        : "Impersonate (empty send writes as your persona)"
                  }
                  disabled={!canSend(draft)}
                  onClick={() => void handleSend()}
                >
                  <IconSend size={17} stroke={1.7} />
                </ActionIcon>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
