import {
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
import {
  normalizeLorebook,
  type CreateLorebookInput,
  type LoreIndexStatus,
  type Lorebook,
  type LorebookListItem,
  type UpdateLorebookInput,
} from "@ai-hub/shared";
import { LoreIndexService } from "../../lancedb/lore-index.service";
import { LoreRetrievalService } from "../../lancedb/lore-retrieval.service";
import { LancedbService } from "../../lancedb/lancedb.service";
import { CharacterEntity } from "../characters/character.entity";
import { PersonaEntity } from "../personas/persona.entity";
import { LorebookEntity } from "./lorebook.entity";

@Injectable()
export class LorebooksService {
  constructor(
    @InjectRepository(LorebookEntity)
    private readonly lorebooks: Repository<LorebookEntity>,
    @InjectRepository(CharacterEntity)
    private readonly characters: Repository<CharacterEntity>,
    @InjectRepository(PersonaEntity)
    private readonly personas: Repository<PersonaEntity>,
    @Inject(forwardRef(() => LoreIndexService))
    private readonly loreIndex: LoreIndexService,
    private readonly loreRetrieval: LoreRetrievalService,
    private readonly lancedb: LancedbService,
  ) {}

  async findAll(): Promise<LorebookListItem[]> {
    await this.pruneOrphanLinks();
    const rows = await this.lorebooks.find({
      order: { category: "ASC", name: "ASC" },
    });
    return rows.map((row) => this.toListItem(row));
  }

  async findOne(id: string): Promise<Lorebook> {
    await this.pruneOrphanLinks();
    const row = await this.lorebooks.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Lorebook ${id} not found`);
    }
    return this.toLorebook(row);
  }

  async create(input: CreateLorebookInput): Promise<Lorebook> {
    const normalized = normalizeLorebook(input);
    const entity = this.lorebooks.create({
      id: randomUUID(),
      ...normalized,
      index_dirty: true,
    });
    const saved = await this.lorebooks.save(entity);
    const lorebook = this.toLorebook(saved);
    void this.loreIndex.indexLorebook(lorebook);
    return lorebook;
  }

  async update(id: string, input: UpdateLorebookInput): Promise<Lorebook> {
    const row = await this.lorebooks.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Lorebook ${id} not found`);
    }

    const merged = normalizeLorebook({
      name: input.name ?? row.name,
      description: input.description ?? row.description,
      enabled: input.enabled ?? row.enabled,
      global: input.global ?? row.global,
      category: input.category ?? row.category,
      linked_characters:
        input.linked_characters !== undefined
          ? input.linked_characters
          : row.linked_characters,
      linked_personas:
        input.linked_personas !== undefined
          ? input.linked_personas
          : row.linked_personas,
      scan_depth:
        input.scan_depth !== undefined ? input.scan_depth : row.scan_depth,
      token_budget:
        input.token_budget !== undefined
          ? input.token_budget
          : row.token_budget,
      recursive_scanning:
        input.recursive_scanning !== undefined
          ? input.recursive_scanning
          : row.recursive_scanning,
      extensions:
        input.extensions !== undefined ? input.extensions : row.extensions,
      entries: input.entries !== undefined ? input.entries : row.entries,
    });

    Object.assign(row, merged);
    row.index_dirty = true;
    const saved = await this.lorebooks.save(row);
    const lorebook = this.toLorebook(saved);
    void this.loreIndex.indexLorebook(lorebook);
    return lorebook;
  }

  async remove(id: string): Promise<void> {
    const row = await this.lorebooks.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Lorebook ${id} not found`);
    }
    await this.lorebooks.delete({ id });
    void this.loreIndex.removeLorebook(id);
  }

  /** Drop a character id from every lorebook's `linked_characters`. */
  async unlinkCharacter(characterId: string): Promise<void> {
    const rows = await this.lorebooks.find();
    const dirty = rows.filter((row) =>
      Array.isArray(row.linked_characters)
        ? row.linked_characters.includes(characterId)
        : false,
    );
    if (dirty.length === 0) return;

    for (const row of dirty) {
      row.linked_characters = row.linked_characters.filter(
        (id) => id !== characterId,
      );
    }
    await this.lorebooks.save(dirty);
  }

  /** Drop a persona id from every lorebook's `linked_personas`. */
  async unlinkPersona(personaId: string): Promise<void> {
    const rows = await this.lorebooks.find();
    const dirty = rows.filter((row) =>
      Array.isArray(row.linked_personas)
        ? row.linked_personas.includes(personaId)
        : false,
    );
    if (dirty.length === 0) return;

    for (const row of dirty) {
      row.linked_personas = row.linked_personas.filter(
        (id) => id !== personaId,
      );
    }
    await this.lorebooks.save(dirty);
  }

  /**
   * Remove linked character/persona ids that no longer exist.
   */
  private async pruneOrphanLinks(): Promise<void> {
    const rows = await this.lorebooks.find();
    const candidates = rows.filter(
      (row) =>
        (Array.isArray(row.linked_characters) &&
          row.linked_characters.length > 0) ||
        (Array.isArray(row.linked_personas) && row.linked_personas.length > 0),
    );
    if (candidates.length === 0) return;

    const existingCharacters = new Set(
      (await this.characters.find({ select: { id: true } })).map(
        (row) => row.id,
      ),
    );
    const existingPersonas = new Set(
      (await this.personas.find({ select: { id: true } })).map((row) => row.id),
    );
    const dirty: LorebookEntity[] = [];
    for (const row of candidates) {
      const nextCharacters = (row.linked_characters ?? []).filter((id) =>
        existingCharacters.has(id),
      );
      const nextPersonas = (row.linked_personas ?? []).filter((id) =>
        existingPersonas.has(id),
      );
      const charactersChanged =
        nextCharacters.length !== (row.linked_characters ?? []).length;
      const personasChanged =
        nextPersonas.length !== (row.linked_personas ?? []).length;
      if (charactersChanged || personasChanged) {
        row.linked_characters = nextCharacters;
        row.linked_personas = nextPersonas;
        dirty.push(row);
      }
    }
    if (dirty.length > 0) {
      await this.lorebooks.save(dirty);
    }
  }

  async duplicate(id: string): Promise<Lorebook> {
    const source = await this.findOne(id);
    const { id: _id, index_dirty: _dirty, ...rest } = source;
    return this.create({
      ...rest,
      name: `${source.name || "Lorebook"} (copy)`,
      enabled: false,
    });
  }

  async reindexAll(): Promise<{ lorebooks: number; entries: number }> {
    return this.loreIndex.reindexAll();
  }

  async reindexOne(id: string): Promise<{ ok: boolean }> {
    const ok = await this.loreIndex.reindexOne(id);
    return { ok };
  }

  async setIndexDirty(id: string, dirty: boolean): Promise<void> {
    const row = await this.lorebooks.findOneBy({ id });
    if (!row) return;
    if (row.index_dirty === dirty) return;
    row.index_dirty = dirty;
    await this.lorebooks.save(row);
  }

  async listDirtyIds(): Promise<string[]> {
    const rows = await this.lorebooks.find({
      where: { index_dirty: true },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async getIndexStatus(): Promise<LoreIndexStatus> {
    const list = await this.findAll();
    const dirtyIds = list.filter((item) => item.index_dirty).map((item) => item.id);
    let indexedRows = 0;
    try {
      indexedRows = await this.lancedb.countRows();
    } catch {
      indexedRows = 0;
    }
    return {
      indexed_rows: indexedRows,
      lorebook_count: list.length,
      dirty_count: dirtyIds.length,
      dirty_ids: dirtyIds,
    };
  }

  /**
   * Handler for the built-in `search_lorebook` tool (and local preview API).
   */
  async searchLorebook(input: {
    query: string;
    category?: string;
    lorebook_ids?: string[];
  }): Promise<{ result: string }> {
    const books: Lorebook[] = [];
    if (input.lorebook_ids?.length) {
      for (const id of input.lorebook_ids) {
        books.push(await this.findOne(id));
      }
    } else {
      const list = await this.findAll();
      for (const item of list) {
        books.push(await this.findOne(item.id));
      }
    }
    const result = await this.loreRetrieval.searchLorebookTool({
      lorebooks: books,
      query: input.query,
      category: input.category,
    });
    return { result };
  }

  private toLorebook(row: LorebookEntity): Lorebook {
    return {
      id: row.id,
      ...normalizeLorebook({
        name: row.name,
        description: row.description,
        enabled: row.enabled,
        global: row.global,
        category: row.category,
        linked_characters: row.linked_characters,
        linked_personas: row.linked_personas,
        scan_depth: row.scan_depth,
        token_budget: row.token_budget,
        recursive_scanning: row.recursive_scanning,
        extensions: row.extensions,
        entries: row.entries,
      }),
      index_dirty: Boolean(row.index_dirty),
    };
  }

  private toListItem(row: LorebookEntity): LorebookListItem {
    const lorebook = this.toLorebook(row);
    return {
      id: lorebook.id,
      name: lorebook.name,
      description: lorebook.description,
      enabled: lorebook.enabled,
      global: lorebook.global,
      category: lorebook.category,
      linked_characters: lorebook.linked_characters,
      linked_personas: lorebook.linked_personas,
      scan_depth: lorebook.scan_depth,
      token_budget: lorebook.token_budget,
      recursive_scanning: lorebook.recursive_scanning,
      index_dirty: lorebook.index_dirty,
      entry_count: lorebook.entries.length,
    };
  }
}
