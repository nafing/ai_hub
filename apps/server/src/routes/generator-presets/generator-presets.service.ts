import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Not, Repository } from "typeorm";
import {
  DEFAULT_GENERATOR_PRESETS,
  GENERATOR_CATEGORIES,
  defaultGeneratorPresetId,
  type CreateGeneratorPresetInput,
  type GeneratorCategory,
  type GeneratorPreset,
  type GeneratorPresetListItem,
  type UpdateGeneratorPresetInput,
} from "@ai-hub/shared";
import { GeneratorPresetEntity } from "./generator-preset.entity";

@Injectable()
export class GeneratorPresetsService implements OnModuleInit {
  private readonly logger = new Logger(GeneratorPresetsService.name);

  constructor(
    @InjectRepository(GeneratorPresetEntity)
    private readonly generatorPresets: Repository<GeneratorPresetEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultGeneratorPresets();
  }

  /**
   * Insert missing built-ins and refresh name/description/prompt/preset_id
   * from code so instruction updates apply on restart. `is_default` is left
   * alone when the row exists so user default choices survive.
   */
  async seedDefaultGeneratorPresets(): Promise<void> {
    let created = 0;
    let refreshed = 0;
    for (const def of DEFAULT_GENERATOR_PRESETS) {
      const id = defaultGeneratorPresetId(def.key);
      const existing = await this.generatorPresets.findOneBy({ id });
      if (existing) {
        existing.name = def.name;
        existing.description = def.description;
        existing.author = def.author;
        existing.category = def.category;
        existing.prompt = def.prompt;
        existing.prompt_create = def.prompt_create;
        existing.prompt_import = def.prompt_import;
        existing.prompt_regenerate = def.prompt_regenerate;
        existing.prompt_rebuild = def.prompt_rebuild;
        existing.preset_id = def.preset_id;
        await this.generatorPresets.save(existing);
        refreshed += 1;
        continue;
      }

      const { key: _key, ...input } = def;
      const category = this.normalizeCategory(input.category);

      const categoryHasDefault = await this.generatorPresets.exists({
        where: { category, is_default: true },
      });

      if (input.is_default && !categoryHasDefault) {
        await this.clearDefaults(category);
      }

      await this.generatorPresets.save(
        this.generatorPresets.create({
          id,
          ...input,
          category,
          is_default: Boolean(input.is_default) && !categoryHasDefault,
        }),
      );
      created += 1;
    }

    if (created > 0 || refreshed > 0) {
      this.logger.log(
        `Default generator presets: ${created} created, ${refreshed} refreshed`,
      );
    }
  }

  async findAll(): Promise<GeneratorPresetListItem[]> {
    const rows = await this.generatorPresets.find({
      order: { category: "ASC", name: "ASC" },
    });
    return rows.map((row) => this.toListItem(row));
  }

