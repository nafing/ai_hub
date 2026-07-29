import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { In, Repository } from "typeorm";
import {
  normalizeCharacterFolder,
  type CharacterFolder,
  type CreateCharacterFolderInput,
  type UpdateCharacterFolderInput,
} from "@ai-hub/shared";
import { CharacterEntity } from "../characters/character.entity";
import { CharacterFolderEntity } from "./character-folder.entity";

@Injectable()
export class CharacterFoldersService {
  constructor(
    @InjectRepository(CharacterFolderEntity)
    private readonly folders: Repository<CharacterFolderEntity>,
    @InjectRepository(CharacterEntity)
    private readonly characters: Repository<CharacterEntity>,
  ) {}

  async findAll(): Promise<CharacterFolder[]> {
    await this.pruneOrphanLinks();
    const rows = await this.folders.find({ order: { name: "ASC" } });
    return rows.map((row) => this.toFolder(row));
  }

  async findOne(id: string): Promise<CharacterFolder> {
    await this.pruneOrphanLinks();
    const row = await this.folders.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Character folder ${id} not found`);
    }
    return this.toFolder(row);
  }

  async create(input: CreateCharacterFolderInput): Promise<CharacterFolder> {
    const normalized = normalizeCharacterFolder(input);
    const character_ids = await this.filterExistingCharacterIds(
      normalized.character_ids,
    );
    const entity = this.folders.create({
      id: randomUUID(),
      name: normalized.name || "Untitled folder",
      character_ids,
    });
    const saved = await this.folders.save(entity);
    return this.toFolder(saved);
  }

  async update(
    id: string,
    input: UpdateCharacterFolderInput,
  ): Promise<CharacterFolder> {
    const row = await this.folders.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Character folder ${id} not found`);
    }

    const normalized = normalizeCharacterFolder({
      name: input.name !== undefined ? input.name : row.name,
      character_ids:
        input.character_ids !== undefined
          ? input.character_ids
          : row.character_ids,
    });

    row.name =
      input.name !== undefined
        ? normalized.name || "Untitled folder"
        : row.name;
    if (input.character_ids !== undefined) {
      row.character_ids = await this.filterExistingCharacterIds(
        normalized.character_ids,
      );
    }

    const saved = await this.folders.save(row);
    return this.toFolder(saved);
  }

  async remove(id: string): Promise<void> {
    const row = await this.folders.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Character folder ${id} not found`);
    }
    await this.folders.delete({ id });
  }

  /** Drop a character id from every folder. */
  async unlinkCharacter(characterId: string): Promise<void> {
    const rows = await this.folders.find();
    const dirty = rows.filter((row) =>
      Array.isArray(row.character_ids)
        ? row.character_ids.includes(characterId)
        : false,
    );
    if (dirty.length === 0) return;

    for (const row of dirty) {
      row.character_ids = row.character_ids.filter((id) => id !== characterId);
    }
    await this.folders.save(dirty);
  }

  private async filterExistingCharacterIds(
    ids: string[],
  ): Promise<string[]> {
    if (ids.length === 0) return [];
    const existing = await this.characters.find({
      where: { id: In(ids) },
      select: { id: true },
    });
    const valid = new Set(existing.map((row) => row.id));
    return ids.filter((id) => valid.has(id));
  }

  private async pruneOrphanLinks(): Promise<void> {
    const rows = await this.folders.find();
    if (rows.length === 0) return;

    const allIds = new Set<string>();
    for (const row of rows) {
      for (const id of row.character_ids ?? []) {
        allIds.add(id);
      }
    }
    if (allIds.size === 0) return;

    const existing = await this.characters.find({
      where: { id: In([...allIds]) },
      select: { id: true },
    });
    const valid = new Set(existing.map((row) => row.id));

    const dirty: CharacterFolderEntity[] = [];
    for (const row of rows) {
      const next = (row.character_ids ?? []).filter((id) => valid.has(id));
      if (next.length !== (row.character_ids ?? []).length) {
        row.character_ids = next;
        dirty.push(row);
      }
    }
    if (dirty.length > 0) {
      await this.folders.save(dirty);
    }
  }

  private toFolder(row: CharacterFolderEntity): CharacterFolder {
    return {
      id: row.id,
      name: row.name ?? "",
      character_ids: Array.isArray(row.character_ids) ? row.character_ids : [],
    };
  }
}
