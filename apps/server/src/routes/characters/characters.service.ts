import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
import {
  CHARA_CARD_SPEC,
  CHARA_CARD_SPEC_VERSION,
  createCharacterVersion,
  nextCharacterVersionLabel,
  normalizeCharacterCardData,
  normalizeCharacterVersions,
  type Character,
  type CharacterGalleryImage,
  type CharacterGalleryImageSource,
  type CharacterListItem,
  type CreateCharacterInput,
  type UpdateCharacterInput,
} from "@ai-hub/shared";
import { CharacterFoldersService } from "../character-folders/character-folders.service";
import { LorebooksService } from "../lorebooks/lorebooks.service";
import { CharacterEntity } from "./character.entity";
import { imageApiPaths } from "../images/paths";
import {
  characterAvatarExists,
  copyCharacterAvatarFile,
  deleteCharacterAvatarFile,
  writeCharacterAvatarPng,
} from "../images/storage/character-avatars";
import {
  characterGalleryImageExists,
  copyCharacterGallery,
  deleteCharacterGalleryDir,
  deleteCharacterGalleryImageFile,
  normalizeGalleryRecords,
  toPublicGalleryImage,
  writeCharacterGalleryImage,
  type CharacterGalleryImageRecord,
} from "../images/storage/character-gallery";

@Injectable()
export class CharactersService {
  constructor(
    @InjectRepository(CharacterEntity)
    private readonly characters: Repository<CharacterEntity>,
    private readonly lorebooks: LorebooksService,
    private readonly characterFolders: CharacterFoldersService,
  ) {}

  async findAll(): Promise<CharacterListItem[]> {
    const rows = await this.characters.find({
      order: { name: "ASC" },
    });
    return Promise.all(rows.map((row) => this.toListItem(row)));
  }

  async findOne(id: string): Promise<Character> {
    const row = await this.requireRow(id);
    return this.toCharacter(row);
  }

  async create(input: CreateCharacterInput): Promise<Character> {
    const data = normalizeCharacterCardData(input.data);
    const version = createCharacterVersion({
      data,
      label: data.character_version,
    });
    const id = randomUUID();
    const entity = this.characters.create({
      id,
      avatar: null,
      gallery: [],
      name: version.data.name,
      data: version.data,
      active_version_id: version.id,
      versions: [version],
    });
    const saved = await this.characters.save(entity);
    return this.toCharacter(saved);
  }

  async update(id: string, input: UpdateCharacterInput): Promise<Character> {
    const row = await this.requireRow(id);
    const normalized = normalizeCharacterVersions({
      data: row.data,
      versions: row.versions,
      active_version_id: row.active_version_id,
    });
    let versions = normalized.versions;
    let activeVersionId = normalized.active_version_id;

    if (input.active_version_id) {
      if (!versions.some((version) => version.id === input.active_version_id)) {
        throw new BadRequestException(
          `Version ${input.active_version_id} not found`,
        );
      }
      activeVersionId = input.active_version_id;
    }

    if (input.data !== undefined) {
      const nextData = normalizeCharacterCardData(input.data);
      const now = new Date().toISOString();

      if (input.create_version) {
        const label =
          input.version_label?.trim() ||
          nextData.character_version.trim() ||
          nextCharacterVersionLabel(versions.map((version) => version.label));
        const created = createCharacterVersion({
          data: nextData,
          label,
        });
        versions = [...versions, created];
        activeVersionId = created.id;
      } else {
        versions = versions.map((version) => {
          if (version.id !== activeVersionId) return version;
          const label =
            input.version_label?.trim() ||
            nextData.character_version.trim() ||
            version.label;
          return {
            ...version,
            label,
            updated_at: now,
            data: normalizeCharacterCardData({
              ...nextData,
              character_version: label,
            }),
          };
        });
      }
    } else if (input.version_label?.trim()) {
      const label = input.version_label.trim();
      const now = new Date().toISOString();
      versions = versions.map((version) => {
        if (version.id !== activeVersionId) return version;
        return {
          ...version,
          label,
          updated_at: now,
          data: normalizeCharacterCardData({
            ...version.data,
            character_version: label,
          }),
        };
      });
    }

    const active =
      versions.find((version) => version.id === activeVersionId) ??
      versions[versions.length - 1];

    row.versions = versions;
    row.active_version_id = active.id;
    row.data = active.data;
    row.name = active.data.name;

    const saved = await this.characters.save(row);
    return this.toCharacter(saved);
  }

