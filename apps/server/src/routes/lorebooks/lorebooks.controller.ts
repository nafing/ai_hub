import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import type { Lorebook, LorebookListItem } from "@ai-hub/shared";
import { LorebooksService } from "./lorebooks.service";
import { CreateLorebookDto } from "./dto/create-lorebook.dto";
import { UpdateLorebookDto } from "./dto/update-lorebook.dto";

@Controller("lorebooks")
export class LorebooksController {
  constructor(private readonly lorebooksService: LorebooksService) {}

  @Get()
  findAll(): Promise<LorebookListItem[]> {
    return this.lorebooksService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<Lorebook> {
    return this.lorebooksService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateLorebookDto): Promise<Lorebook> {
    return this.lorebooksService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateLorebookDto,
  ): Promise<Lorebook> {
    return this.lorebooksService.update(id, body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.lorebooksService.remove(id);
    return { ok: true };
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string): Promise<Lorebook> {
    return this.lorebooksService.duplicate(id);
  }
}
