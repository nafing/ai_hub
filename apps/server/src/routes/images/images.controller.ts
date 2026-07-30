import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  StreamableFile,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type {
  Character,
  CharacterGalleryImage,
  ChatMessageAttachment,
  Persona,
} from "@ai-hub/shared";
import { CharactersService } from "../characters/characters.service";
import { ChatsService } from "../chats/chats.service";
import { PersonasService } from "../personas/personas.service";
import { ImagesService } from "./images.service";

@Controller("images")
export class ImagesController {
  constructor(
    private readonly images: ImagesService,
    private readonly characters: CharactersService,
    private readonly personas: PersonasService,
    private readonly chats: ChatsService,
  ) {}

  @Get("character-avatars/:characterId")
  getCharacterAvatar(
    @Param("characterId") characterId: string,
  ): Promise<StreamableFile> {
    return this.images.getCharacterAvatarStream(characterId);
  }

  @Put("character-avatars/:characterId")
  async uploadCharacterAvatar(
    @Param("characterId") characterId: string,
    @Req() req: FastifyRequest,
  ): Promise<Character> {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException("Expected multipart file field");
    }
    return this.characters.setAvatar(characterId, await file.toBuffer());
  }

  @Delete("character-avatars/:characterId")
  clearCharacterAvatar(
    @Param("characterId") characterId: string,
  ): Promise<Character> {
    return this.characters.clearAvatar(characterId);
  }

  @Get("persona-avatars/:personaId")
  getPersonaAvatar(
    @Param("personaId") personaId: string,
  ): Promise<StreamableFile> {
    return this.images.getPersonaAvatarStream(personaId);
  }

  @Put("persona-avatars/:personaId")
  async uploadPersonaAvatar(
    @Param("personaId") personaId: string,
    @Req() req: FastifyRequest,
  ): Promise<Persona> {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException("Expected multipart file field");
    }
    return this.personas.setAvatar(personaId, await file.toBuffer());
  }

  @Delete("persona-avatars/:personaId")
  clearPersonaAvatar(@Param("personaId") personaId: string): Promise<Persona> {
    return this.personas.clearAvatar(personaId);
  }

  @Get("character-gallery/:characterId")
  listCharacterGallery(
    @Param("characterId") characterId: string,
  ): Promise<CharacterGalleryImage[]> {
    return this.characters.listGallery(characterId);
  }

  @Get("character-gallery/:characterId/:imageId")
  async getCharacterGalleryImage(
    @Param("characterId") characterId: string,
    @Param("imageId") imageId: string,
  ): Promise<StreamableFile> {
    const character = await this.characters.findOne(characterId);
    return this.images.getCharacterGalleryStream(
      characterId,
      imageId,
      character.gallery,
    );
  }

  @Post("character-gallery/:characterId")
  async uploadCharacterGalleryImage(
    @Param("characterId") characterId: string,
    @Req() req: FastifyRequest,
  ): Promise<Character> {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException("Expected multipart file field");
    }
    return this.characters.addGalleryImage(characterId, await file.toBuffer(), {
      mime: file.mimetype,
      name: file.filename || "image",
      source: "upload",
    });
  }

  @Delete("character-gallery/:characterId/:imageId")
  removeCharacterGalleryImage(
    @Param("characterId") characterId: string,
    @Param("imageId") imageId: string,
  ): Promise<Character> {
    return this.characters.removeGalleryImage(characterId, imageId);
  }

  @Post("chat-attachments/:chatId")
  async uploadChatAttachment(
    @Param("chatId") chatId: string,
    @Req() req: FastifyRequest,
  ): Promise<ChatMessageAttachment> {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException("Expected multipart file field");
    }
    return this.chats.uploadAttachment(chatId, {
      buffer: await file.toBuffer(),
      mime: file.mimetype || "application/octet-stream",
      name: file.filename || "attachment",
    });
  }

  @Get("chat-attachments/:chatId/:attachmentId")
  getChatAttachment(
    @Param("chatId") chatId: string,
    @Param("attachmentId") attachmentId: string,
  ): Promise<StreamableFile> {
    return this.images.getChatAttachmentStream(chatId, attachmentId);
  }

  @Get("twatter-posts/:postId")
  getTwatterPostImage(
    @Param("postId") postId: string,
  ): Promise<StreamableFile> {
    return this.images.getTwatterPostImageStream(postId);
  }
}
