import type {
  Chat,
  ChatListItem,
  ChatMessageAttachment,
  ChatStreamEvent,
  CreateChatInput,
  CreateChatMessageInput,
  GenerateChatInput,
  GenerateChatImageInput,
  PeekPromptResult,
  UpdateChatInput,
  UpdateChatMessageInput,
  Variable,
} from "@ai-hub/shared";
import { promptPresetVariables } from "@/features/presets/PresetCommandBridge";
import { api } from "@/lib/api";

export class PresetVariablesCancelledError extends Error {
  constructor() {
    super("Preset variables setup cancelled");
    this.name = "PresetVariablesCancelledError";
  }
}

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

export async function getOrCreateCharacterDm(
  chatId: string,
  characterId: string,
): Promise<Chat> {
  const { data } = await api.post<Chat>(
    `/chats/${chatId}/character-dms/${characterId}`,
  );
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

export async function uploadChatAttachment(
  chatId: string,
  file: File,
): Promise<ChatMessageAttachment> {
  const form = new FormData();
  form.append("file", file, file.name);
  const { data } = await api.post<ChatMessageAttachment>(
    `/chats/${chatId}/attachments`,
    form,
  );
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

export async function generateChatImage(
  id: string,
  input: GenerateChatImageInput = {},
): Promise<Chat> {
  const { data } = await api.post<Chat>(`/chats/${id}/generate-image`, input);
  return data;
}

export async function applyAgentProposal(
  id: string,
  input: { slug?: string; proposalId: string },
): Promise<Chat> {
  const { data } = await api.post<Chat>(
    `/chats/${id}/agent-proposals/apply`,
    input,
  );
  return data;
}

export async function dismissAgentProposal(
  id: string,
  input: { slug?: string; proposalId: string },
): Promise<Chat> {
  const { data } = await api.post<Chat>(
    `/chats/${id}/agent-proposals/dismiss`,
    input,
  );
  return data;
}

export async function generateChatSummary(
  id: string,
  input: import("@ai-hub/shared").GenerateChatSummaryInput = {},
): Promise<Chat> {
  const { data } = await api.post<Chat>(`/chats/${id}/generate-summary`, input);
  return data;
}

export async function patchChatSummaryEntries(
  id: string,
  body: import("@ai-hub/shared").SummaryEntriesPatchBody,
): Promise<Chat> {
  const { data } = await api.patch<Chat>(`/chats/${id}/summary-entries`, body);
  return data;
}

export async function patchConversationSummaries(
  id: string,
  body: import("@ai-hub/shared").ConversationSummariesPatchBody,
): Promise<Chat> {
  const { data } = await api.patch<Chat>(`/chats/${id}/summaries`, body);
  return data;
}

export async function backfillConversationSummaries(
  id: string,
  input: import("@ai-hub/shared").ConversationSummaryBackfillInput = {},
): Promise<
  import("@ai-hub/shared").ConversationSummaryBackfillResult & { chat: Chat }
> {
  const { data } = await api.post(`/chats/${id}/backfill-summaries`, input);
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
): Promise<{ presetId: string; variables: Variable[] } | null> {
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
  let needsVariables: { presetId: string; variables: Variable[] } | null =
    null;

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
          const event = JSON.parse(payload) as ChatStreamEvent;
          if (event.type === "needs_preset_variables") {
            needsVariables = {
              presetId: event.presetId,
              variables: event.variables,
            };
            continue;
          }
          onEvent(event);
        } catch {
          // ignore malformed events
        }
      }
    }
  }

  return needsVariables;
}

async function withPresetVariableRetry(
  runOnce: () => Promise<{ presetId: string; variables: Variable[] } | null>,
): Promise<void> {
  for (;;) {
    const needs = await runOnce();
    if (!needs) return;

    const chosen = await promptPresetVariables(
      needs.presetId,
      needs.variables,
    );
    if (!chosen) {
      throw new PresetVariablesCancelledError();
    }
  }
}

export async function streamGenerate(
  id: string,
  input: GenerateChatInput,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  await withPresetVariableRetry(async () => {
    const response = await fetch(`${apiBaseUrl()}/chats/${id}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(input),
      signal,
    });
    return readSseStream(response, onEvent);
  });
}

export async function streamRegenerate(
  id: string,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
  messageId?: string,
): Promise<void> {
  await withPresetVariableRetry(async () => {
    const response = await fetch(`${apiBaseUrl()}/chats/${id}/regenerate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(messageId ? { messageId } : {}),
      signal,
    });
    return readSseStream(response, onEvent);
  });
}
