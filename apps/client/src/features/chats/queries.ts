import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateChatInput,
  GenerateChatSummaryInput,
  SummaryEntriesPatchBody,
  UpdateChatInput,
  UpdateChatMessageInput,
} from "@ai-hub/shared";
import {
  createChat,
  deleteChat,
  deleteChatMessage,
  generateChatSummary,
  getChat,
  getOrCreateCharacterDm,
  listChats,
  patchChatSummaryEntries,
  updateChat,
  updateChatMessage,
} from "./api";

export const chatKeys = {
  all: ["chats"] as const,
  list: () => [...chatKeys.all, "list"] as const,
  detail: (id: string) => [...chatKeys.all, "detail", id] as const,
};

export function useChats() {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: listChats,
  });
}

export function useChat(id: string | undefined) {
  return useQuery({
    queryKey: chatKeys.detail(id ?? ""),
    queryFn: () => getChat(id!),
    enabled: Boolean(id),
  });
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChatInput) => createChat(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

export function useGetOrCreateCharacterDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      chatId,
      characterId,
    }: {
      chatId: string;
      characterId: string;
    }) => getOrCreateCharacterDm(chatId, characterId),
    onSuccess: (dm, variables) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.list() });
      void queryClient.setQueryData(chatKeys.detail(dm.id), dm);
      void queryClient.invalidateQueries({
        queryKey: chatKeys.detail(variables.chatId),
      });
    },
  });
}

export function useUpdateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateChatInput }) =>
      updateChat(id, input),
    onSuccess: (chat) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.list() });
      void queryClient.setQueryData(chatKeys.detail(chat.id), chat);
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteChat(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

export function useUpdateChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      messageId,
      input,
    }: {
      id: string;
      messageId: string;
      input: UpdateChatMessageInput;
    }) => updateChatMessage(id, messageId, input),
    onSuccess: (chat) => {
      void queryClient.setQueryData(chatKeys.detail(chat.id), chat);
    },
  });
}

export function useDeleteChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, messageId }: { id: string; messageId: string }) =>
      deleteChatMessage(id, messageId),
    onSuccess: (chat) => {
      void queryClient.setQueryData(chatKeys.detail(chat.id), chat);
      void queryClient.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

export function useGenerateChatSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      chatId,
      ...input
    }: GenerateChatSummaryInput & { chatId: string }) =>
      generateChatSummary(chatId, input),
    onSuccess: (chat) => {
      void queryClient.setQueryData(chatKeys.detail(chat.id), chat);
    },
  });
}

export function usePatchSummaryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      chatId,
      body,
    }: {
      chatId: string;
      body: SummaryEntriesPatchBody;
    }) => patchChatSummaryEntries(chatId, body),
    onSuccess: (chat) => {
      void queryClient.setQueryData(chatKeys.detail(chat.id), chat);
    },
  });
}
