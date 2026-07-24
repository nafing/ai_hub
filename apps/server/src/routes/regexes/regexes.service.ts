import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
import type {
  CreateRegexScriptInput,
  RegexScript,
  UpdateRegexScriptInput,
} from "@ai-hub/shared";
import { RegexScriptEntity } from "./regex-script.entity";

@Injectable()
export class RegexesService {
  constructor(
    @InjectRepository(RegexScriptEntity)
    private readonly regexes: Repository<RegexScriptEntity>,
  ) {}

  async findAll(): Promise<RegexScript[]> {
    const rows = await this.regexes.find({
      order: { order: "ASC", name: "ASC" },
    });
    return rows.map((row) => this.toRegexScript(row));
  }

  async findOne(id: string): Promise<RegexScript> {
    const row = await this.regexes.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Regex script ${id} not found`);
    }
    return this.toRegexScript(row);
  }

  async create(input: CreateRegexScriptInput): Promise<RegexScript> {
    const entity = this.regexes.create({
      id: randomUUID(),
      ...input,
      targets: input.targets ?? ["ai_output"],
      character_ids: input.character_ids ?? [],
    });
    const saved = await this.regexes.save(entity);
    return this.toRegexScript(saved);
  }

  async update(
    id: string,
    input: UpdateRegexScriptInput,
  ): Promise<RegexScript> {
    const row = await this.regexes.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Regex script ${id} not found`);
    }

    Object.assign(row, input);
    if (input.targets !== undefined) {
      row.targets = input.targets;
    }
    if (input.character_ids !== undefined) {
      row.character_ids = input.character_ids;
    }
    const saved = await this.regexes.save(row);
    return this.toRegexScript(saved);
  }

  async remove(id: string): Promise<void> {
    const row = await this.regexes.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Regex script ${id} not found`);
    }
    await this.regexes.delete({ id });
  }

  async duplicate(id: string): Promise<RegexScript> {
    const source = await this.findOne(id);
    const { id: _id, ...rest } = source;
    return this.create({
      ...rest,
      name: `${source.name} (copy)`,
      enabled: false,
    });
  }

  private toRegexScript(row: RegexScriptEntity): RegexScript {
    return {
      id: row.id,
      name: row.name,
      enabled: Boolean(row.enabled),
      find_regex: row.find_regex,
      replace_with: row.replace_with,
      flags: row.flags,
      targets: row.targets ?? ["ai_output"],
      apply_to: row.apply_to,
      order: row.order,
      min_depth: row.min_depth ?? null,
      max_depth: row.max_depth ?? null,
      scope: row.scope,
      character_ids: row.character_ids ?? [],
    };
  }
}
