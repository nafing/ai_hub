import { writeFile, mkdir, unlink, access } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { decodeTwatterImageDataUrl } from "../../../utils/images/data-url";
import { ignoreEnoent } from "../../../utils/fs";
import { imageApiPaths, uploadsPath } from "../paths";

function getTwatterImagesDir(): string {
  return process.env.SERVER_TWATTER_IMAGES_DIR ?? uploadsPath("twatter");
}

export function twatterImageFilePath(postId: string, ext: "png" | "jpg"): string {
  return path.join(getTwatterImagesDir(), `${postId}.${ext}`);
}

async function ensureTwatterImagesDir(): Promise<void> {
  await mkdir(getTwatterImagesDir(), { recursive: true });
}

export async function twatterImageExists(
  postId: string,
): Promise<"png" | "jpg" | null> {
  for (const ext of ["png", "jpg"] as const) {
    try {
      await access(twatterImageFilePath(postId, ext), constants.R_OK);
      return ext;
    } catch {
      // try next extension
    }
  }
  return null;
}

export async function writeTwatterPostImage(
  postId: string,
  dataUrl: string,
): Promise<"png" | "jpg"> {
  const { buffer, ext } = decodeTwatterImageDataUrl(dataUrl);
  await ensureTwatterImagesDir();
  for (const candidate of ["png", "jpg"] as const) {
    if (candidate === ext) continue;
    await ignoreEnoent(() => unlink(twatterImageFilePath(postId, candidate)));
  }
  await writeFile(twatterImageFilePath(postId, ext), buffer);
  return ext;
}

export function twatterPostImagePublicUrl(postId: string): string {
  return imageApiPaths.twatterPost(postId);
}

export function normalizeTwatterPostImageInput(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }
  return null;
}
