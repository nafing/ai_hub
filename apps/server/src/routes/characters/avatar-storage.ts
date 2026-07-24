import { writeFile } from "node:fs/promises";
import { mkdir, unlink, copyFile, access } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/** Root directory for character avatar PNGs. */
export function getAvatarsDir(): string {
  return (
    process.env.SERVER_AVATARS_DIR ??
    path.resolve(__dirname, "../../../uploads/characters")
  );
}

export function avatarFilePath(characterId: string): string {
  return path.join(getAvatarsDir(), `${characterId}.png`);
}

export async function ensureAvatarsDir(): Promise<void> {
  await mkdir(getAvatarsDir(), { recursive: true });
}

export async function avatarExists(characterId: string): Promise<boolean> {
  try {
    await access(avatarFilePath(characterId), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function assertPngBuffer(buffer: Buffer): void {
  if (
    buffer.length < 8 ||
    !PNG_SIGNATURE.equals(buffer.subarray(0, 8))
  ) {
    throw new Error("Avatar must be a PNG file");
  }
}

export async function writeAvatarPng(
  characterId: string,
  buffer: Buffer,
): Promise<void> {
  assertPngBuffer(buffer);
  await ensureAvatarsDir();
  await writeFile(avatarFilePath(characterId), buffer);
}

export async function deleteAvatarFile(characterId: string): Promise<void> {
  try {
    await unlink(avatarFilePath(characterId));
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    if (code !== "ENOENT") throw error;
  }
}

export async function copyAvatarFile(
  fromId: string,
  toId: string,
): Promise<boolean> {
  if (!(await avatarExists(fromId))) return false;
  await ensureAvatarsDir();
  await copyFile(avatarFilePath(fromId), avatarFilePath(toId));
  return true;
}
