import { assertPngBuffer, isJpegBuffer } from "./png";

export type DecodedImageDataUrl = {
  buffer: Buffer;
  mime: "image/png" | "image/jpeg" | "image/webp";
  ext: "png" | "jpg" | "webp";
};

export function decodeImageDataUrl(value: string): DecodedImageDataUrl {
  const dataUrl = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i.exec(
    value.trim(),
  );
  if (dataUrl) {
    const mimeRaw = dataUrl[1]!.toLowerCase();
    const buffer = Buffer.from(dataUrl[2]!, "base64");
    if (mimeRaw === "image/png") {
      assertPngBuffer(buffer, "Invalid PNG data");
      return { buffer, mime: "image/png", ext: "png" };
    }
    if (mimeRaw === "image/webp") {
      return { buffer, mime: "image/webp", ext: "webp" };
    }
    if (!isJpegBuffer(buffer)) {
      throw new Error("Invalid JPEG data");
    }
    return { buffer, mime: "image/jpeg", ext: "jpg" };
  }

  throw new Error("Image must be a PNG, JPEG, or WebP data URL");
}

export function decodeTwatterImageDataUrl(
  dataUrl: string,
): { buffer: Buffer; ext: "png" | "jpg" } {
  const decoded = decodeImageDataUrl(dataUrl);
  if (decoded.mime === "image/webp") {
    throw new Error("Image must be a PNG or JPEG data URL");
  }
  return {
    buffer: decoded.buffer,
    ext: decoded.ext === "png" ? "png" : "jpg",
  };
}
