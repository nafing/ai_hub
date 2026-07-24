import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
import {
  CHARA_CARD_SPEC,
  CHARA_CARD_SPEC_VERSION,
  normalizeCharacterCardData,
  type Character,
  type CharacterListItem,
  type CreateCharacterInput,
  type UpdateCharacterInput,
} from "@ai-hub/shared";
import { LorebooksService } from "../lorebooks/lorebooks.service";
import { CharacterEntity } from "./character.entity";
import {
  avatarExists,
  avatarFilePath,
  copyAvatarFile,
  deleteAvatarFile,
  writeAvatarPng,
} from "./avatar-storage";

@Injectable()
export class CharactersService {
  constructor(
    @InjectRepository(CharacterEntity)
    private readonly characters: Repository<CharacterEntity>,
    private readonly lorebooks: LorebooksService,
  ) {}

  async findAll(): Promise<CharacterListItem[]> {
    const rows = await this.characters.find({
      order: { name: "ASC" },
    });
    return Promise.all(rows.map((row) => this.toListItem(row)));
  }

  async findOne(id: string): Promise<Character> {
    const row = await this.characters.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Character ${id} not found`);
    }
    return this.toCharacter(row);
  }

  async create(input: CreateCharacterInput): Promise<Character> {
    const data = normalizeCharacterCardData(input.data);
    const id = randomUUID();
    const entity = this.characters.create({
      id,
      avatar: null,
      name: data.name,
      data,
    });
    const saved = await this.characters.save(entity);
    return this.toCharacter(saved);
  }

  async update(id: string, input: UpdateCharacterInput): Promise<Character> {
    const row = await this.characters.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Character ${id} not found`);
    }

    if (input.data !== undefined) {
      row.data = normalizeCharacterCardData(input.data);
      row.name = row.data.name;
    }

    const saved = await this.characters.save(row);
    return this.toCharacter(saved);
  }

  async remove(id: string): Promise<void> {
    const row = await this.characters.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Character ${id} not found`);
    }
    await this.lorebooks.unlinkCharacter(id);
    await deleteAvatarFile(id);
    await this.characters.delete({ id });
  }

  async duplicate(id: string): Promise<Character> {
    const source = await this.findOne(id);
    const data = normalizeCharacterCardData({
      ...source.data,
      name: `${source.data.name || "Character"} (copy)`,
    });
    const created = await this.create({
      spec: CHARA_CARD_SPEC,
      spec_version: CHARA_CARD_SPEC_VERSION,
      data,
    });
    if (await copyAvatarFile(id, created.id)) {
      await this.characters.update(
        { id: created.id },
        { avatar: this.avatarRelativePath(created.id) },
      );
    }
    return this.findOne(created.id);
  }

  async getAvatarStream(id: string): Promise<StreamableFile> {
    const row = await this.characters.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Character ${id} not found`);
    }
    if (!(await avatarExists(id))) {
      throw new NotFoundException(`Avatar for character ${id} not found`);
    }
    return new StreamableFile(createReadStream(avatarFilePath(id)), {
      type: "image/png",
      disposition: `inline; filename="${id}.png"`,
    });
  }

  async setAvatar(id: string, buffer: Buffer): Promise<Character> {
    const row = await this.characters.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Character ${id} not found`);
    }
    try {
      await writeAvatarPng(id, buffer);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid avatar PNG",
      );
    }
    row.avatar = this.avatarRelativePath(id);
    const saved = await this.characters.save(row);
    return this.toCharacter(saved);
  }

  async clearAvatar(id: string): Promise<Character> {
    const row = await this.characters.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Character ${id} not found`);
    }
    await deleteAvatarFile(id);
    row.avatar = null;
    const saved = await this.characters.save(row);
    return this.toCharacter(saved);
  }

  /** Public API path used by clients for <img src>. */
  private avatarPublicUrl(characterId: string): string {
    return `/characters/${characterId}/avatar`;
  }

  private avatarRelativePath(characterId: string): string {
    return `characters/${characterId}.png`;
  }

  private async toCharacter(row: CharacterEntity): Promise<Character> {
    const data = normalizeCharacterCardData(row.data ?? {});
    const hasAvatar = await avatarExists(row.id);
    return {
      id: row.id,
      avatar: hasAvatar ? this.avatarPublicUrl(row.id) : null,
      spec: CHARA_CARD_SPEC,
      spec_version: CHARA_CARD_SPEC_VERSION,
      data,
    };
  }

  private async toListItem(row: CharacterEntity): Promise<CharacterListItem> {
    const character = await this.toCharacter(row);
    return {
      id: character.id,
      avatar: character.avatar,
      name: character.data.name,
      description: character.data.description,
      creator: character.data.creator,
      character_version: character.data.character_version,
      tags: character.data.tags,
    };
  }
}
