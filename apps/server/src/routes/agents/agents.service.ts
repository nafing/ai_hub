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
import { Repository } from "typeorm";
import {
  DEFAULT_AGENTS,
  defaultAgentId,
  type Agent,
  type AgentListItem,
  type CreateAgentInput,
  type UpdateAgentInput,
} from "@ai-hub/shared";
import { AgentEntity } from "./agent.entity";

@Injectable()
export class AgentsService implements OnModuleInit {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectRepository(AgentEntity)
    private readonly agents: Repository<AgentEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultAgents();
  }

  async seedDefaultAgents(): Promise<void> {
    let created = 0;
    let promoted = 0;
    let removed = 0;
    const activeSlugs = new Set(DEFAULT_AGENTS.map((def) => def.slug));
    for (const def of DEFAULT_AGENTS) {
      const id = defaultAgentId(def.slug);
      const byId = await this.agents.findOneBy({ id });
      if (byId) {
        if (!byId.is_built_in) {
          byId.is_built_in = true;
          await this.agents.save(byId);
          promoted += 1;
        }
        continue;
      }

      const bySlug = await this.agents.findOneBy({ slug: def.slug });
      if (bySlug) {
        if (!bySlug.is_built_in) {
          bySlug.is_built_in = true;
          await this.agents.save(bySlug);
          promoted += 1;
        }
        continue;
      }

      await this.agents.save(
        this.agents.create({
          id,
          ...def,
          is_built_in: true,
        }),
      );
      created += 1;
    }

    const retiredBuiltIns = await this.agents.find({
      where: { is_built_in: true },
    });
    for (const row of retiredBuiltIns) {
      if (!activeSlugs.has(row.slug)) {
        await this.agents.delete({ id: row.id });
        removed += 1;
      }
    }

    if (created > 0 || promoted > 0 || removed > 0) {
      this.logger.log(
        `Default agents: seeded ${created}, marked built-in ${promoted}, removed ${removed}`,
      );
    }
  }

  async findAll(): Promise<AgentListItem[]> {
    const rows = await this.agents.find({
      order: { is_built_in: "DESC", category: "ASC", name: "ASC" },
    });
    return rows.map((row) => this.toListItem(row));
  }

  async findOne(id: string): Promise<Agent> {
    const row = await this.agents.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Agent ${id} not found`);
    }
    return this.toAgent(row);
  }

  async create(input: CreateAgentInput): Promise<Agent> {
    await this.assertUniqueSlug(input.slug);
    const entity = this.agents.create({
      id: randomUUID(),
      ...this.normalizeInput(input),
      is_built_in: false,
    });
    const saved = await this.agents.save(entity);
    return this.toAgent(saved);
  }

  async update(id: string, input: UpdateAgentInput): Promise<Agent> {
    const row = await this.agents.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Agent ${id} not found`);
    }

    if (input.slug !== undefined && input.slug !== row.slug) {
      if (row.is_built_in) {
        throw new BadRequestException("Built-in agents cannot change slug");
      }
      await this.assertUniqueSlug(input.slug, id);
      row.slug = input.slug;
    }
    if (input.name !== undefined) row.name = input.name;
    if (input.description !== undefined) row.description = input.description;
    if (input.author !== undefined) row.author = input.author;
    if (input.phase !== undefined) row.phase = input.phase;
    if (input.category !== undefined) row.category = input.category;
    if (input.enabled_by_default !== undefined) {
      row.enabled_by_default = input.enabled_by_default;
    }
    if (input.default_tools !== undefined) {
      row.default_tools = input.default_tools;
    }
    if (input.default_prompt_template !== undefined) {
      row.default_prompt_template = input.default_prompt_template;
    }
    if (input.default_settings !== undefined) {
      row.default_settings = input.default_settings;
    }
    if (input.mode_allowlist !== undefined) {
      row.mode_allowlist = input.mode_allowlist;
    }
    if (input.result_type !== undefined) row.result_type = input.result_type;
    if (input.default_inject_as_section !== undefined) {
      row.default_inject_as_section = input.default_inject_as_section;
    }
    if (input.run_interval !== undefined) {
      row.run_interval = input.run_interval;
    }
    if (input.prompt_templates !== undefined) {
      row.prompt_templates = input.prompt_templates;
    }
    if (input.runtime_disabled !== undefined) {
      row.runtime_disabled = input.runtime_disabled;
    }
    if (input.execution !== undefined) row.execution = input.execution;

    const saved = await this.agents.save(row);
    return this.toAgent(saved);
  }

  async remove(id: string): Promise<void> {
    const row = await this.agents.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Agent ${id} not found`);
    }
    if (row.is_built_in) {
      throw new BadRequestException("Built-in agents cannot be deleted");
    }
    await this.agents.delete({ id });
  }

  async duplicate(id: string): Promise<Agent> {
    const source = await this.findOne(id);
    const baseSlug = `${source.slug}-copy`;
    let slug = baseSlug;
    let suffix = 2;
    while (await this.agents.exists({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    const { id: _id, is_built_in: _builtIn, ...rest } = source;
    return this.create({
      ...rest,
      slug,
      name: `${source.name} (copy)`,
      enabled_by_default: false,
    });
  }

  private async assertUniqueSlug(slug: string, exceptId?: string) {
    const existing = await this.agents.findOneBy({ slug });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(`Agent slug "${slug}" is already taken`);
    }
  }

  private normalizeInput(input: CreateAgentInput): Omit<
    AgentEntity,
    "id" | "is_built_in"
  > {
    return {
      slug: input.slug,
      name: input.name,
      description: input.description,
      author: input.author,
      phase: input.phase,
      category: input.category,
      enabled_by_default: input.enabled_by_default,
      default_tools: input.default_tools ?? [],
      default_prompt_template: input.default_prompt_template ?? "",
      default_settings: input.default_settings ?? {},
      mode_allowlist: input.mode_allowlist ?? [],
      result_type: input.result_type ?? null,
      default_inject_as_section: Boolean(input.default_inject_as_section),
      run_interval: input.run_interval ?? null,
      prompt_templates: input.prompt_templates ?? [],
      runtime_disabled: Boolean(input.runtime_disabled),
      execution: input.execution ?? "llm",
    };
  }

  private toAgent(row: AgentEntity): Agent {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description ?? "",
      author: row.author ?? "",
      phase: row.phase,
      category: row.category,
      enabled_by_default: Boolean(row.enabled_by_default),
      default_tools: row.default_tools ?? [],
      default_prompt_template: row.default_prompt_template ?? "",
      default_settings: row.default_settings ?? {},
      mode_allowlist: row.mode_allowlist ?? [],
      result_type: row.result_type ?? null,
      default_inject_as_section: Boolean(row.default_inject_as_section),
      run_interval: row.run_interval ?? null,
      prompt_templates: row.prompt_templates ?? [],
      runtime_disabled: Boolean(row.runtime_disabled),
      execution: row.execution ?? "llm",
      is_built_in: Boolean(row.is_built_in),
    };
  }

  private toListItem(row: AgentEntity): AgentListItem {
    const agent = this.toAgent(row);
    return {
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      author: agent.author,
      phase: agent.phase,
      category: agent.category,
      enabled_by_default: agent.enabled_by_default,
      default_tools: agent.default_tools,
      execution: agent.execution,
      is_built_in: agent.is_built_in,
    };
  }
}
