import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  StreamableFile,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
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

  @Get(":id/avatar")
  getAvatar(@Param("id") id: string): Promise<StreamableFile> {
    return this.charactersService.getAvatarStream(id);
  }

  @Put(":id/avatar")
  async uploadAvatar(
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<Character> {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException("Expected multipart file field");
    }
    const buffer = await file.toBuffer();
    return this.charactersService.setAvatar(id, buffer);
  }

  @Delete(":id/avatar")
  clearAvatar(@Param("id") id: string): Promise<Character> {
    return this.charactersService.clearAvatar(id);
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
