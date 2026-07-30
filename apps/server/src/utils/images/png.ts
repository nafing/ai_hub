export const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

export function isPngBuffer(buffer: Buffer): boolean {
  return buffer.length >= 8 && PNG_SIGNATURE.equals(buffer.subarray(0, 8));
}

export function isJpegBuffer(buffer: Buffer): boolean {
  return buffer.length >= 3 && JPEG_SIGNATURE.equals(buffer.subarray(0, 3));
}

export function assertPngBuffer(
  buffer: Buffer,
  message = "Avatar must be a PNG file",
): void {
  if (!isPngBuffer(buffer)) {
    throw new Error(message);
  }
}
