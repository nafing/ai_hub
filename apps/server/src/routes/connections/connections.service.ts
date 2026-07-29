import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Not, Repository } from "typeorm";
import type {
  Connection,
  ConnectionKind,
  ConnectionListItem,
  CreateConnectionInput,
  UpdateConnectionInput,
} from "@ai-hub/shared";
import { ConnectionEntity } from "./connection.entity";

@Injectable()
export class ConnectionsService {
  constructor(
    @InjectRepository(ConnectionEntity)
    private readonly connections: Repository<ConnectionEntity>,
  ) {}

  async findAll(): Promise<ConnectionListItem[]> {
    const rows = await this.connections.find({ order: { name: "ASC" } });
    return rows.map((row) => this.toListItem(row));
  }

  async findOne(id: string): Promise<Connection> {
    const row = await this.connections.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Connection ${id} not found`);
    }
    return this.toConnection(row);
  }

  async findDefault(kind: ConnectionKind = "llm"): Promise<Connection> {
    const row = await this.connections.findOneBy({
      is_default: true,
      kind,
    });
    if (!row) {
      throw new NotFoundException(`No default ${kind} connection configured`);
    }
    return this.toConnection(row);
  }

  async create(input: CreateConnectionInput): Promise<Connection> {
    const kind = input.kind ?? "llm";
    const hasDefaultForKind = await this.connections.findOneBy({
      is_default: true,
      kind,
    });
    const shouldBeDefault = input.is_default || !hasDefaultForKind;

    if (shouldBeDefault) {
      await this.clearDefaults(kind);
    }

    const entity = this.connections.create({
      id: randomUUID(),
      ...input,
      kind,
      custom_parameters: input.custom_parameters ?? {},
      is_default: shouldBeDefault,
    });
    const saved = await this.connections.save(entity);
    return this.toConnection(saved);
  }

  async update(
    id: string,
    input: UpdateConnectionInput,
  ): Promise<Connection> {
    const row = await this.connections.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Connection ${id} not found`);
    }

    const nextKind = (input.kind ?? row.kind ?? "llm") as ConnectionKind;

    if (input.is_default === true) {
      await this.clearDefaults(nextKind, id);
    }

    Object.assign(row, input);
    if (input.kind !== undefined) {
      row.kind = input.kind;
    }
    if (input.custom_parameters !== undefined) {
      row.custom_parameters = input.custom_parameters;
    }
    const saved = await this.connections.save(row);
    return this.toConnection(saved);
  }

  async remove(id: string): Promise<void> {
    const row = await this.connections.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Connection ${id} not found`);
    }

    const kind = (row.kind ?? "llm") as ConnectionKind;
    const wasDefault = row.is_default;
    await this.connections.delete({ id });

    if (wasDefault) {
      const next = await this.connections.find({
        where: { kind },
        order: { name: "ASC" },
        take: 1,
      });
      if (next[0]) {
        next[0].is_default = true;
        await this.connections.save(next[0]);
      }
    }
  }

  async duplicate(id: string): Promise<Connection> {
    const source = await this.findOne(id);
    const { id: _id, ...rest } = source;
    return this.create({
      ...rest,
      name: `${source.name} (copy)`,
      is_default: false,
    });
  }

  async getApiKey(id: string): Promise<string> {
    const row = await this.connections.findOneBy({ id });
    if (!row) {
      throw new NotFoundException(`Connection ${id} not found`);
    }
    return row.api_key;
  }

  private async clearDefaults(
    kind: ConnectionKind,
    exceptId?: string,
  ): Promise<void> {
    await this.connections.update(
      exceptId
        ? { id: Not(exceptId), is_default: true, kind }
        : { is_default: true, kind },
      { is_default: false },
    );
  }

  private toConnection(row: ConnectionEntity): Connection {
    return {
      id: row.id,
      kind: (row.kind ?? "llm") as ConnectionKind,
      name: row.name,
      preferred_provider: row.preferred_provider,
      api_key: row.api_key,
      model: row.model,
      max_parallel_jobs: row.max_parallel_jobs,
      max_completion_tokens: row.max_completion_tokens,
      temperature: row.temperature,
      context_length: row.context_length,
      top_p: row.top_p,
      top_k: row.top_k,
      frequency_penalty: row.frequency_penalty,
      presence_penalty: row.presence_penalty,
      assistant_prefill: row.assistant_prefill,
      thinking_tag: row.thinking_tag,
      custom_parameters: row.custom_parameters ?? {},
      service_tier: row.service_tier,
      reasoning_effort: row.reasoning_effort,
      verbosity: row.verbosity,
      prompt_caching: row.prompt_caching,
      is_default: Boolean(row.is_default),
    };
  }

  private toListItem(row: ConnectionEntity): ConnectionListItem {
    const { api_key, ...rest } = this.toConnection(row);
    return {
      ...rest,
      has_api_key: Boolean(api_key),
    };
  }
}
