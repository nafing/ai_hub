import type { CSSProperties } from "react";
import { rgbToHsl, withAlpha } from "@/features/shared/theme/colorUtils";

export function isCssGradient(value: string | null | undefined): boolean {
  if (!value) return false;
  return /gradient\s*\(/i.test(value);
}

export function nameColorStyle(
  value: string | null | undefined,
): CSSProperties | undefined {
  const color = value?.trim();
  if (!color) return undefined;
  if (isCssGradient(color)) {
    return {
      backgroundImage: color,
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      color: "transparent",
      WebkitTextFillColor: "transparent",
    };
  }
  return { color };
}

export function messageBoxStyle(
  value: string | null | undefined,
): CSSProperties | undefined {
  const color = value?.trim();
  if (!color) return undefined;
  return { background: color };
}

/** Solid hex suitable for `<input type="color">`, or null. */
export function solidHexForPicker(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw || isCssGradient(raw)) return null;
  const hexMatch = raw.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/);
  if (hexMatch) {
    const cleaned = hexMatch[1]!;
    if (cleaned.length === 3) {
      return `#${cleaned
        .split("")
        .map((c) => c + c)
        .join("")
        .toLowerCase()}`;
    }
    return `#${cleaned.toLowerCase()}`;
  }
  const rgba = raw.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i,
  );
  if (rgba) {
    const to = (n: string) =>
      Math.min(255, Math.max(0, Number(n))).toString(16).padStart(2, "0");
    return `#${to(rgba[1]!)}${to(rgba[2]!)}${to(rgba[3]!)}`;
  }
  return null;
}

type Rgb = { r: number; g: number; b: number };

function colorScore(rgb: Rgb): number {
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  // Prefer saturated mid-lightness colors (good for accents).
  const lightnessPenalty = Math.abs(l - 50) / 50;
  return s * (1 - lightnessPenalty * 0.65) + (h === 0 && s < 8 ? -40 : 0);
}

function toHex(rgb: Rgb): string {
  const to = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, "0");
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`;
}

function distance(a: Rgb, b: Rgb): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

/**
 * Sample an image URL and pick three accent colors for name / dialogue / bubble.
 */
export async function extractColorsFromImageUrl(imageUrl: string): Promise<{
  name_color: string;
  dialogue_color: string;
  message_box_color: string;
} | null> {
  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map<string, { rgb: Rgb; count: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a < 128) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    // Skip near-black / near-white.
    const { l, s } = rgbToHsl(r, g, b);
    if (l < 8 || l > 94 || s < 6) continue;
    const key = `${Math.round(r / 24)},${Math.round(g / 24)},${Math.round(b / 24)}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.rgb.r += r;
      existing.rgb.g += g;
      existing.rgb.b += b;
      existing.count += 1;
    } else {
      buckets.set(key, { rgb: { r, g, b }, count: 1 });
    }
  }

  const averages = [...buckets.values()]
    .map((bucket) => ({
      rgb: {
        r: bucket.rgb.r / bucket.count,
        g: bucket.rgb.g / bucket.count,
        b: bucket.rgb.b / bucket.count,
      },
      count: bucket.count,
    }))
    .map((item) => ({
      ...item,
      score: colorScore(item.rgb) + Math.log2(item.count + 1) * 4,
    }))
    .sort((a, b) => b.score - a.score);

  if (averages.length === 0) {
    // Fallback: sample center pixel regardless of filters.
    const mid = (size * size + size) * 2;
    const r = data[mid] ?? 154;
    const g = data[mid + 1] ?? 117;
    const b = data[mid + 2] ?? 215;
    const hex = toHex({ r, g, b });
    return {
      name_color: hex,
      dialogue_color: hex,
      message_box_color: withAlpha(hex, 0.18),
    };
  }

  const picked: Rgb[] = [];
  for (const candidate of averages) {
    if (picked.every((rgb) => distance(rgb, candidate.rgb) > 42)) {
      picked.push(candidate.rgb);
    }
    if (picked.length >= 3) break;
  }
  while (picked.length < 3) {
    picked.push(picked[picked.length - 1] ?? averages[0]!.rgb);
  }

  const name = toHex(picked[0]!);
  const dialogue = toHex(picked[1]!);
  const box = toHex(picked[2]!);
  return {
    name_color: name,
    dialogue_color: dialogue,
    message_box_color: withAlpha(box, 0.22),
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load avatar image"));
    img.src = url;
  });
}

export function swatchBackground(value: string | null | undefined): string {
  const color = value?.trim();
  if (!color) return "transparent";
  if (isCssGradient(color)) return color;
  return color;
}

/** Validate loosely: non-empty CSS color-ish string. */
export function normalizeColorValue(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed;
}

export function displayColorLabel(value: string | null | undefined): string {
  const color = value?.trim();
  if (!color) return "No color set — uses default";
  return color;
}
