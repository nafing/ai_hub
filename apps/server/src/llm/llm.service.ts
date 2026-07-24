import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import type {
  LlmChatMessage,
  Connection,
  Preset,
  PresetCategory,
} from "@ai-hub/shared";
import { ConnectionsService } from "../routes/connections/connections.service";
import { PresetsService } from "../routes/presets/presets.service";
import {
  completeWithConnection,
  completeWithConnectionAndPreset,
  type CompleteWithConnectionOptions,
  type CompleteWithConnectionResult,
} from "../utils/openrouter";

export type ResolveConnectionInput = {
  connectionId?: string;
  /** When true (default), fall back to the default connection. */
  useDefault?: boolean;
};

export type ResolvePresetInput = {
  presetId?: string;
  category?: PresetCategory;
};

export type LlmCompleteInput = ResolveConnectionInput &
  ResolvePresetInput &
  CompleteWithConnectionOptions;

@Injectable()
export class LlmService {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly presets: PresetsService,
  ) {}

  async resolveConnection(
    input: ResolveConnectionInput = {},
  ): Promise<Connection> {
    if (input.connectionId) {
      return this.connections.findOne(input.connectionId);
    }
    if (input.useDefault === false) {
      throw new BadRequestException("connectionId is required");
    }
    return this.connections.findDefault();
  }

  async resolvePreset(input: ResolvePresetInput): Promise<Preset> {
    if (input.presetId) {
      return this.presets.findOne(input.presetId);
    }
    if (!input.category) {
      throw new BadRequestException("presetId or category is required");
    }
    return this.presets.findDefault(input.category);
  }

  /** Complete using a connection + preset (by id or defaults). */
  async complete(input: LlmCompleteInput): Promise<CompleteWithConnectionResult> {
    const connection = await this.resolveConnection(input);
    const preset = await this.resolvePreset(input);

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

    return completeWithConnectionAndPreset(connection, preset, input);
  }

  /** Complete using a connection and an explicit message list (no preset). */
  async completeMessages(
    input: ResolveConnectionInput & {
      messages: LlmChatMessage[];
    } & Omit<CompleteWithConnectionOptions, "prompt" | "appendMessages">,
  ): Promise<CompleteWithConnectionResult> {
    const connection = await this.resolveConnection(input);
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
    if (!input.messages?.length) {
      throw new BadRequestException("messages are required");
    }

    return completeWithConnection(connection, input.messages, input);
  }
}
