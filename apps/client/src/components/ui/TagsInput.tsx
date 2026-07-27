import { useState, type KeyboardEvent, type ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import classes from "./TagsInput.module.css";

export type TagsInputProps = {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  formatTag?: (tag: string) => ReactNode;
  className?: string;
};

export function TagsInput({
  value,
  onChange,
  placeholder = "Add tag…",
  disabled = false,
  formatTag,
  className,
}: TagsInputProps) {
  const [draft, setDraft] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((item) => item !== tag));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(draft);
      return;
    }
    if (event.key === "Backspace" && !draft && value.length > 0) {
      removeTag(value[value.length - 1]!);
    }
  }

  return (
    <div
      className={[classes.root, className].filter(Boolean).join(" ")}
      data-disabled={disabled || undefined}
    >
      <div className={classes.control} data-glass-surface>
        {value.map((tag) => (
          <span key={tag} className={classes.pill}>
            <span className={classes.pillLabel}>
              {formatTag ? formatTag(tag) : tag}
            </span>
            {!disabled ? (
              <button
                type="button"
                className={classes.pillRemove}
                aria-label={`Remove ${tag}`}
                onClick={() => removeTag(tag)}
              >
                <IconX size={12} />
              </button>
            ) : null}
          </span>
        ))}
        <input
          className={classes.input}
          value={draft}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : ""}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft.trim()) addTag(draft);
          }}
        />
      </div>
    </div>
  );
}
