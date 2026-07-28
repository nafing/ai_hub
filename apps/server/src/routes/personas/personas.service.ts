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
  normalizePersona,
  type CreatePersonaInput,
  type Persona,
  type PersonaListItem,
  type UpdatePersonaInput,
} from "@ai-hub/shared";
import { LorebooksService } from "../lorebooks/lorebooks.service";
import { PersonaEntity } from "./persona.entity";
import {
  avatarExists,
  avatarFilePath,
  copyAvatarFile,
  deleteAvatarFile,
  writeAvatarPng,
} from "./avatar-storage";

@Injectable()
export class PersonasService {
  constructor(
    @InjectRepository(PersonaEntity)
    private readonly personas: Repository<PersonaEntity>,
    private readonly lorebooks: LorebooksService,
  ) {}

  async findAll(): Promise<PersonaListItem[]> {
    const rows = await this.personas.find({
      order: { is_default: "DESC", name: "ASC" },
    });
    return Promise.all(rows.map((row) => this.toListItem(row)));
  }

  async findOne(id: string): Promise<Persona> {
    const row = await this.personas.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Persona ${id} not found`);
    }
    return this.toPersona(row);
  }

  async create(input: CreatePersonaInput): Promise<Persona> {
    const normalized = normalizePersona(input);
    const count = await this.personas.count();
    if (count === 0) {
      normalized.is_default = true;
    }
    if (normalized.is_default) {
      await this.clearDefaults();
    }
    const id = randomUUID();
    const entity = this.personas.create({
      id,
      avatar: null,
      ...normalized,
    });
    const saved = await this.personas.save(entity);
    return this.toPersona(saved);
  }

  async update(id: string, input: UpdatePersonaInput): Promise<Persona> {
    const row = await this.personas.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Persona ${id} not found`);
    }

    const merged = normalizePersona({
      name: input.name ?? row.name,
      description: input.description ?? row.description,
      personality: input.personality ?? row.personality,
      about_me: input.about_me ?? row.about_me,
      notes: input.notes ?? row.notes,
      is_default:
        input.is_default !== undefined ? input.is_default : row.is_default,
    });

    if (merged.is_default && !row.is_default) {
      await this.clearDefaults();
    }

    Object.assign(row, merged);
    const saved = await this.personas.save(row);
    return this.toPersona(saved);
  }

  async remove(id: string): Promise<void> {
    const row = await this.personas.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Persona ${id} not found`);
    }
    await this.lorebooks.unlinkPersona(id);
    await deleteAvatarFile(id);
    await this.personas.delete({ id });
  }

  async duplicate(id: string): Promise<Persona> {
    const source = await this.findOne(id);
    const { id: _id, avatar: _avatar, ...rest } = source;
    const created = await this.create({
      ...rest,
      name: `${source.name || "Persona"} (copy)`,
      is_default: false,
    });
    if (await copyAvatarFile(id, created.id)) {
      await this.personas.update(
        { id: created.id },
        { avatar: this.avatarRelativePath(created.id) },
      );
    }
    return this.findOne(created.id);
  }

  async getAvatarStream(id: string): Promise<StreamableFile> {
    const row = await this.personas.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Persona ${id} not found`);
    }
    if (!(await avatarExists(id))) {
      throw new NotFoundException(`Avatar for persona ${id} not found`);
    }
    return new StreamableFile(createReadStream(avatarFilePath(id)), {
      type: "image/png",
      disposition: `inline; filename="${id}.png"`,
    });
  }

  async setAvatar(id: string, buffer: Buffer): Promise<Persona> {
    const row = await this.personas.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Persona ${id} not found`);
    }
    try {
      await writeAvatarPng(id, buffer);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid avatar PNG",
      );
    }
    row.avatar = this.avatarRelativePath(id);
    const saved = await this.personas.save(row);
    return this.toPersona(saved);
  }

  async clearAvatar(id: string): Promise<Persona> {
    const row = await this.personas.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Persona ${id} not found`);
    }
    await deleteAvatarFile(id);
    row.avatar = null;
    const saved = await this.personas.save(row);
    return this.toPersona(saved);
  }

  private avatarPublicUrl(personaId: string): string {
    return `/personas/${personaId}/avatar`;
  }

  private avatarRelativePath(personaId: string): string {
    return `personas/${personaId}.png`;
  }

  private async clearDefaults(): Promise<void> {
    await this.personas
      .createQueryBuilder()
      .update(PersonaEntity)
      .set({ is_default: false })
      .where("is_default = :flag", { flag: true })
      .execute();
  }

  private async toPersona(row: PersonaEntity): Promise<Persona> {
    const hasAvatar = await avatarExists(row.id);
    return {
      id: row.id,
      avatar: hasAvatar ? this.avatarPublicUrl(row.id) : null,
      ...normalizePersona({
        name: row.name,
        description: row.description,
        personality: row.personality,
        about_me: row.about_me ?? "",
        notes: row.notes,
        is_default: row.is_default,
      }),
    };
  }

  private async toListItem(row: PersonaEntity): Promise<PersonaListItem> {
    const persona = await this.toPersona(row);
    return {
      id: persona.id,
      avatar: persona.avatar,
      name: persona.name,
      description: persona.description,
      personality: persona.personality,
      about_me: persona.about_me,
      notes: persona.notes,
      is_default: persona.is_default,
    };
  }
}
