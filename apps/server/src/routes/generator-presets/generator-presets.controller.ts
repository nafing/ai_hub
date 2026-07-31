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
  GeneratorCategory,
  GeneratorPreset,
  GeneratorPresetListItem,
} from "@ai-hub/shared";
import { GENERATOR_CATEGORIES } from "@ai-hub/shared";
import { GeneratorPresetsService } from "./generator-presets.service";
import { CreateGeneratorPresetDto } from "./dto/create-generator-preset.dto";
import { UpdateGeneratorPresetDto } from "./dto/update-generator-preset.dto";

@Controller("generator-presets")
export class GeneratorPresetsController {
  constructor(
    private readonly generatorPresetsService: GeneratorPresetsService,
  ) {}

  @Get()
  findAll(): Promise<GeneratorPresetListItem[]> {
    return this.generatorPresetsService.findAll();
  }

  @Get("default/:category")
  findDefault(@Param("category") category: string): Promise<GeneratorPreset> {
    if (!(GENERATOR_CATEGORIES as readonly string[]).includes(category)) {
      throw new BadRequestException(
        `Unknown generator category "${category}"`,
      );
    }
    return this.generatorPresetsService.findDefault(
      category as GeneratorCategory,
    );
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<GeneratorPreset> {
    return this.generatorPresetsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateGeneratorPresetDto): Promise<GeneratorPreset> {
    return this.generatorPresetsService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateGeneratorPresetDto,
  ): Promise<GeneratorPreset> {
    return this.generatorPresetsService.update(id, body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.generatorPresetsService.remove(id);
    return { ok: true };
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string): Promise<GeneratorPreset> {
    return this.generatorPresetsService.duplicate(id);
  }
}
