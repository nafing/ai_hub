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
  DEFAULT_TOOLS,
  countToolParameters,
  defaultToolId,
  emptyToolParameters,
  type CreateToolInput,
  type Tool,
  type ToolListItem,
  type UpdateToolInput,
} from "@ai-hub/shared";
import { ToolEntity } from "./tool.entity";

@Injectable()
export class ToolsService implements OnModuleInit {
  private readonly logger = new Logger(ToolsService.name);

  constructor(
    @InjectRepository(ToolEntity)
    private readonly tools: Repository<ToolEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultTools();
  }

  async seedDefaultTools(): Promise<void> {
    let created = 0;
    let promoted = 0;
    for (const def of DEFAULT_TOOLS) {
      const existing = await this.tools.findOneBy({ name: def.name });
      if (existing) {
        if (!existing.is_built_in) {
          existing.is_built_in = true;
          await this.tools.save(existing);
          promoted += 1;
        }
        continue;
      }

      await this.tools.save(
        this.tools.create({
          id: defaultToolId(def.name),
          name: def.name,
          description: def.description,
          parameters: def.parameters,
          is_built_in: true,
        }),
      );
      created += 1;
    }
    if (created > 0 || promoted > 0) {
      this.logger.log(
        `Default tools: seeded ${created}, marked default ${promoted}`,
      );
    }
  }

  async findAll(): Promise<ToolListItem[]> {
    const rows = await this.tools.find({
      order: { is_built_in: "DESC", name: "ASC" },
    });
    return rows.map((row) => this.toListItem(row));
  }

  async findOne(id: string): Promise<Tool> {
    const row = await this.tools.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Tool ${id} not found`);
    }
    return this.toTool(row);
  }

  async findByNames(names: string[]): Promise<Tool[]> {
    const wanted = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    if (!wanted.length) return [];
    const rows = await this.tools.find();
    const byName = new Map(rows.map((row) => [row.name, row]));
    return wanted
      .map((name) => byName.get(name))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => this.toTool(row));
  }

  async create(input: CreateToolInput): Promise<Tool> {
    await this.assertUniqueName(input.name);
    const entity = this.tools.create({
      id: randomUUID(),
      name: input.name,
      description: input.description,
      parameters: input.parameters ?? emptyToolParameters(),
      is_built_in: false,
    });
    const saved = await this.tools.save(entity);
    return this.toTool(saved);
  }

  async update(id: string, input: UpdateToolInput): Promise<Tool> {
    const row = await this.tools.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Tool ${id} not found`);
    }

    if (input.name !== undefined && input.name !== row.name) {
      if (row.is_built_in) {
        throw new BadRequestException("Default tools cannot be renamed");
      }
      await this.assertUniqueName(input.name, id);
      row.name = input.name;
    }
    if (input.description !== undefined) row.description = input.description;
    if (input.parameters !== undefined) row.parameters = input.parameters;

    const saved = await this.tools.save(row);
    return this.toTool(saved);
  }

  async remove(id: string): Promise<void> {
    const row = await this.tools.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Tool ${id} not found`);
    }
    if (row.is_built_in) {
      throw new BadRequestException("Default tools cannot be deleted");
    }
    await this.tools.delete({ id });
  }

  async duplicate(id: string): Promise<Tool> {
    const source = await this.findOne(id);
    const baseName = `${source.name}_copy`;
    let name = baseName;
    let suffix = 2;
    while (await this.tools.exists({ where: { name } })) {
      name = `${baseName}_${suffix}`;
      suffix += 1;
    }
    return this.create({
      name,
      description: source.description,
      parameters: source.parameters,
    });
  }

  private async assertUniqueName(name: string, exceptId?: string) {
    const existing = await this.tools.findOneBy({ name });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(`Tool name "${name}" is already taken`);
    }
  }

  private toTool(row: ToolEntity): Tool {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      parameters: row.parameters ?? emptyToolParameters(),
      is_built_in: Boolean(row.is_built_in),
    };
  }

  private toListItem(row: ToolEntity): ToolListItem {
    const tool = this.toTool(row);
    return {
      id: tool.id,
      name: tool.name,
      description: tool.description,
      is_built_in: tool.is_built_in,
      parameter_count: countToolParameters(tool.parameters),
    };
  }
}
