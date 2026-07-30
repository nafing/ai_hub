import { createReadStream } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type {
  CharacterGalleryImage,
  CharacterGalleryImageSource,
} from "@ai-hub/shared";
import { ignoreEnoent } from "../../../utils/fs";
import {
  assertImageMime,
  extensionForMime,
  normalizeMime,
} from "../../../utils/mime";
import { imageApiPaths, uploadsPath } from "../paths";

/** Stored on the character row (URLs rewritten for the API response). */
export type CharacterGalleryImageRecord = {
  id: string;
  mime: string;
  name: string;
  size: number;
  ext: string;
  source: CharacterGalleryImageSource;
  created_at: string;
  prompt?: string;
};

function getCharacterGalleryDir(characterId: string): string {
  const root =
    process.env.SERVER_CHARACTER_GALLERY_DIR ?? uploadsPath("characters");
  return path.join(root, characterId, "gallery");
}

export function characterGalleryFilePath(
  characterId: string,
  imageId: string,
  ext: string,
): string {
  return path.join(getCharacterGalleryDir(characterId), `${imageId}.${ext}`);
}

async function ensureCharacterGalleryDir(characterId: string): Promise<void> {
  await mkdir(getCharacterGalleryDir(characterId), { recursive: true });
}

export function toPublicGalleryImage(
  characterId: string,
  record: CharacterGalleryImageRecord,
): CharacterGalleryImage {
  return {
    id: record.id,
    url: imageApiPaths.characterGallery(characterId, record.id),
    mime: record.mime,
    name: record.name,
    size: record.size,
    source: record.source,
    created_at: record.created_at,
    ...(record.prompt ? { prompt: record.prompt } : {}),
  };
}

export function normalizeGalleryRecords(
  value: unknown,
): CharacterGalleryImageRecord[] {
  if (!Array.isArray(value)) return [];
  const out: CharacterGalleryImageRecord[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<CharacterGalleryImageRecord>;
    if (!row.id || !row.mime || !row.ext || !row.created_at) continue;
    const source =
      row.source === "generated" || row.source === "import"
        ? row.source
        : "upload";
    out.push({
      id: String(row.id),
      mime: normalizeMime(String(row.mime)),
      name: String(row.name || `image.${row.ext}`),
      size: typeof row.size === "number" ? row.size : 0,
      ext: String(row.ext),
      source,
      created_at: String(row.created_at),
      ...(typeof row.prompt === "string" && row.prompt.trim()
        ? { prompt: row.prompt.trim() }
        : {}),
    });
  }
  return out;
}

export async function writeCharacterGalleryImage(input: {
  characterId: string;
  imageId: string;
  buffer: Buffer;
  mime: string;
  name: string;
  source?: CharacterGalleryImageSource;
  prompt?: string;
}): Promise<CharacterGalleryImageRecord> {
  const mime = assertImageMime(
    input.mime,
    "Gallery image must be PNG, JPEG, WebP, or GIF",
  );
  const ext = extensionForMime(mime, input.name);
  await ensureCharacterGalleryDir(input.characterId);

  const record: CharacterGalleryImageRecord = {
    id: input.imageId,
    mime,
    name: input.name.trim() || `image.${ext}`,
    size: input.buffer.length,
    ext,
    source: input.source ?? "upload",
    created_at: new Date().toISOString(),
    ...(input.prompt?.trim() ? { prompt: input.prompt.trim() } : {}),
  };

  await writeFile(
    characterGalleryFilePath(input.characterId, input.imageId, ext),
    input.buffer,
  );
  return record;
}

export async function characterGalleryImageExists(
  characterId: string,
  record: CharacterGalleryImageRecord,
): Promise<boolean> {
  try {
    await access(
      characterGalleryFilePath(characterId, record.id, record.ext),
      constants.R_OK,
    );
    return true;
  } catch {
    return false;
  }
}

export function openCharacterGalleryImageStream(
  characterId: string,
  imageId: string,
  ext: string,
) {
  return createReadStream(
    characterGalleryFilePath(characterId, imageId, ext),
  );
}

export async function deleteCharacterGalleryImageFile(
  characterId: string,
  record: CharacterGalleryImageRecord,
): Promise<void> {
  await ignoreEnoent(() =>
    unlink(characterGalleryFilePath(characterId, record.id, record.ext)),
  );
}

export async function deleteCharacterGalleryDir(
  characterId: string,
): Promise<void> {
  await ignoreEnoent(() =>
    rm(getCharacterGalleryDir(characterId), {
      recursive: true,
      force: true,
    }),
  );
}

export async function copyCharacterGallery(
  fromId: string,
  toId: string,
  records: CharacterGalleryImageRecord[],
): Promise<CharacterGalleryImageRecord[]> {
  if (records.length === 0) return [];
  await ensureCharacterGalleryDir(toId);
  const copied: CharacterGalleryImageRecord[] = [];
  for (const record of records) {
    if (!(await characterGalleryImageExists(fromId, record))) continue;
    await copyFile(
      characterGalleryFilePath(fromId, record.id, record.ext),
      characterGalleryFilePath(toId, record.id, record.ext),
    );
    copied.push({ ...record });
  }
  return copied;
}
