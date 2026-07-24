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
import type { Persona, PersonaListItem } from "@ai-hub/shared";
import { PersonasService } from "./personas.service";
import { CreatePersonaDto } from "./dto/create-persona.dto";
import { UpdatePersonaDto } from "./dto/update-persona.dto";

@Controller("personas")
export class PersonasController {
  constructor(private readonly personasService: PersonasService) {}

  @Get()
  findAll(): Promise<PersonaListItem[]> {
    return this.personasService.findAll();
  }

  @Get(":id/avatar")
  getAvatar(@Param("id") id: string): Promise<StreamableFile> {
    return this.personasService.getAvatarStream(id);
  }

  @Put(":id/avatar")
  async uploadAvatar(
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<Persona> {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException("Expected multipart file field");
    }
    const buffer = await file.toBuffer();
    return this.personasService.setAvatar(id, buffer);
  }

  @Delete(":id/avatar")
  clearAvatar(@Param("id") id: string): Promise<Persona> {
    return this.personasService.clearAvatar(id);
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<Persona> {
    return this.personasService.findOne(id);
  }

  @Post()
  create(@Body() body: CreatePersonaDto): Promise<Persona> {
    return this.personasService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdatePersonaDto,
  ): Promise<Persona> {
    return this.personasService.update(id, body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.personasService.remove(id);
    return { ok: true };
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string): Promise<Persona> {
    return this.personasService.duplicate(id);
  }
}
