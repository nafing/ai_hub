import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  IconBookmark,
  IconCheck,
  IconDeviceDesktop,
  IconMoon,
  IconRefresh,
  IconSun,
} from "@tabler/icons-react";
import { ActionIcon, Button, TextInput, NumberInput, Checkbox, Slider } from "@/components/ui";
import { hexToHsl, hexToRgb, normalizeHex } from "./colorUtils";
import {
  ACCENT_SWATCHES,
  BASE_COLOR_META,
  THEME_PRESETS,
  type ThemeMode,
  type ThemePresetId,
} from "./presets";
import { useThemeStore } from "./themeStore";
import classes from "./ThemeSettings.module.css";

const MODE_OPTIONS: Array<{
  id: ThemeMode;
  label: string;
  icon: typeof IconMoon;
}> = [
  { id: "dark", label: "Dark", icon: IconMoon },
  { id: "light", label: "Light", icon: IconSun },
  { id: "system", label: "System", icon: IconDeviceDesktop },
];

function formatScale(value: number, digits = 2) {
  return `${value.toFixed(digits)}x`;
}

export function ThemeSettings() {
  const mode = useThemeStore((s) => s.mode);
  const presetId = useThemeStore((s) => s.presetId);
  const accentSource = useThemeStore((s) => s.accentSource);
  const accentH = useThemeStore((s) => s.accentH);
  const accentS = useThemeStore((s) => s.accentS);
  const accentL = useThemeStore((s) => s.accentL);
  const baseColors = useThemeStore((s) => s.baseColors);
  const editingKey = useThemeStore((s) => s.editingKey);
  const cornerRadius = useThemeStore((s) => s.cornerRadius);
  const fontScale = useThemeStore((s) => s.fontScale);
  const uiScale = useThemeStore((s) => s.uiScale);
  const glassEffects = useThemeStore((s) => s.glassEffects);

  const setMode = useThemeStore((s) => s.setMode);
  const setPreset = useThemeStore((s) => s.setPreset);
  const setAccentSwatch = useThemeStore((s) => s.setAccentSwatch);
  const setAccentCustom = useThemeStore((s) => s.setAccentCustom);
  const setAccentHsl = useThemeStore((s) => s.setAccentHsl);
  const setEditingKey = useThemeStore((s) => s.setEditingKey);
  const setEditingHex = useThemeStore((s) => s.setEditingHex);
  const setEditingRgb = useThemeStore((s) => s.setEditingRgb);
  const setEditingHue = useThemeStore((s) => s.setEditingHue);
  const setEditingSv = useThemeStore((s) => s.setEditingSv);
  const resetEditingColor = useThemeStore((s) => s.resetEditingColor);
  const setCornerRadius = useThemeStore((s) => s.setCornerRadius);
  const setFontScale = useThemeStore((s) => s.setFontScale);
  const setUiScale = useThemeStore((s) => s.setUiScale);
  const setGlassEffects = useThemeStore((s) => s.setGlassEffects);

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const editingHex = baseColors[editingKey];
  const editingHsl = useMemo(
    () => hexToHsl(editingHex) ?? { h: 263, s: 55, l: 65 },
    [editingHex],
  );
  const editingRgb = useMemo(
    () => hexToRgb(editingHex) ?? { r: 154, g: 117, b: 215 },
    [editingHex],
  );

  const customAccentOpen = accentSource === "custom";

  function onSvPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const node = svRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    setEditingSv(x * 100, (1 - y) * 100);
  }

  function onHuePointer(event: ReactPointerEvent<HTMLDivElement>) {
    const node = hueRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setEditingHue(x * 360);
  }

  return (
    <div className={classes.panel}>
      <section className={classes.section}>
        <h3 className={classes.sectionLabel}>Mode</h3>
        <div className={classes.modeGroup} data-glass-surface>
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = mode === option.id;
            return (
              <Button
                key={option.id}
                type="button"
                variant={active ? "light" : "ghost"}
                className={[
                  classes.modeButton,
                  active ? classes.modeButtonActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setMode(option.id)}
                leftSection={<Icon size={15} />}
              >
                <span className={classes.modeLabel}>{option.label}</span>
              </Button>
            );
          })}
        </div>
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionLabel}>Presets</h3>
        <div className={classes.presetGrid}>
          {THEME_PRESETS.map((preset) => {
            const active = presetId === preset.id;
            return (
              <Button
                key={preset.id}
                type="button"
                variant="ghost"
                className={[
                  classes.presetCard,
                  active ? classes.presetCardActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setPreset(preset.id)}
                leftSection={
                  <span
                    className={classes.presetSwatch}
                    style={{
                      background: preset.gradient ?? preset.swatch,
                    }}
                  >
                    {active ? <IconCheck size={12} color="#fff" /> : null}
                  </span>
                }
              >
                <span className={classes.presetName}>{preset.label}</span>
              </Button>
            );
          })}
        </div>
      </section>

      <section className={classes.section}>
        <div className={classes.sectionLabelRow}>
          <IconBookmark size={13} />
          <h3 className={classes.sectionLabel}>My Themes</h3>
        </div>
        <p className={classes.sectionHint}>
          Save your current theme to quickly switch between favorites.
        </p>
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionLabel}>Accent Color</h3>
        <div className={classes.accentRow}>
          {ACCENT_SWATCHES.map((swatch) => {
            const active = accentSource === swatch;
            return (
              <ActionIcon
                key={swatch}
                type="button"
                variant="ghost"
                className={[classes.swatch, active ? classes.swatchActive : ""]
                  .filter(Boolean)
                  .join(" ")}
                style={{ ["--swatch" as string]: swatch }}
                aria-label={`Accent ${swatch}`}
                onClick={() => setAccentSwatch(swatch)}
              />
            );
          })}
        </div>
        <Button
          type="button"
          variant={customAccentOpen ? "light" : "ghost"}
          size="sm"
          className={[
            classes.customButton,
            customAccentOpen ? classes.customButtonActive : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setAccentCustom()}
        >
          Custom
        </Button>

        {customAccentOpen ? (
          <div className={classes.hslBox} data-glass-surface>
            <div className={classes.hslRow}>
              <span className={classes.hslLabel}>Hue</span>
              <Slider
                min={0}
                max={360}
                value={Math.round(accentH)}
                onChange={(value) => setAccentHsl({ h: value })}
              />
              <span className={classes.hslValue}>{Math.round(accentH)}</span>
            </div>
            <div className={classes.hslRow}>
              <span className={classes.hslLabel}>Saturation</span>
              <Slider
                min={0}
                max={100}
                value={Math.round(accentS)}
                onChange={(value) => setAccentHsl({ s: value })}
              />
              <span className={classes.hslValue}>{Math.round(accentS)}%</span>
            </div>
            <div className={classes.hslRow}>
              <span className={classes.hslLabel}>Luminance</span>
              <Slider
                min={0}
                max={100}
                value={Math.round(accentL)}
                onChange={(value) => setAccentHsl({ l: value })}
              />
              <span className={classes.hslValue}>{Math.round(accentL)}%</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionLabel}>Base Colors</h3>
        <div className={classes.baseGrid}>
          {BASE_COLOR_META.map(({ key, label }) => {
            const active = editingKey === key;
            return (
              <Button
                key={key}
                type="button"
                variant="ghost"
                className={[
                  classes.baseItem,
                  active ? classes.baseItemActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setEditingKey(key)}
                leftSection={
                  <span
                    className={classes.baseSwatch}
                    style={{ ["--swatch" as string]: baseColors[key] }}
                  />
                }
              >
                <span className={classes.baseLabel}>{label}</span>
              </Button>
            );
          })}
        </div>

        <p className={classes.editingLabel}>Editing: {editingKey}</p>

        <div className={classes.picker}>
          <div
            ref={svRef}
            className={classes.svBox}
            style={{ ["--picker-h" as string]: String(editingHsl.h) }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              onSvPointer(event);
            }}
            onPointerMove={(event) => {
              if (event.buttons !== 1) return;
              onSvPointer(event);
            }}
          >
            <span
              className={classes.svThumb}
              style={{
                left: `${editingHsl.s}%`,
                top: `${100 - editingHsl.l}%`,
                background: editingHex,
              }}
            />
          </div>

          <div
            ref={hueRef}
            className={classes.hueTrack}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              onHuePointer(event);
            }}
            onPointerMove={(event) => {
              if (event.buttons !== 1) return;
              onHuePointer(event);
            }}
          >
            <span
              className={classes.hueThumb}
              style={{ left: `${(editingHsl.h / 360) * 100}%` }}
            />
          </div>

          <div className={classes.rgbRow}>
            <label className={classes.rgbField}>
              <span className={classes.rgbLabel}>Hex</span>
              <TextInput
                className={classes.rgbInput}
                value={editingHex.toUpperCase()}
                onChange={(event) => {
                  const next = normalizeHex(event.target.value);
                  if (next) setEditingHex(next);
                }}
              />
            </label>
            <label className={classes.rgbField}>
              <span className={classes.rgbLabel}>R</span>
              <NumberInput
                className={classes.rgbInput}
                min={0}
                max={255}
                value={editingRgb.r}
                onChange={(value) =>
                  setEditingRgb("r", value === "" ? 0 : value)
                }
              />
            </label>
            <label className={classes.rgbField}>
              <span className={classes.rgbLabel}>G</span>
              <NumberInput
                className={classes.rgbInput}
                min={0}
                max={255}
                value={editingRgb.g}
                onChange={(value) =>
                  setEditingRgb("g", value === "" ? 0 : value)
                }
              />
            </label>
            <label className={classes.rgbField}>
              <span className={classes.rgbLabel}>B</span>
              <NumberInput
                className={classes.rgbInput}
                min={0}
                max={255}
                value={editingRgb.b}
                onChange={(value) =>
                  setEditingRgb("b", value === "" ? 0 : value)
                }
              />
            </label>
          </div>

          <Button
            type="button"
            variant="default"
            size="sm"
            className={classes.resetButton}
            leftSection={<IconRefresh size={15} />}
            onClick={() => resetEditingColor()}
          >
            Reset
          </Button>
        </div>
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionLabel}>Controls</h3>
        <div className={classes.controls} data-glass-surface>
          <div className={classes.controlRow}>
            <span className={classes.hslLabel}>Corner Radius</span>
            <Slider
              min={0.5}
              max={2}
              step={0.1}
              value={cornerRadius}
              onChange={setCornerRadius}
            />
            <span className={classes.hslValue}>
              {formatScale(cornerRadius, 1)}
            </span>
          </div>
          <div className={classes.controlRow}>
            <span className={classes.hslLabel}>Font Scale</span>
            <Slider
              min={0.85}
              max={1.25}
              step={0.01}
              value={fontScale}
              onChange={setFontScale}
            />
            <span className={classes.hslValue}>{formatScale(fontScale)}</span>
          </div>
          <div className={classes.controlRow}>
            <span className={classes.hslLabel}>UI Scale</span>
            <Slider
              min={0.85}
              max={1.25}
              step={0.01}
              value={uiScale}
              onChange={setUiScale}
            />
            <span className={classes.hslValue}>{formatScale(uiScale)}</span>
          </div>
          <Checkbox
            label="Glass effects"
            checked={glassEffects}
            onChange={setGlassEffects}
          />
        </div>
      </section>
    </div>
  );
}

// Keep type export for callers that previously imported preset ids.
export type { ThemePresetId };
