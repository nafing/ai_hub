import { createReadStream } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type { ChatMessageAttachment } from "@ai-hub/shared";
import {
  attachmentKindForMime,
  extensionForMime,
  normalizeMime,
} from "../../../utils/mime";
import { imageApiPaths, uploadsPath } from "../paths";

function getChatAttachmentsDir(chatId: string): string {
  const root =
    process.env.SERVER_CHAT_ATTACHMENTS_DIR ?? uploadsPath("chats");
  return path.join(root, chatId);
}

export function chatAttachmentFilePath(
  chatId: string,
  attachmentId: string,
  ext: string,
): string {
  return path.join(getChatAttachmentsDir(chatId), `${attachmentId}.${ext}`);
}

function chatAttachmentMetaPath(chatId: string, attachmentId: string): string {
  return path.join(getChatAttachmentsDir(chatId), `${attachmentId}.json`);
}

async function ensureChatAttachmentsDir(chatId: string): Promise<void> {
  await mkdir(getChatAttachmentsDir(chatId), { recursive: true });
}

type AttachmentMeta = {
  id: string;
  mime: string;
  name: string;
  size: number;
  ext: string;
};

export async function writeChatAttachment(input: {
  chatId: string;
  attachmentId: string;
  buffer: Buffer;
  mime: string;
  name: string;
}): Promise<ChatMessageAttachment> {
  const mime = normalizeMime(input.mime);
  const ext = extensionForMime(mime, input.name);
  const kind = attachmentKindForMime(mime);
  await ensureChatAttachmentsDir(input.chatId);

  const meta: AttachmentMeta = {
    id: input.attachmentId,
    mime,
    name: input.name.trim() || `attachment.${ext}`,
    size: input.buffer.length,
    ext,
  };

  await writeFile(
    chatAttachmentFilePath(input.chatId, input.attachmentId, ext),
    input.buffer,
  );
  await writeFile(
    chatAttachmentMetaPath(input.chatId, input.attachmentId),
    JSON.stringify(meta),
    "utf8",
  );

  return {
    id: input.attachmentId,
    kind,
    mime,
    url: imageApiPaths.chatAttachment(input.chatId, input.attachmentId),
    name: meta.name,
    size: meta.size,
  };
}

export async function readChatAttachmentMeta(
  chatId: string,
  attachmentId: string,
): Promise<AttachmentMeta | null> {
  try {
    const raw = await readFile(
      chatAttachmentMetaPath(chatId, attachmentId),
      "utf8",
    );
    const parsed = JSON.parse(raw) as AttachmentMeta;
    if (!parsed?.id || !parsed.mime || !parsed.ext) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function chatAttachmentExists(
  chatId: string,
  attachmentId: string,
): Promise<boolean> {
  const meta = await readChatAttachmentMeta(chatId, attachmentId);
  if (!meta) return false;
  try {
    await access(
      chatAttachmentFilePath(chatId, attachmentId, meta.ext),
      constants.R_OK,
    );
    return true;
  } catch {
    return false;
  }
}

export function openChatAttachmentStream(
  chatId: string,
  attachmentId: string,
  ext: string,
) {
  return createReadStream(chatAttachmentFilePath(chatId, attachmentId, ext));
}
