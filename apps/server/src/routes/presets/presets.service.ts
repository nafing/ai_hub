import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Not, Repository } from "typeorm";
import type {
  CreatePresetInput,
  Preset,
  PresetCategory,
  PresetListItem,
  PresetMarkerContent,
  PresetVariableValues,
  Section,
  SectionKind,
  UpdatePresetInput,
  Variable,
  WrapFormat,
} from "@ai-hub/shared";
import {
  DEFAULT_PRESETS,
  NEEDS_PRESET_VARIABLES_CODE,
  PRESET_CATEGORIES,
  SECTION_KIND_LABELS,
  SECTION_KINDS,
  defaultPresetId,
  substituteVariables,
  unresolvedPresetVariables,
} from "@ai-hub/shared";
import { ConnectionsService } from "../connections/connections.service";
import {
  completeWithConnectionAndPreset,
  type CompleteWithConnectionResult,
} from "../../utils/openrouter";
import { PresetEntity } from "./preset.entity";

export type TestPresetInput = {
  connectionId?: string;
  variables?: PresetVariableValues;
  markers?: PresetMarkerContent;
  userMessage?: string;
  draft?: {
    wrap_format: WrapFormat;
    sections: Section[];
  };
};

@Injectable()
export class PresetsService implements OnModuleInit {
  private readonly logger = new Logger(PresetsService.name);

  constructor(
    @InjectRepository(PresetEntity)
    private readonly presets: Repository<PresetEntity>,
    private readonly connections: ConnectionsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultPresets();
  }

  /**
   * Insert missing built-in presets (`default:*`) and refresh their prompt
   * sections from code so built-in instruction updates (e.g. import mode /
   * generator_prompt split) apply on restart. Variables / is_default are left
   * alone when the row exists so Setup Variables selections survive — except
   * option labels/values are synced from code when option ids match (keeps
   * anime "NOT photorealistic" wording without wiping selected).
   */
  async seedDefaultPresets(): Promise<void> {
    let created = 0;
    let refreshed = 0;
    for (const def of DEFAULT_PRESETS) {
      const id = defaultPresetId(def.key);
      const existing = await this.presets.findOneBy({ id });
      if (existing) {
        existing.name = def.name;
        existing.description = def.description;
        existing.wrap_format = def.wrap_format;
        existing.author = def.author;
        existing.groups = def.groups ?? [];
        existing.sections = def.sections ?? [];
        existing.variables = this.mergeDefaultVariableOptions(
          existing.variables ?? [],
          def.variables ?? [],
        );
        await this.presets.save(existing);
        refreshed += 1;
        continue;
      }

      const { key: _key, ...input } = def;
      const category = this.normalizeCategory(input.category);

      const categoryHasDefault = await this.presets.exists({
        where: { category, is_default: true },
      });

      if (input.is_default && !categoryHasDefault) {
        await this.clearDefaults(category);
      }

      await this.presets.save(
        this.presets.create({
          id,
          ...input,
          category,
          is_default: Boolean(input.is_default) && !categoryHasDefault,
          groups: input.groups ?? [],
          sections: input.sections ?? [],
          variables: input.variables ?? [],
        }),
      );
      created += 1;
    }

    if (created > 0 || refreshed > 0) {
      this.logger.log(
        `Default presets: ${created} created, ${refreshed} sections refreshed`,
      );
    }
  }

  async findAll(): Promise<PresetListItem[]> {
    const rows = await this.presets.find({ order: { name: "ASC" } });
    return rows.map((row) => this.toListItem(row));
  }

  async findOne(id: string): Promise<Preset> {
    const row = await this.presets.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Preset ${id} not found`);
    }
    return this.toPreset(row);
  }

  async findDefault(category: PresetCategory): Promise<Preset> {
    const normalized = this.normalizeCategory(category);
    const row = await this.presets.findOneBy({
      category: normalized,
      is_default: true,
    });
    if (!row) {
      throw new NotFoundException(
        `No default preset configured for category "${normalized}"`,
      );
    }
    return this.toPreset(row);
  }

  async create(input: CreatePresetInput): Promise<Preset> {
    const category = this.normalizeCategory(input.category);
    const shouldBeDefault =
      input.is_default ||
      (await this.presets.countBy({ category })) === 0;

    if (shouldBeDefault) {
      await this.clearDefaults(category);
    }

    const entity = this.presets.create({
      id: randomUUID(),
      ...input,
      category,
      groups: input.groups ?? [],
      sections: input.sections ?? [],
      variables: input.variables ?? [],
      is_default: shouldBeDefault,
    });
    const saved = await this.presets.save(entity);
    return this.toPreset(saved);
  }

  async update(id: string, input: UpdatePresetInput): Promise<Preset> {
    const row = await this.presets.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Preset ${id} not found`);
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

