import { Button, Checkbox, Slider, Switch } from "@/components/ui";
import { previewAppSound, type SoundCategory } from "./playSound";
import { useSoundStore } from "./soundStore";
import classes from "./SoundSettings.module.css";

const CATEGORIES: Array<{
  id: SoundCategory;
  label: string;
  hint: string;
}> = [
  {
    id: "chat",
    label: "Chat",
    hint: "When a reply finishes generating.",
  },
  {
    id: "generator",
    label: "Generators",
    hint: "When a generator or preset test completes.",
  },
  {
    id: "twatter",
    label: "Twatter",
    hint: "Timeline refresh and new notifications.",
  },
];

export function SoundSettings() {
  const enabled = useSoundStore((s) => s.enabled);
  const volume = useSoundStore((s) => s.volume);
  const chat = useSoundStore((s) => s.chat);
  const generator = useSoundStore((s) => s.generator);
  const twatter = useSoundStore((s) => s.twatter);
  const setEnabled = useSoundStore((s) => s.setEnabled);
  const setVolume = useSoundStore((s) => s.setVolume);
  const setCategoryEnabled = useSoundStore((s) => s.setCategoryEnabled);

  const categoryEnabled = { chat, generator, twatter };

  return (
    <div className={classes.panel}>
      <div className={classes.row}>
        <div className={classes.labelGroup}>
          <span className={classes.label}>Sound effects</span>
          <span className={classes.hint}>
            Short tones for chat replies, generators, and Twatter activity.
          </span>
        </div>
        <Switch checked={enabled} onChange={setEnabled} aria-label="Sound effects" />
      </div>

      <div className={classes.row}>
        <span className={classes.label}>Volume</span>
        <div className={classes.volumeRow}>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={setVolume}
            disabled={!enabled}
          />
          <span className={classes.volumeValue}>{Math.round(volume * 100)}%</span>
        </div>
      </div>

      <div className={classes.categoryList}>
        {CATEGORIES.map((category) => (
          <div key={category.id} className={classes.categoryRow}>
            <div className={classes.labelGroup}>
              <span className={classes.label}>{category.label}</span>
              <span className={classes.hint}>{category.hint}</span>
            </div>
            <div className={classes.categoryActions}>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={!enabled || !categoryEnabled[category.id]}
                onClick={() => previewAppSound(category.id)}
              >
                Test
              </Button>
              <Checkbox
                checked={categoryEnabled[category.id]}
                disabled={!enabled}
                onChange={(checked) =>
                  setCategoryEnabled(category.id, checked)
                }
                aria-label={`${category.label} sounds`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
