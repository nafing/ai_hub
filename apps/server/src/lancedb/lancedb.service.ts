import { createHash } from "node:crypto";
import path from "node:path";
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as lancedb from "@lancedb/lancedb";
import type { LorebookEntry } from "@ai-hub/shared";

export const LORE_ENTRIES_TABLE = "lore_entries";
export const CHAT_MESSAGES_TABLE = "chat_messages";

export type LoreEntryRow = {
  id: string;
  lorebook_id: string;
  entry_uid: string;
  enabled: boolean;
  constant: boolean;
  name: string;
  keys: string;
  content: string;
  vector: number[];
};

export type LoreSearchHit = LoreEntryRow & {
  _distance?: number;
};

export type ChatMessageRow = {
  id: string;
  chat_id: string;
  message_id: string;
  role: string;
  content: string;
  created_at: string;
  vector: number[];
};

export type ChatMemorySearchHit = ChatMessageRow & {
  _distance?: number;
};

export function loreEntryUid(entry: LorebookEntry, index: number): string {
  if (typeof entry.id === "number" && Number.isFinite(entry.id)) {
    return String(entry.id);
  }
  const basis = [
    entry.name ?? "",
    (entry.keys ?? []).join("|"),
    entry.content ?? "",
    String(index),
  ].join("\0");
  return createHash("sha1").update(basis).digest("hex").slice(0, 16);
}

export function loreEntryRowId(lorebookId: string, entryUid: string): string {
  return `${lorebookId}:${entryUid}`;
}

export function loreEntryEmbedText(entry: LorebookEntry): string {
  const name = entry.name?.trim() ?? "";
  const keys = (entry.keys ?? []).filter(Boolean).join(", ");
  const content = (entry.content ?? "").trim();
  return [name, keys ? `Keys: ${keys}` : "", content].filter(Boolean).join("\n");
}

export function chatMessageRowId(chatId: string, messageId: string): string {
  return `${chatId}:${messageId}`;
}

