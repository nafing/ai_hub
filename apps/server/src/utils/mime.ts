export const IMAGE_MIMES = new Set([
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

export function attachmentKindForMime(mime: string): "image" | "file" {
  return IMAGE_MIMES.has(normalizeMime(mime)) ? "image" : "file";
}

export function assertImageMime(
  mime: string,
  message = "Image must be PNG, JPEG, WebP, or GIF",
): string {
  const normalized = normalizeMime(mime);
  if (!IMAGE_MIMES.has(normalized)) {
    throw new Error(message);
  }
  return normalized;
}

export function inferImageMimeFromContentType(
  contentType: string | null | undefined,
): "image/png" | "image/jpeg" | "image/webp" {
  const value = (contentType || "").toLowerCase();
  if (value.includes("jpeg") || value.includes("jpg")) return "image/jpeg";
  if (value.includes("webp")) return "image/webp";
  return "image/png";
}
