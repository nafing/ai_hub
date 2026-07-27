import { Injectable, Logger } from "@nestjs/common";
import {
  activeMessageText,
  formatChatHistoryMarker,
  type ChatMessage,
  type ChatSettings,
} from "@ai-hub/shared";
import { EmbeddingsService } from "./embeddings.service";
import {
  LancedbService,
  chatMessageRowId,
  type ChatMemorySearchHit,
  type ChatMessageRow,
} from "./lancedb.service";

export type ChatMemoryHit = {
  message_id: string;
  role: string;
  content: string;
  score: number;
};

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function isIndexableMessage(message: ChatMessage): boolean {
  if (message.role === "system") return false;
  return activeMessageText(message).trim().length >= 12;
}

@Injectable()
export class ChatMemoryService {
  private readonly logger = new Logger(ChatMemoryService.name);

  constructor(
    private readonly lancedb: LancedbService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async indexMessage(chatId: string, message: ChatMessage): Promise<void> {
    if (!isIndexableMessage(message)) {
      await this.lancedb.deleteChatMessage(chatId, message.id);
      return;
    }
    try {
      const content = activeMessageText(message).trim();
      const [vector] = await this.embeddings.embed([content]);
      const row: ChatMessageRow = {
        id: chatMessageRowId(chatId, message.id),
        chat_id: chatId,
        message_id: message.id,
        role: message.role,
        content,
        created_at: message.created_at,
        vector,
      };
      await this.lancedb.upsertChatMessages([row]);
    } catch (error) {
      this.logger.warn(
        `Failed to index chat message ${chatId}/${message.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async indexMessages(chatId: string, messages: ChatMessage[]): Promise<void> {
    for (const message of messages) {
      await this.indexMessage(chatId, message);
    }
  }

  async reindexChat(chatId: string, messages: ChatMessage[]): Promise<void> {
    const indexable = messages.filter(isIndexableMessage);
    if (indexable.length === 0) {
      await this.lancedb.deleteChatMessages(chatId);
      return;
    }
    try {
      const texts = indexable.map((message) =>
        activeMessageText(message).trim(),
      );
      const vectors = await this.embeddings.embed(texts);
      const rows: ChatMessageRow[] = indexable.map((message, index) => ({
        id: chatMessageRowId(chatId, message.id),
        chat_id: chatId,
        message_id: message.id,
        role: message.role,
        content: texts[index],
        created_at: message.created_at,
        vector: vectors[index],
      }));
      await this.lancedb.replaceChatMessages(chatId, rows);
    } catch (error) {
      this.logger.warn(
        `Failed to reindex chat ${chatId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    try {
      await this.lancedb.deleteChatMessage(chatId, messageId);
    } catch (error) {
      this.logger.warn(
        `Failed to delete chat memory ${chatId}/${messageId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async deleteChat(chatId: string): Promise<void> {
    try {
      await this.lancedb.deleteChatMessages(chatId);
    } catch (error) {
      this.logger.warn(
        `Failed to delete chat memories ${chatId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Window recent history + retrieve older semantic memories for prompt injection.
   */
  async preparePromptMemory(input: {
    chatId: string;
    settings: ChatSettings;
    historyMessages: ChatMessage[];
    chatSummary: string;
    nameByCharacterId: Map<string, string>;
    charName?: string;
    userName?: string;
  }): Promise<{
    historyMessages: ChatMessage[];
    chatSummary: string;
    hits: ChatMemoryHit[];
    tokenEstimate: number;
  }> {
    const settings = input.settings;
    const depth = Math.max(1, settings.history_depth || 24);
    const all = input.historyMessages;
    const recent =
      all.length <= depth ? all : all.slice(all.length - depth);

    if (!settings.memory_enabled) {
      return {
        historyMessages: recent,
        chatSummary: input.chatSummary.trim(),
        hits: [],
        tokenEstimate: 0,
      };
    }

    const older = all.length <= depth ? [] : all.slice(0, all.length - depth);
    if (older.length === 0) {
      return {
        historyMessages: recent,
        chatSummary: input.chatSummary.trim(),
        hits: [],
        tokenEstimate: 0,
      };
    }

    // Backfill index for chats created before memory existed.
    try {
      const indexed = await this.lancedb.countChatRows(input.chatId);
      if (indexed === 0) {
        await this.reindexChat(input.chatId, all);
      }
    } catch (error) {
      this.logger.warn(
        `Chat memory backfill skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const queryText = recent
      .map((message) => activeMessageText(message).trim())
      .filter(Boolean)
      .slice(-Math.min(6, recent.length))
      .join("\n");

    if (!queryText.trim()) {
      return {
        historyMessages: recent,
        chatSummary: input.chatSummary.trim(),
        hits: [],
        tokenEstimate: 0,
      };
    }

    let rawHits: ChatMemorySearchHit[] = [];
    try {
      const vector = await this.embeddings.embedQuery(queryText);
      rawHits = await this.lancedb.searchChatMessages({
        queryVector: vector,
        chatId: input.chatId,
        topK: settings.memory_top_k,
        excludeMessageIds: recent.map((message) => message.id),
      });
    } catch (error) {
      this.logger.warn(
        `Chat memory search skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const budget = settings.memory_token_budget;
    let used = 0;
    const hits: ChatMemoryHit[] = [];
    for (const hit of rawHits) {
      const content = (hit.content ?? "").trim();
      if (!content) continue;
      const cost = estimateTokens(content);
      if (used + cost > budget && hits.length > 0) continue;
      used += cost;
      hits.push({
        message_id: hit.message_id,
        role: hit.role,
        content,
        score: typeof hit._distance === "number" ? hit._distance : 99,
      });
    }

    const memoryBlock = this.formatMemoryBlock(hits, {
      charName: input.charName,
      userName: input.userName,
      nameByCharacterId: input.nameByCharacterId,
      allMessages: all,
    });

    const summaryParts = [input.chatSummary.trim(), memoryBlock].filter(
      Boolean,
    );

    return {
      historyMessages: recent,
      chatSummary: summaryParts.join("\n\n"),
      hits,
      tokenEstimate: used,
    };
  }

  private formatMemoryBlock(
    hits: ChatMemoryHit[],
    options: {
      charName?: string;
      userName?: string;
      nameByCharacterId: Map<string, string>;
      allMessages: ChatMessage[];
    },
  ): string {
    if (hits.length === 0) return "";
    const byId = new Map(
      options.allMessages.map((message) => [message.id, message]),
    );
    const lines = hits.map((hit) => {
      const message = byId.get(hit.message_id);
      if (message) {
        return formatChatHistoryMarker([message], {
          charName: options.charName,
          userName: options.userName,
          nameByCharacterId: options.nameByCharacterId,
        });
      }
      const label =
        hit.role === "user"
          ? options.userName?.trim() || "User"
          : options.charName?.trim() || "Char";
      return `${label}: ${hit.content}`;
    });
    return `Relevant past messages:\n${lines.filter(Boolean).join("\n")}`;
  }
}
