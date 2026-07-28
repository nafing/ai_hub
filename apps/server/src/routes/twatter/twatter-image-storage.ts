import { writeFile } from "node:fs/promises";
import { mkdir, unlink, access } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

export function getTwatterImagesDir(): string {
  return (
    process.env.SERVER_TWATTER_IMAGES_DIR ??
    path.resolve(__dirname, "../../../uploads/twatter")
  );
}

export function twatterImageFilePath(postId: string, ext: "png" | "jpg"): string {
  return path.join(getTwatterImagesDir(), `${postId}.${ext}`);
}

export async function ensureTwatterImagesDir(): Promise<void> {
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

function decodeDataUrl(dataUrl: string): { buffer: Buffer; ext: "png" | "jpg" } {
  const match = /^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) {
    throw new Error("Image must be a PNG or JPEG data URL");
  }
  const mime = match[1]!.toLowerCase();
  const buffer = Buffer.from(match[2]!, "base64");
  if (mime === "image/png") {
    if (buffer.length < 8 || !PNG_SIGNATURE.equals(buffer.subarray(0, 8))) {
      throw new Error("Invalid PNG data");
    }
    return { buffer, ext: "png" };
  }
  if (buffer.length < 3 || !JPEG_SIGNATURE.equals(buffer.subarray(0, 3))) {
    throw new Error("Invalid JPEG data");
  }
  return { buffer, ext: "jpg" };
}

export async function writeTwatterPostImage(
  postId: string,
  dataUrl: string,
): Promise<"png" | "jpg"> {
  const { buffer, ext } = decodeDataUrl(dataUrl);
  await ensureTwatterImagesDir();
  for (const candidate of ["png", "jpg"] as const) {
    if (candidate === ext) continue;
    try {
      await unlink(twatterImageFilePath(postId, candidate));
    } catch {
      // ignore missing alternate file
    }
  }
  await writeFile(twatterImageFilePath(postId, ext), buffer);
  return ext;
}

export function twatterPostImagePublicUrl(postId: string): string {
  return `/twatter/posts/${postId}/image`;
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
