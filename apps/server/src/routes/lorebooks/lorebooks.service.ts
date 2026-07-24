import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
import {
  normalizeLorebook,
  type CreateLorebookInput,
  type Lorebook,
  type LorebookListItem,
  type UpdateLorebookInput,
} from "@ai-hub/shared";
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
    });
    const saved = await this.lorebooks.save(entity);
    return this.toLorebook(saved);
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
    const saved = await this.lorebooks.save(row);
    return this.toLorebook(saved);
  }

  async remove(id: string): Promise<void> {
    const row = await this.lorebooks.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Lorebook ${id} not found`);
    }
    await this.lorebooks.delete({ id });
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
    const { id: _id, ...rest } = source;
    return this.create({
      ...rest,
      name: `${source.name || "Lorebook"} (copy)`,
      enabled: false,
    });
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
      entry_count: lorebook.entries.length,
    };
  }
}
