import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import type { Tool, ToolListItem } from "@ai-hub/shared";
import { ToolsService } from "./tools.service";
import { CreateToolDto } from "./dto/create-tool.dto";
import { UpdateToolDto } from "./dto/update-tool.dto";

@Controller("tools")
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  findAll(): Promise<ToolListItem[]> {
    return this.toolsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<Tool> {
    return this.toolsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateToolDto): Promise<Tool> {
    return this.toolsService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateToolDto,
  ): Promise<Tool> {
    return this.toolsService.update(id, body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.toolsService.remove(id);
    return { ok: true };
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string): Promise<Tool> {
    return this.toolsService.duplicate(id);
  }
}
