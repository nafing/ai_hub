import type {
  Chat,
  ChatListItem,
  ChatStreamEvent,
  CreateChatInput,
  CreateChatMessageInput,
  GenerateChatInput,
  PeekPromptResult,
  UpdateChatInput,
  UpdateChatMessageInput,
} from "@ai-hub/shared";
import { api } from "@/lib/api";

export async function listChats(): Promise<ChatListItem[]> {
  const { data } = await api.get<ChatListItem[]>("/chats");
  return data;
}

export async function getChat(id: string): Promise<Chat> {
  const { data } = await api.get<Chat>(`/chats/${id}`);
  return data;
}

export async function createChat(input: CreateChatInput): Promise<Chat> {
  const { data } = await api.post<Chat>("/chats", input);
  return data;
}

export async function updateChat(
  id: string,
  input: UpdateChatInput,
): Promise<Chat> {
  const { data } = await api.patch<Chat>(`/chats/${id}`, input);
  return data;
}

export async function deleteChat(id: string): Promise<void> {
  await api.delete(`/chats/${id}`);
}

export async function addChatMessage(
  id: string,
  input: CreateChatMessageInput,
): Promise<Chat> {
  const { data } = await api.post<Chat>(`/chats/${id}/messages`, input);
  return data;
}

export async function updateChatMessage(
  id: string,
  messageId: string,
  input: UpdateChatMessageInput,
): Promise<Chat> {
  const { data } = await api.patch<Chat>(
    `/chats/${id}/messages/${messageId}`,
    input,
  );
  return data;
}

export async function deleteChatMessage(
  id: string,
  messageId: string,
): Promise<Chat> {
  const { data } = await api.delete<Chat>(`/chats/${id}/messages/${messageId}`);
  return data;
}

export async function peekChatPrompt(
  id: string,
  messageId?: string,
): Promise<PeekPromptResult> {
  const { data } = await api.get<PeekPromptResult>(`/chats/${id}/peek-prompt`, {
    params: messageId ? { messageId } : undefined,
  });
  return data;
}

function apiBaseUrl(): string {
  const base = api.defaults.baseURL ?? "/v1/api";
  if (base.startsWith("http")) return base.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.origin}${base.startsWith("/") ? base : `/${base}`}`.replace(
      /\/$/,
      "",
    );
  }
  return base.replace(/\/$/, "");
}

async function readSseStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed (${response.status})`);
  }
  if (!response.body) {
    throw new Error("Empty stream response");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const lines = chunk.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        try {
          onEvent(JSON.parse(payload) as ChatStreamEvent);
        } catch {
          // ignore malformed events
        }
      }
    }
  }
}

export async function streamGenerate(
  id: string,
  input: GenerateChatInput,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/chats/${id}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(input),
    signal,
  });
  await readSseStream(response, onEvent);
}

export async function streamRegenerate(
  id: string,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
  messageId?: string,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/chats/${id}/regenerate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(messageId ? { messageId } : {}),
    signal,
  });
  await readSseStream(response, onEvent);
}
