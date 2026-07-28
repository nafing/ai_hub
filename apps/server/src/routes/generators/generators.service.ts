import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import {
  CHARACTER_CARD_DIALOGUE_FORMAT_APPEND,
  characterCardTargetNeedsProseMarkup,
  GENERATOR_CATEGORIES,
  NEEDS_PRESET_VARIABLES_CODE,
  substituteVariables,
  unresolvedPresetVariables,
  type GeneratorCategory,
  type PresetMarkerContent,
  type PresetVariableValues,
} from "@ai-hub/shared";
import {
  completeWithConnectionAndPreset,
  type CompleteWithConnectionResult,
} from "../../utils/openrouter";
import { ConnectionsService } from "../connections/connections.service";
import { PresetsService } from "../presets/presets.service";

export type RunGeneratorInput = {
  category: GeneratorCategory;
  connectionId?: string;
  presetId?: string;
  variables?: PresetVariableValues;
  markers?: PresetMarkerContent;
  userMessage?: string;
};

@Injectable()
export class GeneratorsService {
  constructor(
    private readonly presets: PresetsService,
    private readonly connections: ConnectionsService,
  ) {}

  async run(
    input: RunGeneratorInput,
  ): Promise<
    Pick<
      CompleteWithConnectionResult,
      "content" | "thinking" | "reply" | "finishReason" | "model" | "messages"
    >
  > {
    if (!(GENERATOR_CATEGORIES as readonly string[]).includes(input.category)) {
      throw new BadRequestException(
        `Unknown generator category "${input.category}"`,
      );
    }

    const preset = input.presetId
      ? await this.presets.findOne(input.presetId)
      : await this.presets.findDefault(input.category);

    if (preset.category !== input.category) {
      throw new BadRequestException(
        `Preset "${preset.id}" is category "${preset.category}", expected "${input.category}"`,
      );
    }

    const unresolved = unresolvedPresetVariables(
      preset.variables,
      input.variables,
    );
    if (unresolved.length > 0) {
      throw new ConflictException({
        code: NEEDS_PRESET_VARIABLES_CODE,
        presetId: preset.id,
        variables: unresolved,
      });
    }

    const connection = input.connectionId
      ? await this.connections.findOne(input.connectionId)
      : await this.connections.findDefault();

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

    const appendMessages: Array<{ role: "user"; content: string }> = [];
    if (resolvedUserMessage) {
      appendMessages.push({ role: "user", content: resolvedUserMessage });
    }
    if (
      input.category === "character_generator" &&
      characterCardTargetNeedsProseMarkup(
        typeof input.variables?.target_field === "string"
          ? input.variables.target_field
          : null,
      )
    ) {
      appendMessages.push({
        role: "user",
        content: CHARACTER_CARD_DIALOGUE_FORMAT_APPEND,
      });
    }

    const result = await completeWithConnectionAndPreset(connection, preset, {
      prompt: {
        variables: input.variables,
        markers: input.markers,
      },
      appendMessages: appendMessages.length ? appendMessages : undefined,
    });

    return {
      content: result.content,
      thinking: result.thinking,
      reply: result.reply,
      finishReason: result.finishReason,
      model: result.model,
      messages: result.messages,
    };
  }
}
