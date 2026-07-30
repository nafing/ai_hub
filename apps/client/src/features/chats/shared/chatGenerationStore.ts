import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type {
  Chat,
  ChatMessage,
  ChatStreamEvent,
  GenerateChatInput,
} from "@ai-hub/shared";
import { notifications } from "@/components/ui";
import { playAppSound } from "@/features/sounds";
import { queryClient } from "@/lib/queryClient";
import {
  PresetVariablesCancelledError,
  streamGenerate,
  streamRegenerate,
} from "./api";
import { chatKeys } from "./queries";

export type StreamSpeaker = {
  character_id: string | null;
  character_name: string;
};

export type ChatGenerationState = {
  streaming: boolean;
  streamText: string;
  streamThinking: string;
  streamSpeaker: StreamSpeaker | null;
  agentStatus: { slug: string; name: string; phase: string } | null;
  regenHideAfterId: string | null;
};

const EMPTY_STATE: ChatGenerationState = {
  streaming: false,
  streamText: "",
  streamThinking: "",
  streamSpeaker: null,
  agentStatus: null,
  regenHideAfterId: null,
};

type ChatGenerationJob = ChatGenerationState & {
  abortController: AbortController | null;
};

type ChatGenerationStore = {
  jobs: Record<string, ChatGenerationJob>;
  getStateForChat: (chatId: string) => ChatGenerationState;
  isStreaming: (chatId: string) => boolean;
  stop: (chatId: string) => void;
  generate: (
    chatId: string,
    input: GenerateChatInput,
  ) => Promise<"ok" | "cancelled" | "aborted" | "error">;
  regenerate: (
    chatId: string,
    messageId: string,
  ) => Promise<"ok" | "cancelled" | "aborted" | "error">;
};

function emptyJob(): ChatGenerationJob {
  return { ...EMPTY_STATE, abortController: null };
}

function patchJob(
  chatId: string,
  patch: Partial<ChatGenerationJob>,
) {
  useChatGenerationStore.setState((state) => {
    const current = state.jobs[chatId] ?? emptyJob();
    return {
      jobs: {
        ...state.jobs,
        [chatId]: { ...current, ...patch },
      },
    };
  });
}

function clearStreamFields(chatId: string) {
  patchJob(chatId, {
    streaming: false,
    streamText: "",
    streamThinking: "",
    streamSpeaker: null,
    agentStatus: null,
    regenHideAfterId: null,
    abortController: null,
  });
}

/** Pull latest chat when SSE never delivered `done` (Capacitor / dropped stream). */
async function reconcileChatAfterIncompleteStream(chatId: string) {
  await queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });

  // Server may still be generating after the client lost the SSE body.
  for (const delayMs of [1500, 3500, 7000]) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (useChatGenerationStore.getState().isStreaming(chatId)) return;

    const before = queryClient.getQueryData<Chat>(chatKeys.detail(chatId));
    await queryClient.refetchQueries({ queryKey: chatKeys.detail(chatId) });
    const after = queryClient.getQueryData<Chat>(chatKeys.detail(chatId));
    if (
      after &&
      before &&
      after.messages.length > before.messages.length
    ) {
      return;
    }
  }
}

function appendMessageToCache(chatId: string, message: ChatMessage) {
  queryClient.setQueryData<Chat>(chatKeys.detail(chatId), (current) => {
    if (!current) return current;
    if (current.messages.some((item) => item.id === message.id)) return current;
    return { ...current, messages: [...current.messages, message] };
  });
}

function patchMessageReaction(
  chatId: string,
  messageId: string,
  emoji: string,
  characterId?: string | null,
) {
  queryClient.setQueryData<Chat>(chatKeys.detail(chatId), (current) => {
    if (!current) return current;
    return {
      ...current,
      messages: current.messages.map((message) => {
        if (message.id !== messageId) return message;
        return {
          ...message,
          reactions: [
            ...(message.reactions ?? []),
            {
              emoji,
              character_id: characterId ?? null,
              created_at: new Date().toISOString(),
            },
          ],
        };
      }),
    };
  });
}

