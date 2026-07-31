import { hslToHex, mixHex, withAlpha, hexToRgb } from "./colorUtils";
import { DEFAULT_PRESET, type BaseColors, type ThemeMode } from "./presets";

const DEFAULT_EMPHASIS = DEFAULT_PRESET.colors.emphasis;

function resolveMode(mode: ThemeMode): "dark" | "light" {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function luminance(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

export interface ApplyThemeInput {
  mode: ThemeMode;
  baseColors: BaseColors;
  accentH: number;
  accentS: number;
  accentL: number;
  cornerRadius: number;
  fontScale: number;
  uiScale: number;
  glassEffects: boolean;
}

export function applyThemeToDocument(input: ApplyThemeInput) {
  const root = document.documentElement;
  const resolved = resolveMode(input.mode);
  const { baseColors } = input;
  const primary =
    baseColors.primary || hslToHex(input.accentH, input.accentS, input.accentL);

  root.dataset.theme = resolved;
  root.dataset.glass = input.glassEffects ? "on" : "off";
  root.style.colorScheme = resolved;
  root.style.setProperty("--font-scale", String(input.fontScale));
  root.style.setProperty("--ui-scale", String(input.uiScale));
  root.style.setProperty("--radius-scale", String(input.cornerRadius));
  root.style.setProperty("--radius-sm", `${4 * input.cornerRadius}px`);
  root.style.setProperty("--radius-md", `${8 * input.cornerRadius}px`);
  root.style.setProperty("--radius-lg", `${12 * input.cornerRadius}px`);
  // Scale via root font-size (never zoom — zoom breaks layout).
  root.style.fontSize = `${16 * input.fontScale * input.uiScale}px`;

  const glass = input.glassEffects;
  root.style.setProperty("--glass-blur", glass ? "18px" : "0px");
  root.style.setProperty("--glass-saturate", glass ? "1.35" : "1");
  root.style.setProperty(
    "--glass-filter",
    glass ? "blur(18px) saturate(1.35)" : "none",
  );

  const surface = (hex: string, alpha: number) =>
    glass ? withAlpha(hex, alpha) : hex;

  const bgLum = luminance(baseColors.background);
  const textLum = luminance(baseColors.text);

  let paper = baseColors.background;
  let ink = baseColors.text;

  if (resolved === "dark" && bgLum > 0.45) {
    paper = "#0c0c0e";
  }
  if (resolved === "light" && bgLum < 0.45) {
    paper = "#f2f5f8";
  }
  if (resolved === "dark" && textLum < 0.45) {
    ink = "#f3f4f6";
  }
  if (resolved === "light" && textLum > 0.55) {
    ink = "#14181f";
  }

  const paperDeep =
    resolved === "dark"
      ? mixHex(paper, "#ffffff", 0.06)
      : mixHex(paper, "#000000", 0.045);
  const mist =
    resolved === "dark"
      ? mixHex(paper, "#ffffff", 0.14)
      : mixHex(paper, "#000000", 0.12);
  const surfaceHover =
    resolved === "dark"
      ? mixHex(paper, "#ffffff", 0.18)
      : mixHex(paper, "#000000", 0.16);
  const border =
    resolved === "dark"
      ? mixHex(paper, "#ffffff", 0.14)
      : mixHex(paper, "#000000", 0.14);
  const borderStrong =
    resolved === "dark"
      ? mixHex(paper, "#ffffff", 0.22)
      : mixHex(paper, "#000000", 0.22);
  const inkMuted = mixHex(ink, paper, 0.38);
  const inkSoft = mixHex(ink, paper, 0.52);
  const stage =
    resolved === "dark" ? mixHex(paper, "#000000", 0.28) : "#1e2a32";
  const accentHover = mixHex(
    primary,
    "#000000",
    resolved === "dark" ? 0.18 : 0.12,
  );
  const sidebarBg =
    resolved === "dark" ? mixHex(paper, "#000000", 0.2) : stage;
  const sidebarText = resolved === "dark" ? ink : "#e8edf2";

  root.style.setProperty("--color-ink", ink);
  root.style.setProperty("--color-ink-muted", inkMuted);
  root.style.setProperty("--color-ink-soft", inkSoft);
  root.style.setProperty("--color-paper", paper);
  root.style.setProperty("--color-paper-deep", paperDeep);
  root.style.setProperty("--color-mist", mist);
  root.style.setProperty("--color-accent", primary);
  root.style.setProperty("--color-accent-hover", accentHover);
  root.style.setProperty("--color-accent-soft", withAlpha(primary, 0.16));
  root.style.setProperty("--color-teal", baseColors.speech);
  root.style.setProperty(
    "--color-teal-deep",
    mixHex(baseColors.speech, "#000000", 0.35),
  );
  root.style.setProperty("--color-primary", primary);
  root.style.setProperty("--color-secondary", baseColors.secondary);
  root.style.setProperty("--color-danger", baseColors.danger);
  root.style.setProperty("--color-success", baseColors.success);
  root.style.setProperty("--color-warning", baseColors.warning);
  root.style.setProperty("--color-speech", baseColors.speech);
  root.style.setProperty("--color-thoughts", baseColors.thoughts);
  root.style.setProperty(
    "--color-emphasis",
    baseColors.emphasis ?? DEFAULT_EMPHASIS,
  );
  root.style.setProperty("--color-sidebar-text", sidebarText);

  // Aliases used by migrated CSS Modules UI.
  // When glass is on, surfaces become translucent so backdrop-filter can show through.
  root.style.setProperty("--color-bg", surface(paper, 0.62));
  root.style.setProperty("--color-surface", surface(paperDeep, 0.58));
  root.style.setProperty("--color-surface-raised", surface(mist, 0.55));
  root.style.setProperty(
    "--color-surface-hover",
    surface(surfaceHover, glass ? 0.5 : 1),
  );
  root.style.setProperty("--color-sidebar", surface(sidebarBg, glass ? 0.55 : 1));
  root.style.setProperty("--color-stage", surface(stage, glass ? 0.55 : 1));
  root.style.setProperty(
    "--color-border",
    glass ? withAlpha(ink, resolved === "dark" ? 0.12 : 0.14) : border,
  );
  root.style.setProperty(
    "--color-border-strong",
    glass ? withAlpha(ink, resolved === "dark" ? 0.2 : 0.22) : borderStrong,
  );
  root.style.setProperty("--color-text", ink);
  root.style.setProperty("--color-text-dimmed", inkMuted);
  root.style.setProperty("--color-text-muted", inkSoft);
  root.style.setProperty("--color-primary-hover", accentHover);
  root.style.setProperty("--color-primary-soft", withAlpha(primary, 0.16));
  root.style.setProperty("--color-primary-ring", withAlpha(primary, 0.45));
}
