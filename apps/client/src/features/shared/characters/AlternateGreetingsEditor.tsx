import type { ReactNode } from "react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import classes from "./AlternateGreetingsEditor.module.css";
import { ActionIcon, Button, Textarea } from "@/components/ui";

type AlternateGreetingsEditorProps = {
  label?: string;
  description?: string;
  emptyLabel?: string;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  /** Optional control rendered opposite the label (e.g. Generate / Rebuild). */
  action?: ReactNode;
};

export function AlternateGreetingsEditor({
  label = "Alternate greetings",
  description = "Extra opening messages (swipe alternatives to first_mes).",
  emptyLabel = "No alternate greetings yet.",
  value,
  onChange,
  disabled = false,
  action,
}: AlternateGreetingsEditorProps) {
  const greetings = value.length > 0 ? value : [];

  function updateAt(index: number, next: string) {
    const copy = [...greetings];
    copy[index] = next;
    onChange(copy);
  }

  function removeAt(index: number) {
    onChange(greetings.filter((_, i) => i !== index));
  }

  function addGreeting() {
    onChange([...greetings, ""]);
  }

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <div className={classes.labels}>
          <span className={classes.label}>{label}</span>
          {description ? (
            <p className={classes.hint}>{description}</p>
          ) : null}
        </div>
        <div className={classes.headerActions}>
          {action}
          <Button
            type="button"
            variant="default"
            size="sm"
            leftSection={<IconPlus size={14} />}
            disabled={disabled}
            onClick={addGreeting}
          >
            Add
          </Button>
        </div>
      </div>

      {greetings.length === 0 ? (
        <p className={classes.empty}>{emptyLabel}</p>
      ) : (
        <div className={classes.list}>
          {greetings.map((greeting, index) => (
            <div key={index} className={classes.row}>
              <Textarea
                className={classes.textarea}
                aria-label={`Alternate greeting ${index + 1}`}
                value={greeting}
                disabled={disabled}
                onChange={(event) => updateAt(index, event.target.value)}
              />
              <ActionIcon type="button" variant="ghostDanger" aria-label={`Remove greeting ${index + 1}`} disabled={disabled} onClick={() => removeAt(index)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
