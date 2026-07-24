import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import type {
  Preset,
  PresetCategory,
  PresetListItem,
  PresetMarkerContent,
  Section,
} from "@ai-hub/shared";
import { PRESET_CATEGORIES } from "@ai-hub/shared";
import { PresetsService } from "./presets.service";
import { CreatePresetDto } from "./dto/create-preset.dto";
import { UpdatePresetDto } from "./dto/update-preset.dto";
import { TestPresetDto } from "./dto/test-preset.dto";

@Controller("presets")
export class PresetsController {
  constructor(private readonly presetsService: PresetsService) {}

  @Get()
  findAll(): Promise<PresetListItem[]> {
    return this.presetsService.findAll();
  }

  @Get("default/:category")
  findDefault(@Param("category") category: string): Promise<Preset> {
    if (!(PRESET_CATEGORIES as readonly string[]).includes(category)) {
      throw new BadRequestException(`Unknown preset category "${category}"`);
    }
    return this.presetsService.findDefault(category as PresetCategory);
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<Preset> {
    return this.presetsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreatePresetDto): Promise<Preset> {
    return this.presetsService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdatePresetDto,
  ): Promise<Preset> {
    return this.presetsService.update(id, body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.presetsService.remove(id);
    return { ok: true };
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string): Promise<Preset> {
    return this.presetsService.duplicate(id);
  }

  @Post(":id/test")
  test(@Param("id") id: string, @Body() body: TestPresetDto) {
    return this.presetsService.test(id, {
      connectionId: body.connectionId,
      variables: body.variables,
      markers: body.markers as PresetMarkerContent | undefined,
      userMessage: body.userMessage,
      draft: body.draft
        ? {
            wrap_format: body.draft.wrap_format,
            sections: body.draft.sections as Section[],
          }
        : undefined,
    });
  }
}