  async removeVersion(
    id: string,
    versionId: string,
  ): Promise<Character> {
    const row = await this.requireRow(id);
    const normalized = normalizeCharacterVersions({
      data: row.data,
      versions: row.versions,
      active_version_id: row.active_version_id,
    });

    if (!normalized.versions.some((version) => version.id === versionId)) {
      throw new NotFoundException(
        `Version ${versionId} not found on character ${id}`,
      );
    }
    if (normalized.versions.length <= 1) {
      throw new BadRequestException(
        "Cannot delete the only remaining character version",
      );
    }

    const versions = normalized.versions.filter(
      (version) => version.id !== versionId,
    );
    const activeVersionId =
      normalized.active_version_id === versionId
        ? versions[versions.length - 1].id
        : normalized.active_version_id;
    const active =
      versions.find((version) => version.id === activeVersionId) ??
      versions[versions.length - 1];

    row.versions = versions;
    row.active_version_id = active.id;
    row.data = active.data;
    row.name = active.data.name;

    const saved = await this.characters.save(row);
    return this.toCharacter(saved);
  }

  async remove(id: string): Promise<void> {
    const row = await this.requireRow(id);
    await this.lorebooks.unlinkCharacter(id);
    await this.characterFolders.unlinkCharacter(id);
    await deleteCharacterAvatarFile(id);
    await deleteCharacterGalleryDir(id);
    await this.characters.delete({ id: row.id });
  }

  async duplicate(id: string): Promise<Character> {
    const source = await this.findOne(id);
    const sourceRow = await this.requireRow(id);
    const now = new Date().toISOString();
    const versions = source.versions.map((version) =>
      createCharacterVersion({
        data: {
          ...version.data,
          name: `${version.data.name || "Character"} (copy)`,
        },
        label: version.label,
        created_at: now,
        updated_at: now,
      }),
    );
    const activeIndex = Math.max(
      0,
      source.versions.findIndex(
        (version) => version.id === source.active_version_id,
      ),
    );
    const active = versions[activeIndex] ?? versions[versions.length - 1];

    const createdId = randomUUID();
    const copiedGallery = await copyCharacterGallery(
      id,
      createdId,
      normalizeGalleryRecords(sourceRow.gallery),
    );
    const entity = this.characters.create({
      id: createdId,
      avatar: null,
      gallery: copiedGallery,
      name: active.data.name,
      data: active.data,
      active_version_id: active.id,
      versions,
    });
    await this.characters.save(entity);

    if (await copyCharacterAvatarFile(id, createdId)) {
      await this.characters.update(
        { id: createdId },
        { avatar: this.avatarRelativePath(createdId) },
      );
    }
    return this.findOne(createdId);
  }

