import { createReadStream } from "node:fs";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type { ChatMessageAttachment } from "@ai-hub/shared";

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/json": "json",
};

export function getChatAttachmentsDir(chatId: string): string {
  const root =
    process.env.SERVER_CHAT_ATTACHMENTS_DIR ??
    path.resolve(__dirname, "../../../uploads/chats");
  return path.join(root, chatId);
}

export function chatAttachmentFilePath(
  chatId: string,
  attachmentId: string,
  ext: string,
): string {
  return path.join(getChatAttachmentsDir(chatId), `${attachmentId}.${ext}`);
}

export function chatAttachmentMetaPath(
  chatId: string,
  attachmentId: string,
): string {
  return path.join(getChatAttachmentsDir(chatId), `${attachmentId}.json`);
}

export async function ensureChatAttachmentsDir(chatId: string): Promise<void> {
  await mkdir(getChatAttachmentsDir(chatId), { recursive: true });
}

export function attachmentKindForMime(mime: string): "image" | "file" {
  const normalized = normalizeMime(mime);
  return IMAGE_MIMES.has(normalized) ? "image" : "file";
}

export function normalizeMime(mime: string): string {
  const value = mime.trim().toLowerCase();
  if (value === "image/jpg") return "image/jpeg";
  return value || "application/octet-stream";
}

export function extensionForMime(mime: string, fileName?: string): string {
  const normalized = normalizeMime(mime);
  if (EXT_BY_MIME[normalized]) return EXT_BY_MIME[normalized]!;
  const fromName = fileName?.includes(".")
    ? fileName.split(".").pop()?.toLowerCase()
    : undefined;
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  return "bin";
}

export function chatAttachmentPublicUrl(
  chatId: string,
  attachmentId: string,
): string {
  return `/chats/${chatId}/attachments/${attachmentId}`;
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
    url: chatAttachmentPublicUrl(input.chatId, input.attachmentId),
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

export async function deleteChatAttachmentFiles(
  chatId: string,
  attachmentId: string,
): Promise<void> {
  const meta = await readChatAttachmentMeta(chatId, attachmentId);
  const targets = [
    chatAttachmentMetaPath(chatId, attachmentId),
    ...(meta
      ? [chatAttachmentFilePath(chatId, attachmentId, meta.ext)]
      : []),
  ];
  for (const target of targets) {
    try {
      await unlink(target);
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? (error as { code?: string }).code
          : undefined;
      if (code !== "ENOENT") throw error;
    }
  }
}
