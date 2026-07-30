import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import type { Character, CharacterListItem } from "@ai-hub/shared";
import { CharactersService } from "./characters.service";
import { CreateCharacterDto } from "./dto/create-character.dto";
import { UpdateCharacterDto } from "./dto/update-character.dto";

@Controller("characters")
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Get()
  findAll(): Promise<CharacterListItem[]> {
    return this.charactersService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<Character> {
    return this.charactersService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateCharacterDto): Promise<Character> {
    return this.charactersService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateCharacterDto,
  ): Promise<Character> {
    return this.charactersService.update(id, body);
  }

  @Delete(":id/versions/:versionId")
  removeVersion(
    @Param("id") id: string,
    @Param("versionId") versionId: string,
  ): Promise<Character> {
    return this.charactersService.removeVersion(id, versionId);
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.charactersService.remove(id);
    return { ok: true };
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string): Promise<Character> {
    return this.charactersService.duplicate(id);
  }
}