@Injectable()
export class LancedbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LancedbService.name);
  private db: lancedb.Connection | null = null;
  private loreTable: lancedb.Table | null = null;
  private chatTable: lancedb.Table | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    this.loreTable = null;
    this.chatTable = null;
    this.db = null;
  }

  private resolvePath(): string {
    const configured = this.config.get<string>("SERVER_LANCEDB_PATH");
    if (configured?.trim()) {
      return path.isAbsolute(configured)
        ? configured
        : path.resolve(process.cwd(), configured);
    }
    return path.resolve(__dirname, "../../../../data/lancedb");
  }

  async connect(): Promise<lancedb.Connection> {
    if (this.db) return this.db;
    const uri = this.resolvePath();
    this.db = await lancedb.connect(uri);
    this.logger.log(`LanceDB connected at ${uri}`);
    try {
      this.loreTable = await this.db.openTable(LORE_ENTRIES_TABLE);
      const count = await this.loreTable.countRows();
      this.logger.log(`Opened ${LORE_ENTRIES_TABLE} (${count} rows)`);
    } catch {
      this.loreTable = null;
    }
    try {
      this.chatTable = await this.db.openTable(CHAT_MESSAGES_TABLE);
      const count = await this.chatTable.countRows();
      this.logger.log(`Opened ${CHAT_MESSAGES_TABLE} (${count} rows)`);
    } catch {
      this.chatTable = null;
    }
    return this.db;
  }

  async countRows(): Promise<number> {
    await this.connect();
    if (!this.loreTable) return 0;
    return this.loreTable.countRows();
  }

  async countChatRows(chatId?: string): Promise<number> {
    await this.connect();
    if (!this.chatTable) return 0;
    if (!chatId) return this.chatTable.countRows();
    const safe = chatId.replace(/'/g, "''");
    return this.chatTable.countRows(`chat_id = '${safe}'`);
  }

  private async ensureLoreTable(
    sampleVector: number[],
  ): Promise<lancedb.Table> {
    await this.connect();
    if (this.loreTable) return this.loreTable;
    if (!this.db) throw new Error("LanceDB not connected");

    const placeholder: LoreEntryRow = {
      id: "__init__",
      lorebook_id: "__init__",
      entry_uid: "__init__",
      enabled: false,
      constant: false,
      name: "",
      keys: "",
      content: "",
      vector: sampleVector,
    };
    this.loreTable = await this.db.createTable(LORE_ENTRIES_TABLE, [placeholder], {
      mode: "overwrite",
    });
    await this.loreTable.delete(`id = '__init__'`);
    this.logger.log(`Created ${LORE_ENTRIES_TABLE}`);
    return this.loreTable;
  }

  private async ensureChatTable(
    sampleVector: number[],
  ): Promise<lancedb.Table> {
    await this.connect();
    if (this.chatTable) return this.chatTable;
    if (!this.db) throw new Error("LanceDB not connected");

    const placeholder: ChatMessageRow = {
      id: "__init__",
      chat_id: "__init__",
      message_id: "__init__",
      role: "system",
      content: "",
      created_at: new Date(0).toISOString(),
      vector: sampleVector,
    };
    this.chatTable = await this.db.createTable(
      CHAT_MESSAGES_TABLE,
      [placeholder],
      { mode: "overwrite" },
    );
    await this.chatTable.delete(`id = '__init__'`);
    this.logger.log(`Created ${CHAT_MESSAGES_TABLE}`);
    return this.chatTable;
  }

  async deleteLorebook(lorebookId: string): Promise<void> {
    await this.connect();
    if (!this.loreTable) return;
    const safe = lorebookId.replace(/'/g, "''");
    await this.loreTable.delete(`lorebook_id = '${safe}'`);
  }

  async upsertEntries(rows: LoreEntryRow[]): Promise<void> {
    if (rows.length === 0) return;
    const table = await this.ensureLoreTable(rows[0].vector);
    const lorebookId = rows[0].lorebook_id;
    await this.deleteLorebook(lorebookId);
    if (!this.loreTable) this.loreTable = table;
    await this.loreTable.add(rows);
  }

  async replaceAll(rows: LoreEntryRow[]): Promise<void> {
    if (rows.length === 0) {
      await this.connect();
      if (this.loreTable && this.db) {
        await this.db.dropTable(LORE_ENTRIES_TABLE);
        this.loreTable = null;
      }
      return;
    }
    await this.connect();
    if (!this.db) throw new Error("LanceDB not connected");
    this.loreTable = await this.db.createTable(LORE_ENTRIES_TABLE, rows, {
      mode: "overwrite",
    });
  }

  async search(input: {
    queryVector: number[];
    lorebookIds: string[];
    topK: number;
    enabledOnly?: boolean;
  }): Promise<LoreSearchHit[]> {
    await this.connect();
    if (!this.loreTable || input.lorebookIds.length === 0 || input.topK <= 0) {
      return [];
    }

    const ids = input.lorebookIds
      .map((id) => `'${id.replace(/'/g, "''")}'`)
      .join(", ");
    let where = `lorebook_id IN (${ids})`;
    if (input.enabledOnly !== false) {
      where += ` AND enabled = true`;
    }

    const results = await this.loreTable
      .vectorSearch(input.queryVector)
      .where(where)
      .limit(input.topK)
      .toArray();

    return results as LoreSearchHit[];
  }

  async deleteChatMessages(chatId: string): Promise<void> {
    await this.connect();
    if (!this.chatTable) return;
    const safe = chatId.replace(/'/g, "''");
    await this.chatTable.delete(`chat_id = '${safe}'`);
  }

  async deleteChatMessage(chatId: string, messageId: string): Promise<void> {
    await this.connect();
    if (!this.chatTable) return;
    const id = chatMessageRowId(chatId, messageId).replace(/'/g, "''");
    await this.chatTable.delete(`id = '${id}'`);
  }

  async upsertChatMessages(rows: ChatMessageRow[]): Promise<void> {
    if (rows.length === 0) return;
    const table = await this.ensureChatTable(rows[0].vector);
    if (!this.chatTable) this.chatTable = table;
    for (const row of rows) {
      const safe = row.id.replace(/'/g, "''");
      await this.chatTable.delete(`id = '${safe}'`);
    }
    await this.chatTable.add(rows);
  }

  async replaceChatMessages(
    chatId: string,
    rows: ChatMessageRow[],
  ): Promise<void> {
    await this.deleteChatMessages(chatId);
    if (rows.length === 0) return;
    const table = await this.ensureChatTable(rows[0].vector);
    if (!this.chatTable) this.chatTable = table;
    await this.chatTable.add(rows);
  }

  async searchChatMessages(input: {
    queryVector: number[];
    chatId: string;
    topK: number;
    excludeMessageIds?: string[];
  }): Promise<ChatMemorySearchHit[]> {
    await this.connect();
    if (!this.chatTable || input.topK <= 0) return [];

    const safeChat = input.chatId.replace(/'/g, "''");
    let where = `chat_id = '${safeChat}'`;
    const exclude = input.excludeMessageIds ?? [];
    if (exclude.length > 0) {
      const ids = exclude
        .map((id) => `'${id.replace(/'/g, "''")}'`)
        .join(", ");
      where += ` AND message_id NOT IN (${ids})`;
    }

    // Over-fetch then filter in case some excluded ids still slip through.
    const limit = Math.max(input.topK + exclude.length, input.topK);
    const results = await this.chatTable
      .vectorSearch(input.queryVector)
      .where(where)
      .limit(limit)
      .toArray();

    const excluded = new Set(exclude);
    return (results as ChatMemorySearchHit[])
      .filter((row) => !excluded.has(row.message_id))
      .slice(0, input.topK);
  }
}