  async findOne(id: string): Promise<GeneratorPreset> {
    const row = await this.generatorPresets.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Generator preset ${id} not found`);
    }
    return this.toGeneratorPreset(row);
  }

  async findDefault(category: GeneratorCategory): Promise<GeneratorPreset> {
    const normalized = this.normalizeCategory(category);
    const row = await this.generatorPresets.findOneBy({
      category: normalized,
      is_default: true,
    });
    if (!row) {
      throw new NotFoundException(
        `No default generator preset for category "${normalized}"`,
      );
    }
    return this.toGeneratorPreset(row);
  }

  async create(input: CreateGeneratorPresetInput): Promise<GeneratorPreset> {
    const category = this.normalizeCategory(input.category);
    const shouldBeDefault =
      input.is_default ||
      (await this.generatorPresets.countBy({ category })) === 0;

    if (shouldBeDefault) {
      await this.clearDefaults(category);
    }

    const entity = this.generatorPresets.create({
      id: randomUUID(),
      ...input,
      category,
      preset_id: input.preset_id ?? null,
      is_default: shouldBeDefault,
    });
    const saved = await this.generatorPresets.save(entity);
    return this.toGeneratorPreset(saved);
  }

  async update(
    id: string,
    input: UpdateGeneratorPresetInput,
  ): Promise<GeneratorPreset> {
    const row = await this.generatorPresets.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Generator preset ${id} not found`);
    }

    const previousCategory = this.normalizeCategory(row.category);
    const previousIsDefault = Boolean(row.is_default);
    const nextCategory = this.normalizeCategory(
      input.category ?? row.category,
    );
    const nextIsDefault =
      input.is_default !== undefined ? input.is_default : row.is_default;

    if (nextIsDefault) {
      await this.clearDefaults(nextCategory, id);
    }

    if (input.name !== undefined) row.name = input.name;
    if (input.description !== undefined) row.description = input.description;
    if (input.author !== undefined) row.author = input.author;
    if (input.prompt !== undefined) row.prompt = input.prompt;
    if (input.prompt_create !== undefined) {
      row.prompt_create = input.prompt_create;
    }
    if (input.prompt_import !== undefined) {
      row.prompt_import = input.prompt_import;
    }
    if (input.prompt_regenerate !== undefined) {
      row.prompt_regenerate = input.prompt_regenerate;
    }
    if (input.prompt_rebuild !== undefined) {
      row.prompt_rebuild = input.prompt_rebuild;
    }
    if (input.preset_id !== undefined) row.preset_id = input.preset_id;
    row.category = nextCategory;
    row.is_default = Boolean(nextIsDefault);

    const saved = await this.generatorPresets.save(row);

    if (previousIsDefault && previousCategory !== nextCategory) {
      await this.ensureCategoryHasDefault(previousCategory);
    }

    return this.toGeneratorPreset(saved);
  }

  async remove(id: string): Promise<void> {
    const row = await this.generatorPresets.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Generator preset ${id} not found`);
    }
    const category = this.normalizeCategory(row.category);
    const wasDefault = Boolean(row.is_default);
    await this.generatorPresets.delete({ id });
    if (wasDefault) {
      await this.ensureCategoryHasDefault(category);
    }
  }

  async duplicate(id: string): Promise<GeneratorPreset> {
    const source = await this.findOne(id);
    const { id: _id, ...rest } = source;
    return this.create({
      ...rest,
      name: `${source.name} (copy)`,
      is_default: false,
    });
  }

  private async clearDefaults(
    category: GeneratorCategory,
    exceptId?: string,
  ): Promise<void> {
    await this.generatorPresets.update(
      exceptId
        ? { category, id: Not(exceptId), is_default: true }
        : { category, is_default: true },
      { is_default: false },
    );
  }

  private async ensureCategoryHasDefault(
    category: GeneratorCategory,
  ): Promise<void> {
    const existingDefault = await this.generatorPresets.findOneBy({
      category,
      is_default: true,
    });
    if (existingDefault) return;

    const next = await this.generatorPresets.find({
      where: { category },
      order: { name: "ASC" },
      take: 1,
    });
    if (next[0]) {
      next[0].is_default = true;
      await this.generatorPresets.save(next[0]);
    }
  }

  private normalizeCategory(category: string): GeneratorCategory {
    if (!(GENERATOR_CATEGORIES as readonly string[]).includes(category)) {
      throw new BadRequestException(
        `Unknown generator category "${category}"`,
      );
    }
    return category as GeneratorCategory;
  }

  private toGeneratorPreset(row: GeneratorPresetEntity): GeneratorPreset {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      author: row.author ?? "",
      category: this.normalizeCategory(row.category),
      prompt: row.prompt ?? "",
      prompt_create: row.prompt_create ?? "",
      prompt_import: row.prompt_import ?? "",
      prompt_regenerate: row.prompt_regenerate ?? "",
      prompt_rebuild: row.prompt_rebuild ?? "",
      preset_id: row.preset_id ?? null,
      is_default: Boolean(row.is_default),
    };
  }

  private toListItem(row: GeneratorPresetEntity): GeneratorPresetListItem {
    const preset = this.toGeneratorPreset(row);
    return {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      author: preset.author,
      category: preset.category,
      preset_id: preset.preset_id,
      is_default: preset.is_default,
    };
  }
}
