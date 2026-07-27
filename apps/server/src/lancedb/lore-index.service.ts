import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  forwardRef,
} from "@nestjs/common";
import type { Lorebook } from "@ai-hub/shared";
import { LorebooksService } from "../routes/lorebooks/lorebooks.service";
import { EmbeddingsService } from "./embeddings.service";
import { LancedbService, type LoreEntryRow } from "./lancedb.service";

/**
 * Keeps LanceDB in sync with SQLite lorebooks.
 * Index failures are logged and do not fail the primary save.
 */
@Injectable()
export class LoreIndexService implements OnModuleInit {
  private readonly logger = new Logger(LoreIndexService.name);

  constructor(
    @Inject(forwardRef(() => LorebooksService))
    private readonly lorebooks: LorebooksService,
    private readonly lancedb: LancedbService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async onModuleInit() {
    await this.lancedb.connect();
    if (!this.lancedb.isAvailable()) return;
    try {
      const count = await this.lancedb.countRows();
      const dirtyIds = await this.lorebooks.listDirtyIds();
      const list = await this.lorebooks.findAll();

      if (count === 0 && list.length > 0) {
        this.logger.log("LanceDB empty — running full lore reindex");
        await this.reindexAll();
        return;
      }

      if (dirtyIds.length > 0) {
        this.logger.log(
          `Retrying ${dirtyIds.length} dirty lorebook index(es)`,
        );
        for (const id of dirtyIds) {
          const book = await this.lorebooks.findOne(id);
          await this.indexLorebook(book);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Startup lore reindex skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async indexLorebook(lorebook: Lorebook): Promise<boolean> {
    if (!this.lancedb.isAvailable()) return false;
    try {
      const rows = await this.embeddings.buildEntryRows(
        lorebook.id,
        lorebook.entries ?? [],
      );
      if (rows.length === 0) {
        await this.lancedb.deleteLorebook(lorebook.id);
      } else {
        await this.lancedb.upsertEntries(rows);
      }
      await this.lorebooks.setIndexDirty(lorebook.id, false);
      return true;
    } catch (error) {
      this.logger.warn(
        `Failed to index lorebook ${lorebook.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.lorebooks.setIndexDirty(lorebook.id, true);
      return false;
    }
  }

  async removeLorebook(lorebookId: string): Promise<void> {
    try {
      await this.lancedb.deleteLorebook(lorebookId);
    } catch (error) {
      this.logger.warn(
        `Failed to remove lorebook ${lorebookId} from LanceDB: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async reindexAll(): Promise<{ lorebooks: number; entries: number }> {
    if (!this.lancedb.isAvailable()) {
      return { lorebooks: 0, entries: 0 };
    }
    const list = await this.lorebooks.findAll();
    const allRows: LoreEntryRow[] = [];
    const failedIds: string[] = [];

    for (const item of list) {
      try {
        const book = await this.lorebooks.findOne(item.id);
        const rows = await this.embeddings.buildEntryRows(
          book.id,
          book.entries ?? [],
        );
        allRows.push(...rows);
      } catch (error) {
        failedIds.push(item.id);
        this.logger.warn(
          `Failed to embed lorebook ${item.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    await this.lancedb.replaceAll(allRows);

    for (const item of list) {
      await this.lorebooks.setIndexDirty(
        item.id,
        failedIds.includes(item.id),
      );
    }

    this.logger.log(
      `Reindexed ${allRows.length} lore entries across ${list.length} lorebooks` +
        (failedIds.length ? ` (${failedIds.length} dirty)` : ""),
    );
    return { lorebooks: list.length, entries: allRows.length };
  }

  async reindexOne(lorebookId: string): Promise<boolean> {
    const book = await this.lorebooks.findOne(lorebookId);
    return this.indexLorebook(book);
  }
}
