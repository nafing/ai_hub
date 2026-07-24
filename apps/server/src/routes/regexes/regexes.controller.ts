import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import type { RegexScript } from "@ai-hub/shared";
import { RegexesService } from "./regexes.service";
import { CreateRegexScriptDto } from "./dto/create-regex-script.dto";
import { UpdateRegexScriptDto } from "./dto/update-regex-script.dto";

@Controller("regexes")
export class RegexesController {
  constructor(private readonly regexesService: RegexesService) {}

  @Get()
  findAll(): Promise<RegexScript[]> {
    return this.regexesService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<RegexScript> {
    return this.regexesService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateRegexScriptDto): Promise<RegexScript> {
    return this.regexesService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateRegexScriptDto,
  ): Promise<RegexScript> {
    return this.regexesService.update(id, body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.regexesService.remove(id);
    return { ok: true };
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string): Promise<RegexScript> {
    return this.regexesService.duplicate(id);
  }
}