  async setAvatar(id: string, buffer: Buffer): Promise<Character> {
    const row = await this.requireRow(id);
    try {
      await writeCharacterAvatarPng(id, buffer);
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
    const row = await this.requireRow(id);
    await deleteCharacterAvatarFile(id);
    row.avatar = null;
    const saved = await this.characters.save(row);
    return this.toCharacter(saved);
  }

  async listGallery(id: string): Promise<CharacterGalleryImage[]> {
    const row = await this.requireRow(id);
    return this.publicGallery(row);
  }

  async addGalleryImage(
    id: string,
    buffer: Buffer,
    options: {
      mime: string;
      name: string;
      source?: CharacterGalleryImageSource;
      prompt?: string;
    },
  ): Promise<Character> {
    const row = await this.requireRow(id);
    const imageId = randomUUID();
    let record: CharacterGalleryImageRecord;
    try {
      record = await writeCharacterGalleryImage({
        characterId: id,
        imageId,
        buffer,
        mime: options.mime,
        name: options.name,
        source: options.source,
        prompt: options.prompt,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid gallery image",
      );
    }
    row.gallery = [...normalizeGalleryRecords(row.gallery), record];
    const saved = await this.characters.save(row);
    return this.toCharacter(saved);
  }

  async removeGalleryImage(id: string, imageId: string): Promise<Character> {
    const row = await this.requireRow(id);
    const gallery = normalizeGalleryRecords(row.gallery);
    const record = gallery.find((item) => item.id === imageId);
    if (!record) {
      throw new NotFoundException(
        `Gallery image ${imageId} for character ${id} not found`,
      );
    }
    await deleteCharacterGalleryImageFile(id, record);
    row.gallery = gallery.filter((item) => item.id !== imageId);
    const saved = await this.characters.save(row);
    return this.toCharacter(saved);
  }

  private async requireRow(id: string): Promise<CharacterEntity> {
    const row = await this.characters.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Character ${id} not found`);
    }
    return row;
  }

  /** Public API path used by clients for <img src>. */
  private avatarPublicUrl(characterId: string): string {
    return imageApiPaths.characterAvatar(characterId);
  }

  private avatarRelativePath(characterId: string): string {
    return `characters/${characterId}.png`;
  }

  private async publicGallery(
    row: CharacterEntity,
  ): Promise<CharacterGalleryImage[]> {
    const records = normalizeGalleryRecords(row.gallery);
    const existing: CharacterGalleryImageRecord[] = [];
    for (const record of records) {
      if (await characterGalleryImageExists(row.id, record)) {
        existing.push(record);
      }
    }
    if (existing.length !== records.length) {
      row.gallery = existing;
      await this.characters.save(row);
    }
    return existing.map((record) => toPublicGalleryImage(row.id, record));
  }

  private async toCharacter(row: CharacterEntity): Promise<Character> {
    const normalized = normalizeCharacterVersions({
      data: row.data ?? {},
      versions: row.versions,
      active_version_id: row.active_version_id,
    });

    // Persist migration for legacy rows without versions.
    const needsMigration =
      !Array.isArray(row.versions) ||
      row.versions.length === 0 ||
      !row.active_version_id;
    if (needsMigration) {
      row.versions = normalized.versions;
      row.active_version_id = normalized.active_version_id;
      row.data = normalized.data;
      row.name = normalized.data.name;
      await this.characters.save(row);
    }

    const hasAvatar = await characterAvatarExists(row.id);
    return {
      id: row.id,
      avatar: hasAvatar ? this.avatarPublicUrl(row.id) : null,
      gallery: await this.publicGallery(row),
      spec: CHARA_CARD_SPEC,
      spec_version: CHARA_CARD_SPEC_VERSION,
      data: normalized.data,
      active_version_id: normalized.active_version_id,
      versions: normalized.versions,
    };
  }

  private async toListItem(row: CharacterEntity): Promise<CharacterListItem> {
    const hasAvatar = await characterAvatarExists(row.id);
    const normalized = normalizeCharacterVersions({
      data: row.data ?? {},
      versions: row.versions,
      active_version_id: row.active_version_id,
    });
    return {
      id: row.id,
      avatar: hasAvatar ? this.avatarPublicUrl(row.id) : null,
      name: normalized.data.name,
      description: normalized.data.description,
      creator: normalized.data.creator,
      character_version: normalized.data.character_version,
      tags: normalized.data.tags,
      name_color: normalized.data.name_color ?? null,
      dialogue_color: normalized.data.dialogue_color ?? null,
      message_box_color: normalized.data.message_box_color ?? null,
      botbooru_post_id: normalized.data.botbooru_post_id ?? null,
    };
  }
}
