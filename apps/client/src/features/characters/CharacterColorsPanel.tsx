import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import {
  IconColorPicker,
  IconPalette,
  IconRestore,
  IconX,
} from "@tabler/icons-react";
import { Button, notifications, TextInput } from "@/components/ui";
import { formatChatText } from "@/features/chats/formatChatText";
import { useChatTextFormat } from "@/features/chats/useChatTextFormat";
import {
  displayColorLabel,
  extractColorsFromImageUrl,
  messageBoxStyle,
  nameColorStyle,
  normalizeColorValue,
  solidHexForPicker,
  swatchBackground,
} from "./characterColors";
import formClasses from "./CharacterForm.module.css";
import classes from "./CharacterColorsPanel.module.css";

type CharacterColorsPanelProps = {
  characterName: string;
  avatarUrl: string | null;
  nameColor: string | null;
  dialogueColor: string | null;
  messageBoxColor: string | null;
  onNameColorChange: (value: string | null) => void;
  onDialogueColorChange: (value: string | null) => void;
  onMessageBoxColorChange: (value: string | null) => void;
};

type ColorFieldProps = {
  label: string;
  hint: string;
  value: string | null;
  onChange: (value: string | null) => void;
  allowGradient?: boolean;
};

function ColorField({
  label,
  hint,
  value,
  onChange,
  allowGradient = false,
}: ColorFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const rootRef = useRef<HTMLDivElement>(null);
  const pickerId = useId();
  const solidHex = solidHexForPicker(value) ?? "#9a75d7";

  useEffect(() => {
    if (open) setDraft(value ?? "");
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function commitDraft() {
    onChange(normalizeColorValue(draft));
  }

  const swatchStyle: CSSProperties = value
    ? { background: swatchBackground(value) }
    : undefined;

  return (
    <div className={`${formClasses.field} ${classes.colorField}`} ref={rootRef}>
      <span className={formClasses.fieldLabel}>{label}</span>
      <p className={formClasses.fieldHint}>{hint}</p>

      <button
        type="button"
        className={classes.colorTrigger}
        aria-expanded={open}
        aria-controls={pickerId}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={[classes.swatch, value ? "" : classes.swatchEmpty]
            .filter(Boolean)
            .join(" ")}
          style={swatchStyle}
          aria-hidden
        />
        <span className={classes.colorValue}>{displayColorLabel(value)}</span>
        <IconColorPicker size={16} stroke={1.6} aria-hidden />
      </button>

      {open ? (
        <div id={pickerId} className={classes.popover} role="dialog">
          <div className={classes.popoverRow}>
            <label className={classes.nativePicker}>
              <span className={classes.srOnly}>Pick solid color</span>
              <input
                type="color"
                value={solidHex}
                onChange={(event) => {
                  const next = event.currentTarget.value;
                  setDraft(next);
                  onChange(next);
                }}
              />
            </label>
            <TextInput
              value={draft}
              placeholder={
                allowGradient
                  ? "#9a75d7 or linear-gradient(...)"
                  : "rgba(154, 117, 215, 0.22)"
              }
              onChange={(event) => setDraft(event.currentTarget.value)}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitDraft();
                  setOpen(false);
                }
              }}
            />
          </div>
          <div className={classes.popoverActions}>
            <Button
              type="button"
              variant="subtle"
              size="sm"
              onClick={() => {
                setDraft("");
                onChange(null);
                setOpen(false);
              }}
            >
              <IconX size={14} />
              Clear
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                commitDraft();
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
          {allowGradient ? (
            <p className={classes.popoverHint}>
              Tip: paste a CSS gradient for the name, e.g.{" "}
              <code>linear-gradient(90deg, #9a75d7, #c4b5fd)</code>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const PREVIEW_SAMPLE =
  'They jump down, landing behind you, and straighten up. "Hello there."';

export function CharacterColorsPanel({
  characterName,
  avatarUrl,
  nameColor,
  dialogueColor,
  messageBoxColor,
  onNameColorChange,
  onDialogueColorChange,
  onMessageBoxColorChange,
}: CharacterColorsPanelProps) {
  const [extracting, setExtracting] = useState(false);
  const textFormat = useChatTextFormat(dialogueColor);
  const displayName = characterName.trim() || "Character";
  const hasCustomColors =
    nameColor != null || dialogueColor != null || messageBoxColor != null;

  function handleResetColors() {
    onNameColorChange(null);
    onDialogueColorChange(null);
    onMessageBoxColorChange(null);
  }

  async function handleExtract() {
    if (!avatarUrl) {
      notifications.show({
        title: "No avatar",
        message: "Upload an avatar first to extract colors.",
        color: "red",
      });
      return;
    }
    setExtracting(true);
    try {
      const palette = await extractColorsFromImageUrl(avatarUrl);
      if (!palette) throw new Error("Could not sample avatar colors");
      onNameColorChange(palette.name_color);
      onDialogueColorChange(palette.dialogue_color);
      onMessageBoxColorChange(palette.message_box_color);
      notifications.show({
        title: "Colors extracted",
        message: "Palette applied from the avatar. Save to keep changes.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Extract failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className={formClasses.stack}>
      <div className={classes.header}>
        <h3 className={classes.title}>Colors</h3>
        <p className={classes.hint}>
          Customize how this character appears in chats — name, quoted dialogue,
          and message bubble.
        </p>
      </div>

      <div className={classes.actions}>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={extracting}
          leftSection={<IconPalette size={16} stroke={1.6} />}
          onClick={() => void handleExtract()}
        >
          {extracting ? "Extracting…" : "Extract from avatar"}
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={!hasCustomColors}
          leftSection={<IconRestore size={16} stroke={1.6} />}
          onClick={handleResetColors}
        >
          Reset colors
        </Button>
      </div>

      <section className={classes.preview} aria-label="Color preview">
        <span className={formClasses.fieldLabel}>Preview</span>
        <div
          className={classes.previewCard}
          style={messageBoxStyle(messageBoxColor)}
        >
          <span className={classes.previewAvatar}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              displayName.slice(0, 1).toUpperCase()
            )}
          </span>
          <div className={classes.previewBody}>
            <p
              className={classes.previewName}
              style={nameColorStyle(nameColor)}
            >
              {displayName}
            </p>
            <p className={classes.previewText}>
              {formatChatText(PREVIEW_SAMPLE, textFormat)}
            </p>
          </div>
        </div>
      </section>

      <ColorField
        label="Name display color"
        hint="Color or gradient for the character name in chat messages and sidebar tabs."
        value={nameColor}
        onChange={onNameColorChange}
        allowGradient
      />
      <ColorField
        label="Dialogue highlight color"
        hint={
          'Text inside dialogue quotation marks ("", \'\', «», 「」, 『』) uses this color. Bolding can be toggled in Settings → Text formats.'
        }
        value={dialogueColor}
        onChange={onDialogueColorChange}
      />
      <ColorField
        label="Message box color"
        hint="Background for this character's chat bubbles. Semi-transparent colors (e.g. rgba) usually look best."
        value={messageBoxColor}
        onChange={onMessageBoxColorChange}
      />
    </div>
  );
}
