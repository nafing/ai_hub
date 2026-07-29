import { createReadStream } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
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
};

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

export function getCharacterGalleryDir(characterId: string): string {
  const root =
    process.env.SERVER_CHARACTER_GALLERY_DIR ??
    path.resolve(__dirname, "../../../uploads/characters");
  return path.join(root, characterId, "gallery");
}

export function characterGalleryFilePath(
  characterId: string,
  imageId: string,
  ext: string,
): string {
  return path.join(getCharacterGalleryDir(characterId), `${imageId}.${ext}`);
}

export async function ensureCharacterGalleryDir(
  characterId: string,
): Promise<void> {
  await mkdir(getCharacterGalleryDir(characterId), { recursive: true });
}

export function normalizeGalleryMime(mime: string): string {
  const value = mime.trim().toLowerCase();
  if (value === "image/jpg") return "image/jpeg";
  return value || "application/octet-stream";
}

export function assertGalleryImageMime(mime: string): string {
  const normalized = normalizeGalleryMime(mime);
  if (!IMAGE_MIMES.has(normalized)) {
    throw new Error("Gallery image must be PNG, JPEG, WebP, or GIF");
  }
  return normalized;
}

export function extensionForGalleryMime(
  mime: string,
  fileName?: string,
): string {
  const normalized = normalizeGalleryMime(mime);
  if (EXT_BY_MIME[normalized]) return EXT_BY_MIME[normalized]!;
  const fromName = fileName?.includes(".")
    ? fileName.split(".").pop()?.toLowerCase()
    : undefined;
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  return "bin";
}

export function characterGalleryPublicUrl(
  characterId: string,
  imageId: string,
): string {
  return `/characters/${characterId}/gallery/${imageId}`;
}

export function toPublicGalleryImage(
  characterId: string,
  record: CharacterGalleryImageRecord,
): CharacterGalleryImage {
  return {
    id: record.id,
    url: characterGalleryPublicUrl(characterId, record.id),
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
      mime: normalizeGalleryMime(String(row.mime)),
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
  const mime = assertGalleryImageMime(input.mime);
  const ext = extensionForGalleryMime(mime, input.name);
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
  try {
    await unlink(
      characterGalleryFilePath(characterId, record.id, record.ext),
    );
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    if (code !== "ENOENT") throw error;
  }
}

export async function deleteCharacterGalleryDir(
  characterId: string,
): Promise<void> {
  try {
    await rm(getCharacterGalleryDir(characterId), {
      recursive: true,
      force: true,
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    if (code !== "ENOENT") throw error;
  }
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

/** Best-effort prune of orphaned files not referenced by gallery records. */
export async function pruneOrphanGalleryFiles(
  characterId: string,
  records: CharacterGalleryImageRecord[],
): Promise<void> {
  const dir = getCharacterGalleryDir(characterId);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  const keep = new Set(
    records.map((record) => `${record.id}.${record.ext}`),
  );
  for (const entry of entries) {
    if (keep.has(entry)) continue;
    try {
      await unlink(path.join(dir, entry));
    } catch {
      // ignore
    }
  }
}

export async function readGalleryFileBuffer(
  characterId: string,
  record: CharacterGalleryImageRecord,
): Promise<Buffer> {
  return readFile(
    characterGalleryFilePath(characterId, record.id, record.ext),
  );
}
