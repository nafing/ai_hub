import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import type { CharacterFolder } from "@ai-hub/shared";
import { CharacterFoldersService } from "./character-folders.service";
import { CreateCharacterFolderDto } from "./dto/create-character-folder.dto";
import { UpdateCharacterFolderDto } from "./dto/update-character-folder.dto";

@Controller("character-folders")
export class CharacterFoldersController {
  constructor(
    private readonly characterFoldersService: CharacterFoldersService,
  ) {}

  @Get()
  findAll(): Promise<CharacterFolder[]> {
    return this.characterFoldersService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<CharacterFolder> {
    return this.characterFoldersService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateCharacterFolderDto): Promise<CharacterFolder> {
    return this.characterFoldersService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateCharacterFolderDto,
  ): Promise<CharacterFolder> {
    return this.characterFoldersService.update(id, body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.characterFoldersService.remove(id);
    return { ok: true };
  }
}