    Object.assign(row, input);
    row.category = nextCategory;
    row.is_default = Boolean(nextIsDefault);
    if (input.groups !== undefined) row.groups = input.groups;
    if (input.sections !== undefined) row.sections = input.sections;
    if (input.variables !== undefined) row.variables = input.variables;
    const saved = await this.presets.save(row);

    if (
      previousIsDefault &&
      previousCategory !== nextCategory
    ) {
      await this.ensureCategoryHasDefault(previousCategory);
    }

    return this.toPreset(saved);
  }

  async remove(id: string): Promise<void> {
    const row = await this.presets.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Preset ${id} not found`);
    }

    const wasDefault = row.is_default;
    const category = this.normalizeCategory(row.category);
    await this.presets.delete({ id });

    if (wasDefault) {
      await this.ensureCategoryHasDefault(category);
    }
  }

  async duplicate(id: string): Promise<Preset> {
    const source = await this.findOne(id);
    const { id: _id, ...rest } = source;
    return this.create({
      ...rest,
      name: `${source.name} (copy)`,
      is_default: false,
      sections: source.sections.map((section) => ({
        ...section,
        id: randomUUID(),
      })),
      variables: source.variables.map((variable) => ({
        ...variable,
        id: randomUUID(),
        options: variable.options.map((option) => ({
          ...option,
          id: randomUUID(),
        })),
      })),
    });
  }

  async test(
    id: string,
    input: TestPresetInput,
  ): Promise<
    Pick<
      CompleteWithConnectionResult,
      "content" | "thinking" | "reply" | "finishReason" | "model" | "messages"
    >
  > {
    const saved = await this.findOne(id);
    const presetBody = input.draft
      ? {
          wrap_format: input.draft.wrap_format,
          sections: (input.draft.sections ?? []).map((section) =>
            this.normalizeSection(section),
          ),
        }
      : saved;

    // Always use persisted (normalized) variable defs — draft.variables is
    // stripped by ValidationPipe whitelist and arrives as junk.
    const unresolved = unresolvedPresetVariables(
      saved.variables,
      input.variables,
    );
    if (unresolved.length > 0) {
      throw new ConflictException({
        code: NEEDS_PRESET_VARIABLES_CODE,
        presetId: saved.id,
        variables: unresolved,
      });
    }

    const connection = input.connectionId
      ? await this.connections.findOne(input.connectionId)
      : await this.connections.findDefault("llm");

    if (!connection.api_key.trim()) {
      throw new BadRequestException(
        `Connection "${connection.name || connection.id}" has no API key`,
      );
    }
    if (!connection.model.trim()) {
      throw new BadRequestException(
        `Connection "${connection.name || connection.id}" has no model`,
      );
    }

    const userMessage = input.userMessage?.trim();
    const resolvedUserMessage = userMessage
      ? substituteVariables(userMessage, input.variables).trim()
      : "";
    const result = await completeWithConnectionAndPreset(
      connection,
      presetBody,
      {
        prompt: {
          variables: input.variables,
          markers: input.markers,
        },
        appendMessages: resolvedUserMessage
          ? [{ role: "user", content: resolvedUserMessage }]
          : undefined,
      },
    );

    return {
      content: result.content,
      thinking: result.thinking,
      reply: result.reply,
      finishReason: result.finishReason,
      model: result.model,
      messages: result.messages,
    };
  }

  private async clearDefaults(
    category: PresetCategory,
    exceptId?: string,
  ): Promise<void> {
    await this.presets.update(
      exceptId
        ? { category, id: Not(exceptId), is_default: true }
        : { category, is_default: true },
      { is_default: false },
    );
  }

  private async ensureCategoryHasDefault(
    category: PresetCategory,
  ): Promise<void> {
    const existingDefault = await this.presets.findOneBy({
      category,
      is_default: true,
    });
    if (existingDefault) return;

    const next = await this.presets.find({
      where: { category },
      order: { name: "ASC" },
      take: 1,
    });
    if (next[0]) {
      next[0].is_default = true;
      await this.presets.save(next[0]);
    }
  }

  private mergeDefaultVariableOptions(
    existing: Variable[],
    defaults: Variable[],
  ): Variable[] {
    if (!defaults.length) return existing;
    const byId = new Map(defaults.map((variable) => [variable.id, variable]));
    return existing.map((variable) => {
      const def = byId.get(variable.id);
      if (!def) return variable;
      const optionById = new Map(def.options.map((option) => [option.id, option]));
      const options = variable.options.map((option) => {
        const next = optionById.get(option.id);
        if (!next) return option;
        return {
          ...option,
          label: next.label,
          value: next.value,
        };
      });
      for (const option of def.options) {
        if (!options.some((entry) => entry.id === option.id)) {
          options.push({ ...option });
        }
      }
      // If nothing was ever selected, adopt code defaults (e.g. anime).
      const selected =
        Array.isArray(variable.selected) && variable.selected.length > 0
          ? variable.selected
          : def.selected ?? [];
      return { ...variable, options, selected };
    });
  }

  private toPreset(row: PresetEntity): Preset {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      wrap_format: row.wrap_format,
      category: this.normalizeCategory(row.category),
      is_default: Boolean(row.is_default),
      author: row.author,
      groups: row.groups ?? [],
      sections: (row.sections ?? []).map((section) =>
        this.normalizeSection(section),
      ),
      variables: (row.variables ?? []).map((variable) =>
        this.normalizeVariable(variable),
      ),
    };
  }

  private normalizeCategory(
    raw: PresetCategory | string | null | undefined,
  ): PresetCategory {
    return (PRESET_CATEGORIES as readonly string[]).includes(raw ?? "")
      ? (raw as PresetCategory)
      : "roleplay";
  }

  private normalizeSection(raw: Section | Record<string, unknown>): Section {
    const base = raw as Partial<Section>;
    const kind =
      base.kind && (SECTION_KINDS as readonly string[]).includes(base.kind)
        ? (base.kind as SectionKind)
        : "prompt_block";

    return {
      id: String(base.id ?? randomUUID()),
      kind,
      name: String(base.name ?? SECTION_KIND_LABELS[kind]),
      role:
        base.role === "user" ||
        base.role === "assistant" ||
        base.role === "system"
          ? base.role
          : "system",
      content: String(base.content ?? ""),
      position:
        base.position === "ordered" || typeof base.position === "number"
          ? base.position
          : "ordered",
      group: String(base.group ?? ""),
    };
  }

  private normalizeVariable(raw: Variable | Record<string, unknown>): Variable {
    const base = raw as Partial<Variable> & {
      list?: string[];
      type?: string;
      default_value?: string;
    };

    if (Array.isArray(base.options)) {
      const selected = Array.isArray(base.selected)
        ? base.selected.map(String).filter(Boolean)
        : typeof base.default_value === "string" && base.default_value
          ? [base.default_value]
          : [];
      return {
        id: String(base.id ?? randomUUID()),
        variable_name: String(base.variable_name ?? ""),
        question: String(base.question ?? ""),
        multi_select: Boolean(base.multi_select),
        presentation:
          base.presentation === "auto" ||
          base.presentation === "radios" ||
          base.presentation === "dropdown"
            ? base.presentation
            : "radios",
        alphabetical: Boolean(base.alphabetical),
        selected,
        options: base.options.map((option) => ({
          id: String(option.id ?? randomUUID()),
          label: String(option.label ?? ""),
          value: String(option.value ?? ""),
        })),
      };
    }

    // Migrate legacy { type, list: string[], default_value } shape.
    const legacyList = Array.isArray(base.list) ? base.list : [];
    const legacyDefault =
      typeof base.default_value === "string" && base.default_value
        ? [base.default_value]
        : [];
    return {
      id: String(base.id ?? randomUUID()),
      variable_name: String(base.variable_name ?? ""),
      question: String(base.question ?? ""),
      multi_select: false,
      presentation: "radios",
      alphabetical: false,
      selected: legacyDefault,
      options: legacyList.map((value) => ({
        id: randomUUID(),
        label: value,
        value,
      })),
    };
  }

  private toListItem(row: PresetEntity): PresetListItem {
    const preset = this.toPreset(row);
    return {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      wrap_format: preset.wrap_format,
      category: preset.category,
      is_default: preset.is_default,
      author: preset.author,
      sections_count: preset.sections.length,
      variables_count: preset.variables.length,
    };
  }
}
