import { IconRefresh } from "@tabler/icons-react";
import { Button, Switch } from "@/components/ui";
import { solidHexForPicker } from "@/features/shared/characters/characterColors";
import {
  DEFAULT_PRESET,
  THEME_PRESETS,
  type TextFormatColorKey,
  type ThemePresetId,
} from "@/features/shared/theme/presets";
import { useThemeStore } from "@/features/shared/theme/themeStore";
import { useChatFormatStore } from "./chatFormatStore";
import { formatChatText } from "./formatChatText";
import { useChatTextFormat } from "./useChatTextFormat";
import classes from "./TextFormatsSettings.module.css";

const FORMAT_COLORS: Array<{
  key: TextFormatColorKey;
  label: string;
  sample: string;
  hint: string;
}> = [
  {
    key: "speech",
    label: "Dialogue",
    sample: '"Hello there."',
    hint: 'Quoted speech — "", \'\', «», 「」, 『』, „”',
  },
  {
    key: "thoughts",
    label: "Thoughts",
    sample: "*Curious.*",
    hint: "Inner thoughts and italic actions — *text*",
  },
  {
    key: "emphasis",
    label: "Emphasis",
    sample: "**Really?**",
    hint: "Strong emphasis — **text**",
  },
];

const PREVIEW_SAMPLE =
  '*She looks over. „Hello there. *giggles* Really?”*';

export function TextFormatsSettings() {
  const baseColors = useThemeStore((s) => s.baseColors);
  const presetId = useThemeStore((s) => s.presetId);
  const setBaseColor = useThemeStore((s) => s.setBaseColor);
  const dialogueBold = useChatFormatStore((s) => s.dialogueBold);
  const setDialogueBold = useChatFormatStore((s) => s.setDialogueBold);
  const textFormat = useChatTextFormat();

  function resetFormatColors() {
    const defaults =
      THEME_PRESETS.find((preset) => preset.id === (presetId as ThemePresetId))
        ?.colors ?? DEFAULT_PRESET.colors;
    for (const { key } of FORMAT_COLORS) {
      setBaseColor(key, defaults[key]);
    }
  }

  return (
    <div className={classes.panel}>
      <p className={classes.intro}>
        Colors for roleplay markup in chat messages. Narration stays the
        default text color.
      </p>

      <section className={classes.preview} aria-label="Text format preview">
        <span className={classes.previewLabel}>Preview</span>
        <p className={classes.previewCard}>
          {formatChatText(PREVIEW_SAMPLE, textFormat)}
        </p>
      </section>

      <div className={classes.list}>
        {FORMAT_COLORS.map((item) => {
          const value = baseColors[item.key] ?? DEFAULT_PRESET.colors[item.key];
          const pickerHex = solidHexForPicker(value) ?? value;
          return (
            <div key={item.key} className={classes.row}>
              <div className={classes.labelGroup}>
                <span className={classes.label}>{item.label}</span>
                <span className={classes.sample}>{item.sample}</span>
                <span className={classes.hint}>{item.hint}</span>
              </div>
              <label className={classes.colorControl}>
                <span
                  className={classes.swatch}
                  style={{ background: value }}
                  aria-hidden
                />
                <input
                  type="color"
                  value={pickerHex}
                  aria-label={`${item.label} color`}
                  onChange={(event) =>
                    setBaseColor(item.key, event.currentTarget.value)
                  }
                />
                <span className={classes.hex}>{value.toUpperCase()}</span>
              </label>
            </div>
          );
        })}
      </div>

      <div className={classes.row}>
        <div className={classes.labelGroup}>
          <span className={classes.label}>Bold dialogue</span>
          <span className={classes.hint}>
            Render quoted speech in bold weight.
          </span>
        </div>
        <Switch
          checked={dialogueBold}
          onChange={setDialogueBold}
          aria-label="Bold dialogue"
        />
      </div>

      <Button
        type="button"
        variant="default"
        size="sm"
        className={classes.reset}
        leftSection={<IconRefresh size={15} />}
        onClick={resetFormatColors}
      >
        Reset format colors
      </Button>
    </div>
  );
}
