/** OpenRouter-normalized aspect ratios used for conversation send_image. */
export const IMAGE_ASPECT_RATIOS = [
  "1:1",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
  "2:3",
  "3:2",
] as const;

export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];

/** OpenRouter resolution tiers for conversation send_image. */
export const IMAGE_RESOLUTIONS = ["512", "1K", "2K", "4K"] as const;

export type ImageResolution = (typeof IMAGE_RESOLUTIONS)[number];

export const DEFAULT_IMAGE_ASPECT_RATIO: ImageAspectRatio = "3:4";
export const DEFAULT_IMAGE_RESOLUTION: ImageResolution = "1K";

export const IMAGE_ASPECT_RATIO_LABELS: Record<ImageAspectRatio, string> = {
  "1:1": "1:1 · Square",
  "3:4": "3:4 · Portrait (phone)",
  "4:3": "4:3 · Landscape",
  "9:16": "9:16 · Story / tall",
  "16:9": "16:9 · Widescreen",
  "2:3": "2:3 · Portrait",
  "3:2": "3:2 · Landscape",
};

export const IMAGE_RESOLUTION_LABELS: Record<ImageResolution, string> = {
  "512": "512 · Small / fast",
  "1K": "1K · Default",
  "2K": "2K · High",
  "4K": "4K · Max",
};

export function normalizeImageAspectRatio(
  value: unknown,
): ImageAspectRatio {
  if (
    typeof value === "string" &&
    (IMAGE_ASPECT_RATIOS as readonly string[]).includes(value)
  ) {
    return value as ImageAspectRatio;
  }
  return DEFAULT_IMAGE_ASPECT_RATIO;
}

export function normalizeImageResolution(value: unknown): ImageResolution {
  if (
    typeof value === "string" &&
    (IMAGE_RESOLUTIONS as readonly string[]).includes(value)
  ) {
    return value as ImageResolution;
  }
  return DEFAULT_IMAGE_RESOLUTION;
}
