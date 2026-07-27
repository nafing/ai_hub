import { Injectable, Logger } from "@nestjs/common";
import {
  defaultCharacterBookEntry,
  type Chat,
  type ChatMessage,
  type ChatSettings,
  type Lorebook,
} from "@ai-hub/shared";
import { LorebooksService } from "../lorebooks/lorebooks.service";

export type ToolExecutionContext = {
  chat: Chat;
  settings: ChatSettings;
  lorebooks: Lorebook[];
  /** Mutable chat summary (may be written back by caller). */
  summary: string;
  /** Mutable agent_state (vars + patches). */
  agentState: Record<string, unknown>;
  /** Mutable messages for edit_chat_message. */
  messages: ChatMessage[];
};

export type ToolExecutionResult = {
  ok: boolean;
  result?: unknown;
  error?: string;
  /** Side-effects for the caller to persist. */
  patch?: {
    summary?: string;
    agentState?: Record<string, unknown>;
    messages?: ChatMessage[];
    lorebooksUpdated?: string[];
  };
};

const VARS_KEY = "__vars";

@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);

  constructor(private readonly lorebooks: LorebooksService) {}

  async execute(
    name: string,
    argsJson: string,
    ctx: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    let args: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(argsJson || "{}") as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        args = parsed as Record<string, unknown>;
      }
    } catch {
      return { ok: false, error: `Invalid tool arguments JSON for ${name}` };
    }

    try {
      switch (name) {
        case "search_lorebook":
          return this.searchLorebook(String(args.query ?? ""), ctx, args);
        case "save_lorebook_entry":
          return await this.saveLorebookEntry(args, ctx);
        case "read_chat_summary":
          return { ok: true, result: { summary: ctx.summary || "" } };
        case "append_chat_summary":
          return this.appendChatSummary(String(args.text ?? ""), ctx);
        case "read_chat_variable":
          return this.readChatVariable(String(args.key ?? ""), ctx);
        case "write_chat_variable":
          return this.writeChatVariable(
            String(args.key ?? ""),
            String(args.value ?? ""),
            ctx,
          );
        case "roll_dice":
          return this.rollDice(String(args.notation ?? "1d20"), args);
        case "edit_chat_message":
          return this.editChatMessage(args, ctx);
        case "trigger_event":
        case "update_about_me":
        case "web_search":
          return {
            ok: false,
            error: `Tool "${name}" is not implemented in this hub build`,
          };
        default:
          return { ok: false, error: `Unknown tool "${name}"` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Tool ${name} failed: ${message}`);
      return { ok: false, error: message };
    }
  }

  private searchLorebook(
    query: string,
    ctx: ToolExecutionContext,
    args: Record<string, unknown>,
  ): ToolExecutionResult {
    const q = query.trim().toLowerCase();
    if (!q) return { ok: false, error: "query is required" };
    const category =
      typeof args.category === "string" ? args.category.trim().toLowerCase() : "";

    const hits: Array<{
      lorebook: string;
      name: string;
      keys: string[];
      content: string;
    }> = [];

    for (const book of ctx.lorebooks) {
      if (category && book.category !== category) continue;
      for (const entry of book.entries) {
        if (entry.enabled === false) continue;
        const hay = [
          entry.name ?? "",
          ...(entry.keys ?? []),
          entry.content ?? "",
        ]
          .join("\n")
          .toLowerCase();
        if (!hay.includes(q) && !q.split(/\s+/).some((token) => hay.includes(token))) {
          continue;
        }
        hits.push({
          lorebook: book.name,
          name: entry.name?.trim() || entry.keys?.[0] || "Entry",
          keys: entry.keys ?? [],
          content: (entry.content ?? "").slice(0, 1200),
        });
        if (hits.length >= 8) break;
      }
      if (hits.length >= 8) break;
    }

    return { ok: true, result: { hits } };
  }

  private async saveLorebookEntry(
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const target = ctx.lorebooks[0];
    if (!target) {
      return {
        ok: false,
        error: "No lorebook attached to this chat",
      };
    }

    const name = String(args.name ?? "").trim();
    const content = String(args.content ?? "").trim();
    if (!name || !content) {
      return { ok: false, error: "name and content are required" };
    }

    const mode =
      args.mode === "create" || args.mode === "append" || args.mode === "replace"
        ? args.mode
        : "replace";
    const keys = Array.isArray(args.keys)
      ? args.keys.map(String).filter(Boolean)
      : [name];
    const description =
      typeof args.description === "string" ? args.description : "";

    const entries = [...target.entries];
    const index = entries.findIndex(
      (entry) => (entry.name ?? "").trim().toLowerCase() === name.toLowerCase(),
    );

    if (index >= 0) {
      const existing = entries[index]!;
      if (existing.extensions?.locked === true) {
        return { ok: false, error: `Entry "${name}" is locked` };
      }
      if (mode === "create") {
        return { ok: false, error: `Entry "${name}" already exists` };
      }
      entries[index] = {
        ...existing,
        content:
          mode === "append"
            ? `${existing.content}\n${content}`.trim()
            : content,
        keys: keys.length ? keys : existing.keys,
        comment: description || existing.comment,
      };
    } else {
      entries.push({
        ...defaultCharacterBookEntry(),
        name,
        content,
        keys,
        comment: description || undefined,
        insertion_order: 100 + entries.length,
      });
    }

    const updated = await this.lorebooks.update(target.id, { entries });
    return {
      ok: true,
      result: { lorebookId: updated.id, entryName: name, mode },
      patch: { lorebooksUpdated: [updated.id] },
    };
  }

  private appendChatSummary(
    text: string,
    ctx: ToolExecutionContext,
  ): ToolExecutionResult {
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: "text is required" };
    const summary = ctx.summary.trim()
      ? `${ctx.summary.trim()}\n${trimmed}`
      : trimmed;
    return {
      ok: true,
      result: { summary },
      patch: { summary },
    };
  }

  private readChatVariable(
    key: string,
    ctx: ToolExecutionContext,
  ): ToolExecutionResult {
    if (!key.trim()) return { ok: false, error: "key is required" };
    const vars = (ctx.agentState[VARS_KEY] ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      result: { key, value: vars[key] ?? null },
    };
  }

  private writeChatVariable(
    key: string,
    value: string,
    ctx: ToolExecutionContext,
  ): ToolExecutionResult {
    if (!key.trim()) return { ok: false, error: "key is required" };
    const vars = {
      ...((ctx.agentState[VARS_KEY] as Record<string, unknown>) ?? {}),
      [key]: value,
    };
    const agentState = { ...ctx.agentState, [VARS_KEY]: vars };
    return {
      ok: true,
      result: { key, value },
      patch: { agentState },
    };
  }

  private rollDice(
    notation: string,
    args: Record<string, unknown>,
  ): ToolExecutionResult {
    const match = notation
      .trim()
      .toLowerCase()
      .match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!match) {
      return { ok: false, error: `Invalid dice notation: ${notation}` };
    }
    const count = Math.min(Math.max(Number(match[1] || "1"), 1), 100);
    const sides = Math.min(Math.max(Number(match[2]), 2), 1000);
    const modifier = Number(match[3] || "0");
    const rolls: number[] = [];
    for (let i = 0; i < count; i += 1) {
      rolls.push(1 + Math.floor(Math.random() * sides));
    }
    const total = rolls.reduce((sum, n) => sum + n, 0) + modifier;
    return {
      ok: true,
      result: {
        notation,
        rolls,
        modifier,
        total,
        reason: typeof args.reason === "string" ? args.reason : undefined,
      },
    };
  }

  private editChatMessage(
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): ToolExecutionResult {
    const messageId = String(args.messageId ?? "").trim();
    const content = String(args.content ?? "");
    if (!messageId) return { ok: false, error: "messageId is required" };

    const recent = ctx.messages.slice(-24);
    const target = recent.find((message) => message.id === messageId);
    if (!target) {
      return {
        ok: false,
        error: "Message not found in the recent editable window",
      };
    }

    const messages = ctx.messages.map((message) => {
      if (message.id !== messageId) return message;
      const swipes = [...message.swipes];
      swipes[message.swipe_id] = content;
      return { ...message, swipes };
    });

    return {
      ok: true,
      result: {
        messageId,
        reason: typeof args.reason === "string" ? args.reason : undefined,
      },
      patch: { messages },
    };
  }
}
