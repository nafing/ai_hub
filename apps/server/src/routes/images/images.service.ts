import { Injectable, NotFoundException, StreamableFile } from "@nestjs/common";
import { createReadStream } from "node:fs";
import {
  characterAvatarExists,
  characterAvatarFilePath,
  characterGalleryImageExists,
  normalizeGalleryRecords,
  openCharacterGalleryImageStream,
  openChatAttachmentStream,
  readChatAttachmentMeta,
  chatAttachmentExists,
  personaAvatarExists,
  personaAvatarFilePath,
  twatterImageExists,
  twatterImageFilePath,
} from "./storage";

@Injectable()
export class ImagesService {
  async getCharacterAvatarStream(characterId: string): Promise<StreamableFile> {
    if (!(await characterAvatarExists(characterId))) {
      throw new NotFoundException(
        `Avatar for character ${characterId} not found`,
      );
    }
    return new StreamableFile(createReadStream(characterAvatarFilePath(characterId)), {
      type: "image/png",
      disposition: `inline; filename="${characterId}.png"`,
    });
  }

  async getPersonaAvatarStream(personaId: string): Promise<StreamableFile> {
    if (!(await personaAvatarExists(personaId))) {
      throw new NotFoundException(`Avatar for persona ${personaId} not found`);
    }
    return new StreamableFile(createReadStream(personaAvatarFilePath(personaId)), {
      type: "image/png",
      disposition: `inline; filename="${personaId}.png"`,
    });
  }

  async getCharacterGalleryStream(
    characterId: string,
    imageId: string,
    gallery: unknown,
  ): Promise<StreamableFile> {
    const record = normalizeGalleryRecords(gallery).find(
      (item) => item.id === imageId,
    );
    if (!record || !(await characterGalleryImageExists(characterId, record))) {
      throw new NotFoundException(
        `Gallery image ${imageId} for character ${characterId} not found`,
      );
    }
    return new StreamableFile(
      openCharacterGalleryImageStream(characterId, record.id, record.ext),
      {
        type: record.mime,
        disposition: `inline; filename="${record.name.replace(/"/g, "")}"`,
      },
    );
  }

  async getChatAttachmentStream(
    chatId: string,
    attachmentId: string,
  ): Promise<StreamableFile> {
    const meta = await readChatAttachmentMeta(chatId, attachmentId);
    if (!meta || !(await chatAttachmentExists(chatId, attachmentId))) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }
    const safeName = meta.name.replace(/[\r\n"]/g, "_");
    return new StreamableFile(
      openChatAttachmentStream(chatId, attachmentId, meta.ext),
      {
        type: meta.mime,
        disposition: `inline; filename="${safeName}"`,
      },
    );
  }

  async getTwatterPostImageStream(postId: string): Promise<StreamableFile> {
    const ext = await twatterImageExists(postId);
    if (!ext) {
      throw new NotFoundException(`Image for post ${postId} not found`);
    }
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    return new StreamableFile(createReadStream(twatterImageFilePath(postId, ext)), {
      type: mime,
      disposition: "inline",
    });
  }
}
