export type ThemeMode = "dark" | "light" | "system";

export type BaseColorKey =
  | "primary"
  | "secondary"
  | "background"
  | "text"
  | "danger"
  | "success"
  | "warning"
  | "speech"
  | "thoughts";

export type BaseColors = Record<BaseColorKey, string>;

export type ThemePresetId =
  | "lumiverse-purple"
  | "midnight-blue"
  | "emerald"
  | "rose"
  | "amber"
  | "slate"
  | "lumiverse-light"
  | "auto-purple"
  | "character-aware";

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  swatch: string;
  gradient?: string;
  colors: BaseColors;
  accent: { h: number; s: number; l: number };
}

export const ACCENT_SWATCHES = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#38bdf8",
  "#3b82f6",
  "#818cf8",
  "#a855f7",
  "#ec4899",
] as const;

export const BASE_COLOR_META: { key: BaseColorKey; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "background", label: "Background" },
  { key: "text", label: "Text" },
  { key: "danger", label: "Danger" },
  { key: "success", label: "Success" },
  { key: "warning", label: "Warning" },
  { key: "speech", label: "Speech" },
  { key: "thoughts", label: "Thoughts" },
];

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "lumiverse-purple",
    label: "Lumiverse Purple",
    swatch: "#9a75d7",
    accent: { h: 263, s: 55, l: 65 },
    colors: {
      primary: "#9a75d7",
      secondary: "#6b7280",
      background: "#0c0c0e",
      text: "#f3f4f6",
      danger: "#ef4444",
      success: "#22c55e",
      warning: "#f59e0b",
      speech: "#c4b5fd",
      thoughts: "#e5e7eb",
    },
  },
  {
    id: "midnight-blue",
    label: "Midnight Blue",
    swatch: "#3b82f6",
    accent: { h: 217, s: 91, l: 60 },
    colors: {
      primary: "#3b82f6",
      secondary: "#64748b",
      background: "#0b1220",
      text: "#e2e8f0",
      danger: "#f87171",
      success: "#34d399",
      warning: "#fbbf24",
      speech: "#93c5fd",
      thoughts: "#cbd5e1",
    },
  },
  {
    id: "emerald",
    label: "Emerald",
    swatch: "#10b981",
    accent: { h: 160, s: 84, l: 39 },
    colors: {
      primary: "#10b981",
      secondary: "#6b7280",
      background: "#0a1210",
      text: "#ecfdf5",
      danger: "#f87171",
      success: "#34d399",
      warning: "#fbbf24",
      speech: "#6ee7b7",
      thoughts: "#d1fae5",
    },
  },
  {
    id: "rose",
    label: "Rose",
    swatch: "#f43f5e",
    accent: { h: 350, s: 89, l: 60 },
    colors: {
      primary: "#f43f5e",
      secondary: "#78716c",
      background: "#120a0c",
      text: "#fff1f2",
      danger: "#fb7185",
      success: "#4ade80",
      warning: "#fbbf24",
      speech: "#fda4af",
      thoughts: "#fecdd3",
    },
  },
  {
    id: "amber",
    label: "Amber",
    swatch: "#f59e0b",
    accent: { h: 38, s: 92, l: 50 },
    colors: {
      primary: "#f59e0b",
      secondary: "#78716c",
      background: "#120e08",
      text: "#fffbeb",
      danger: "#f87171",
      success: "#84cc16",
      warning: "#fbbf24",
      speech: "#fcd34d",
      thoughts: "#fde68a",
    },
  },
  {
    id: "slate",
    label: "Slate",
    swatch: "#64748b",
    accent: { h: 215, s: 16, l: 47 },
    colors: {
      primary: "#94a3b8",
      secondary: "#64748b",
      background: "#0f1419",
      text: "#f1f5f9",
      danger: "#f87171",
      success: "#4ade80",
      warning: "#fbbf24",
      speech: "#cbd5e1",
      thoughts: "#e2e8f0",
    },
  },
  {
    id: "lumiverse-light",
    label: "Lumiverse Light",
    swatch: "#c4b5fd",
    accent: { h: 258, s: 90, l: 76 },
    colors: {
      primary: "#7c3aed",
      secondary: "#6b7280",
      background: "#f8f7fc",
      text: "#1f1633",
      danger: "#dc2626",
      success: "#16a34a",
      warning: "#d97706",
      speech: "#8b5cf6",
      thoughts: "#4b5563",
    },
  },
  {
    id: "auto-purple",
    label: "Auto Purple",
    swatch: "#8b5cf6",
    accent: { h: 258, s: 90, l: 66 },
    colors: {
      primary: "#8b5cf6",
      secondary: "#71717a",
      background: "#0e0b14",
      text: "#f5f3ff",
      danger: "#f87171",
      success: "#34d399",
      warning: "#fbbf24",
      speech: "#a78bfa",
      thoughts: "#ddd6fe",
    },
  },
  {
    id: "character-aware",
    label: "Character Aware",
    swatch: "#ec4899",
    gradient: "linear-gradient(135deg, #ec4899, #3b82f6)",
    accent: { h: 330, s: 81, l: 60 },
    colors: {
      primary: "#a855f7",
      secondary: "#6b7280",
      background: "#0c0c0e",
      text: "#f3f4f6",
      danger: "#ef4444",
      success: "#22c55e",
      warning: "#f59e0b",
      speech: "#f9a8d4",
      thoughts: "#93c5fd",
    },
  },
];

export const DEFAULT_PRESET = THEME_PRESETS[0];
