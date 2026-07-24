import type { ReactNode } from "react";
import {
  ActionIcon,
  Button,
  Group,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";

type AlternateGreetingsEditorProps = {
  label?: string;
  description?: string;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  minRows?: number;
  /** Optional control rendered opposite the label (e.g. Generate / Rebuild). */
  action?: ReactNode;
};

export function AlternateGreetingsEditor({
  label = "Alternate greetings",
  description = "Extra opening messages (swipe alternatives to first_mes).",
  value,
  onChange,
  disabled = false,
  minRows = 3,
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
    <Stack gap="xs">
      <Group justify="space-between" align="flex-end" wrap="nowrap">
        <div>
          <Text size="sm" fw={500}>
            {label}
          </Text>
          {description ? (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          ) : null}
        </div>
        <Group gap="xs" wrap="nowrap">
          {action}
          <Button
            size="xs"
            variant="default"
            leftSection={<IconPlus size={14} />}
            disabled={disabled}
            onClick={addGreeting}
          >
            Add
          </Button>
        </Group>
      </Group>

      {greetings.length === 0 ? (
        <Text size="sm" c="dimmed">
          No alternate greetings yet.
        </Text>
      ) : (
        <Stack gap="sm">
          {greetings.map((greeting, index) => (
            <Group key={index} align="flex-start" wrap="nowrap" gap="xs">
              <Textarea
                aria-label={`Alternate greeting ${index + 1}`}
                autosize
                minRows={minRows}
                value={greeting}
                disabled={disabled}
                style={{ flex: 1 }}
                onChange={(event) =>
                  updateAt(index, event.currentTarget.value)
                }
              />
              <ActionIcon
                mt={4}
                variant="subtle"
                color="red"
                aria-label={`Remove greeting ${index + 1}`}
                disabled={disabled}
                onClick={() => removeAt(index)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
