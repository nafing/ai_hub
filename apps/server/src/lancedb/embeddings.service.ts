import { createHash } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { LorebookEntry } from "@ai-hub/shared";
import { ConnectionsService } from "../routes/connections/connections.service";
import { embedTexts } from "../utils/openrouter";
import {
  loreEntryEmbedText,
  loreEntryRowId,
  loreEntryUid,
  type LoreEntryRow,
} from "./lancedb.service";

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly cache = new Map<string, number[]>();

  constructor(
    private readonly config: ConfigService,
    private readonly connections: ConnectionsService,
  ) {}

  embeddingModel(): string {
    return (
      this.config.get<string>("SERVER_EMBEDDING_MODEL")?.trim() ||
      "openai/text-embedding-3-small"
    );
  }

  private cacheKey(text: string): string {
    return createHash("sha256")
      .update(`${this.embeddingModel()}\0${text}`)
      .digest("hex");
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const missing: string[] = [];
    const missingIndexes: number[] = [];
    const output: Array<number[] | null> = texts.map((text, index) => {
      const cached = this.cache.get(this.cacheKey(text));
      if (cached) return cached;
      missing.push(text);
      missingIndexes.push(index);
      return null;
    });

    if (missing.length > 0) {
      const connection = await this.connections.findDefault();
      const vectors = await embedTexts(
        connection.api_key,
        this.embeddingModel(),
        missing,
      );
      for (let i = 0; i < missing.length; i++) {
        const vector = vectors[i];
        this.cache.set(this.cacheKey(missing[i]), vector);
        output[missingIndexes[i]] = vector;
      }
    }

    return output.map((vector, index) => {
      if (!vector) {
        throw new Error(`Failed to embed text at index ${index}`);
      }
      return vector;
    });
  }

  async embedQuery(query: string): Promise<number[]> {
    const [vector] = await this.embed([query.trim() || " "]);
    return vector;
  }

  async buildEntryRows(
    lorebookId: string,
    entries: LorebookEntry[],
  ): Promise<LoreEntryRow[]> {
    const enabled = entries.filter(
      (entry) => entry.enabled !== false && (entry.content ?? "").trim(),
    );
    if (enabled.length === 0) return [];

    const texts = enabled.map((entry) => loreEntryEmbedText(entry));
    let vectors: number[][];
    try {
      vectors = await this.embed(texts);
    } catch (error) {
      this.logger.warn(
        `Embedding failed for lorebook ${lorebookId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }

    return enabled.map((entry, index) => {
      const originalIndex = entries.indexOf(entry);
      const entryUid = loreEntryUid(entry, originalIndex >= 0 ? originalIndex : index);
      return {
        id: loreEntryRowId(lorebookId, entryUid),
        lorebook_id: lorebookId,
        entry_uid: entryUid,
        enabled: entry.enabled !== false,
        constant: Boolean(entry.constant),
        name: entry.name ?? "",
        keys: (entry.keys ?? []).join(", "),
        content: entry.content ?? "",
        vector: vectors[index],
      };
    });
  }
}
