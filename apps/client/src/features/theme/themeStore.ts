import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hexToHsl, hslToHex, hexToRgb, rgbToHex } from "./colorUtils";
import {
  ACCENT_SWATCHES,
  DEFAULT_PRESET,
  type BaseColorKey,
  type BaseColors,
  type ThemeMode,
  type ThemePresetId,
  THEME_PRESETS,
} from "./presets";

export type AccentSource = "custom" | (typeof ACCENT_SWATCHES)[number];

interface ThemeState {
  mode: ThemeMode;
  presetId: ThemePresetId;
  accentSource: AccentSource;
  accentH: number;
  accentS: number;
  accentL: number;
  baseColors: BaseColors;
  editingKey: BaseColorKey;
  cornerRadius: number;
  fontScale: number;
  uiScale: number;
  glassEffects: boolean;
  setMode: (mode: ThemeMode) => void;
  setPreset: (id: ThemePresetId) => void;
  setAccentSwatch: (hex: (typeof ACCENT_SWATCHES)[number]) => void;
  setAccentCustom: () => void;
  setAccentHsl: (partial: { h?: number; s?: number; l?: number }) => void;
  setEditingKey: (key: BaseColorKey) => void;
  setBaseColor: (key: BaseColorKey, hex: string) => void;
  setEditingHex: (hex: string) => void;
  setEditingRgb: (channel: "r" | "g" | "b", value: number) => void;
  setEditingHue: (h: number) => void;
  setEditingSv: (s: number, l: number) => void;
  resetEditingColor: () => void;
  resetToDefault: () => void;
  setCornerRadius: (v: number) => void;
  setFontScale: (v: number) => void;
  setUiScale: (v: number) => void;
  setGlassEffects: (v: boolean) => void;
}

const getPresetColors = (id: ThemePresetId) =>
  THEME_PRESETS.find((p) => p.id === id)?.colors ?? DEFAULT_PRESET.colors;

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "dark",
      presetId: DEFAULT_PRESET.id,
      accentSource: "custom",
      accentH: DEFAULT_PRESET.accent.h,
      accentS: DEFAULT_PRESET.accent.s,
      accentL: DEFAULT_PRESET.accent.l,
      baseColors: { ...DEFAULT_PRESET.colors },
      editingKey: "primary",
      cornerRadius: 1,
      fontScale: 1,
      uiScale: 1,
      glassEffects: true,

      setMode: (mode) => set({ mode }),

      setPreset: (id) => {
        const preset = THEME_PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET;
        set({
          presetId: preset.id,
          baseColors: { ...preset.colors },
          accentH: preset.accent.h,
          accentS: preset.accent.s,
          accentL: preset.accent.l,
          accentSource: "custom",
          editingKey: "primary",
        });
      },

      setAccentSwatch: (hex) => {
        const hsl = hexToHsl(hex);
        if (!hsl) return;
        set({
          accentSource: hex,
          accentH: hsl.h,
          accentS: hsl.s,
          accentL: hsl.l,
          baseColors: {
            ...get().baseColors,
            primary: hex,
          },
        });
      },

      setAccentCustom: () => set({ accentSource: "custom" }),

      setAccentHsl: (partial) => {
        const next = {
          accentH: partial.h ?? get().accentH,
          accentS: partial.s ?? get().accentS,
          accentL: partial.l ?? get().accentL,
        };
        const hex = hslToHex(next.accentH, next.accentS, next.accentL);
        set({
          ...next,
          accentSource: "custom",
          baseColors: { ...get().baseColors, primary: hex },
        });
      },

      setEditingKey: (key) => set({ editingKey: key }),

      setBaseColor: (key, hex) => {
        const normalized = hex.startsWith("#") ? hex : `#${hex}`;
        const rgb = hexToRgb(normalized);
        if (!rgb) return;
        const nextHex = rgbToHex(rgb.r, rgb.g, rgb.b);
        const nextColors = {
          ...get().baseColors,
          [key]: nextHex,
        };
        const patch: Partial<ThemeState> = { baseColors: nextColors };
        if (key === "primary") {
          const hsl = hexToHsl(nextHex);
          if (hsl) {
            patch.accentH = hsl.h;
            patch.accentS = hsl.s;
            patch.accentL = hsl.l;
            patch.accentSource = "custom";
          }
        }
        set(patch);
      },

      setEditingHex: (hex) => {
        const normalized = hex.startsWith("#") ? hex : `#${hex}`;
        const rgb = hexToRgb(normalized);
        if (!rgb) return;
        const key = get().editingKey;
        const nextColors = {
          ...get().baseColors,
          [key]: rgbToHex(rgb.r, rgb.g, rgb.b),
        };
        const patch: Partial<ThemeState> = { baseColors: nextColors };
        if (key === "primary") {
          const hsl = hexToHsl(nextColors.primary);
          if (hsl) {
            patch.accentH = hsl.h;
            patch.accentS = hsl.s;
            patch.accentL = hsl.l;
            patch.accentSource = "custom";
          }
        }
        set(patch);
      },

      setEditingRgb: (channel, value) => {
        const key = get().editingKey;
        const current = hexToRgb(get().baseColors[key]);
        if (!current) return;
        const next = { ...current, [channel]: value };
        get().setEditingHex(rgbToHex(next.r, next.g, next.b));
      },

      setEditingHue: (h) => {
        const key = get().editingKey;
        const hsl = hexToHsl(get().baseColors[key]);
        if (!hsl) return;
        get().setEditingHex(hslToHex(h, hsl.s, hsl.l));
      },

      setEditingSv: (s, l) => {
        const key = get().editingKey;
        const hsl = hexToHsl(get().baseColors[key]);
        if (!hsl) return;
        get().setEditingHex(hslToHex(hsl.h, s, l));
      },

      resetEditingColor: () => {
        const key = get().editingKey;
        const defaults = getPresetColors(get().presetId);
        get().setEditingHex(defaults[key]);
      },

      resetToDefault: () =>
        set({
          mode: "dark",
          presetId: DEFAULT_PRESET.id,
          accentSource: "custom",
          accentH: DEFAULT_PRESET.accent.h,
          accentS: DEFAULT_PRESET.accent.s,
          accentL: DEFAULT_PRESET.accent.l,
          baseColors: { ...DEFAULT_PRESET.colors },
          editingKey: "primary",
          cornerRadius: 1,
          fontScale: 1,
          uiScale: 1,
          glassEffects: true,
        }),

      setCornerRadius: (v) => set({ cornerRadius: v }),
      setFontScale: (v) => set({ fontScale: v }),
      setUiScale: (v) => set({ uiScale: v }),
      setGlassEffects: (v) => set({ glassEffects: v }),
    }),
    {
      name: "ai-hub-theme",
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<ThemeState>;
        return {
          ...current,
          ...stored,
          baseColors: {
            ...current.baseColors,
            ...stored.baseColors,
          },
        };
      },
    },
  ),
);