function applyStreamEvent(chatId: string, event: ChatStreamEvent) {
  if (event.type === "user_message") {
    appendMessageToCache(chatId, event.message);
    return;
  }
  if (event.type === "turn_start") {
    patchJob(chatId, {
      streamText: "",
      streamThinking: "",
      streamSpeaker: {
        character_id: event.character_id,
        character_name: event.character_name,
      },
    });
    return;
  }
  if (event.type === "delta") {
    const current =
      useChatGenerationStore.getState().jobs[chatId] ?? emptyJob();
    patchJob(chatId, { streamText: current.streamText + event.delta });
    return;
  }
  if (event.type === "thinking") {
    const current =
      useChatGenerationStore.getState().jobs[chatId] ?? emptyJob();
    patchJob(chatId, {
      streamThinking: current.streamThinking + event.delta,
    });
    return;
  }
  if (event.type === "agent_phase") {
    patchJob(chatId, {
      agentStatus: {
        slug: event.slug,
        name: event.name,
        phase: event.phase,
      },
    });
    return;
  }
  if (event.type === "agent_done") {
    patchJob(chatId, { agentStatus: null });
    return;
  }
  if (event.type === "roleplay_dm") {
    void queryClient.invalidateQueries({ queryKey: chatKeys.list() });
    void queryClient.invalidateQueries({
      queryKey: chatKeys.detail(event.chat_id),
    });
    notifications.show({
      title:
        event.action === "created"
          ? `DM with ${event.character_name}`
          : `Message from ${event.character_name}`,
      message:
        event.action === "created"
          ? `Opened ${event.chat_title}.`
          : `Posted to ${event.chat_title}.`,
      color: "blue",
    });
    return;
  }
  if (event.type === "conversation_command") {
    if (
      event.command === "react" &&
      event.message_id &&
      event.detail
    ) {
      patchMessageReaction(
        chatId,
        event.message_id,
        event.detail,
        event.character_id,
      );
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: chatKeys.detail(chatId),
    });
    if (event.chat_id) {
      void queryClient.invalidateQueries({
        queryKey: chatKeys.detail(event.chat_id),
      });
    }
    notifications.show({
      title: `Command · ${event.command}`,
      message: event.detail || "Applied",
      color: "blue",
    });
    return;
  }
  if (event.type === "error") {
    playAppSound("chat", "error");
    notifications.show({
      title: "Generation failed",
      message: event.message,
      color: "red",
    });
    return;
  }
  if (event.type === "chat_summary") {
    queryClient.setQueryData(chatKeys.detail(chatId), event.chat);
    return;
  }
  if (event.type === "done") {
    playAppSound("chat");
    queryClient.setQueryData(chatKeys.detail(chatId), event.chat);
    void queryClient.invalidateQueries({ queryKey: chatKeys.list() });
    patchJob(chatId, {
      streamText: "",
      streamThinking: "",
      streamSpeaker: null,
    });
    const onThisChat =
      typeof window !== "undefined" &&
      window.location.pathname.includes(`/chats/${chatId}`);
    if (!onThisChat) {
      notifications.show({
        title: "Reply ready",
        message: event.chat.title
          ? `Finished generating in “${event.chat.title}”.`
          : "Chat generation finished.",
        color: "green",
      });
    }
  }
}

export const useChatGenerationStore = create<ChatGenerationStore>((_set, get) => ({
  jobs: {},

  getStateForChat: (chatId) => {
    const job = get().jobs[chatId];
    if (!job) return EMPTY_STATE;
    return {
      streaming: job.streaming,
      streamText: job.streamText,
      streamThinking: job.streamThinking,
      streamSpeaker: job.streamSpeaker,
      agentStatus: job.agentStatus,
      regenHideAfterId: job.regenHideAfterId,
    };
  },

  isStreaming: (chatId) => Boolean(get().jobs[chatId]?.streaming),

  stop: (chatId) => {
    get().jobs[chatId]?.abortController?.abort();
  },

  generate: async (chatId, input) => {
    if (get().isStreaming(chatId)) return "error";

    const controller = new AbortController();
    patchJob(chatId, {
      streaming: true,
      streamText: "",
      streamThinking: "",
      streamSpeaker: null,
      agentStatus: null,
      regenHideAfterId: null,
      abortController: controller,
    });

    let settled = false;
    try {
      await streamGenerate(
        chatId,
        input,
        (event) => {
          if (event.type === "done") settled = true;
          applyStreamEvent(chatId, event);
        },
        controller.signal,
      );
      return "ok";
    } catch (error) {
      if (error instanceof PresetVariablesCancelledError) {
        return "cancelled";
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        return "aborted";
      }
      playAppSound("chat", "error");
      notifications.show({
        title: "Send failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
      return "error";
    } finally {
      clearStreamFields(chatId);
      // Server may have persisted messages even when the SSE body never
      // reached JS (common with CapacitorHttp buffering / timeouts).
      if (!settled) {
        void reconcileChatAfterIncompleteStream(chatId);
      }
    }
  },

  regenerate: async (chatId, messageId) => {
    if (get().isStreaming(chatId)) return "error";

    const controller = new AbortController();
    patchJob(chatId, {
      streaming: true,
      streamText: "",
      streamThinking: "",
      streamSpeaker: null,
      agentStatus: null,
      regenHideAfterId: messageId,
      abortController: controller,
    });

    let settled = false;
    try {
      await streamRegenerate(
        chatId,
        (event) => {
          if (event.type === "done") settled = true;
          applyStreamEvent(chatId, event);
        },
        controller.signal,
        messageId,
      );
      return "ok";
    } catch (error) {
      if (error instanceof PresetVariablesCancelledError) {
        return "cancelled";
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        return "aborted";
      }
      playAppSound("chat", "error");
      notifications.show({
        title: "Regenerate failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
      return "error";
    } finally {
      clearStreamFields(chatId);
      if (!settled) {
        void reconcileChatAfterIncompleteStream(chatId);
      }
    }
  },
}));

export function useChatGeneration(chatId: string): ChatGenerationState {
  return useChatGenerationStore(
    useShallow((state) => {
      const job = state.jobs[chatId];
      if (!job) return EMPTY_STATE;
      return {
        streaming: job.streaming,
        streamText: job.streamText,
        streamThinking: job.streamThinking,
        streamSpeaker: job.streamSpeaker,
        agentStatus: job.agentStatus,
        regenHideAfterId: job.regenHideAfterId,
      };
    }),
  );
}
