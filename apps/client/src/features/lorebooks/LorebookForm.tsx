import { useMemo, useState } from "react";
import {
  Accordion,
  ActionIcon,
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  Tabs,
  TagsInput,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import {
  LOREBOOK_CATEGORIES,
  LOREBOOK_CATEGORY_LABELS,
  LOREBOOK_ENTRY_POSITIONS,
  DEFAULT_LOREBOOK_SCAN_DEPTH,
  DEFAULT_LOREBOOK_TOKEN_BUDGET,
  defaultLorebookEntry,
  type CreateLorebookInput,
  type LorebookCategory,
  type LorebookEntry,
  type LorebookEntryPosition,
} from "@ai-hub/shared";
import { useCharacters } from "@/features/characters/queries";
import { usePersonas } from "@/features/personas/queries";

export type LorebookFormValues = CreateLorebookInput;

type LorebookFormProps = {
  formId?: string;
  initialValues: LorebookFormValues;
  onSubmit: (values: LorebookFormValues) => Promise<void> | void;
};

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

export function LorebookForm({
  formId = "lorebook-form",
  initialValues,
  onSubmit,
}: LorebookFormProps) {
  const { data: characters } = useCharacters();
  const { data: personas } = usePersonas();
  const characterOptions = useMemo(
    () =>
      (characters ?? []).map((character) => ({
        value: character.id,
        label: character.name || character.id,
      })),
    [characters],
  );
  const personaOptions = useMemo(
    () =>
      (personas ?? []).map((persona) => ({
        value: persona.id,
        label: persona.name || persona.id,
      })),
    [personas],
  );

  const form = useForm<LorebookFormValues>({
    mode: "controlled",
    initialValues,
    validate: {
      name: isNotEmpty("Name is required"),
    },
  });

  const [extensionsJson, setExtensionsJson] = useState(
    formatJson(initialValues.extensions),
  );
  const [extensionsError, setExtensionsError] = useState<string | null>(null);

  function updateEntry(index: number, patch: Partial<LorebookEntry>) {
    const entries = [...form.values.entries];
    const current = entries[index];
    if (!current) return;
    entries[index] = { ...current, ...patch };
    form.setFieldValue("entries", entries);
  }

  function addEntry() {
    form.setFieldValue("entries", [
      ...form.values.entries,
      defaultLorebookEntry({
        insertion_order: (form.values.entries.length + 1) * 100,
        name: `Entry ${form.values.entries.length + 1}`,
      }),
    ]);
  }

  function removeEntry(index: number) {
    form.setFieldValue(
      "entries",
      form.values.entries.filter((_, i) => i !== index),
    );
  }

  return (
    <form
      id={formId}
      onSubmit={form.onSubmit((values) => {
        let extensions: Record<string, unknown> = {};
        try {
          const parsed: unknown = JSON.parse(extensionsJson || "{}");
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
          ) {
            setExtensionsError("Must be a JSON object");
            return;
          }
          extensions = parsed as Record<string, unknown>;
          setExtensionsError(null);
        } catch {
          setExtensionsError("Invalid JSON");
          return;
        }

        void onSubmit({
          ...values,
          scan_depth:
            values.scan_depth === undefined ||
            values.scan_depth === null ||
            Number.isNaN(values.scan_depth)
              ? DEFAULT_LOREBOOK_SCAN_DEPTH
              : values.scan_depth,
          token_budget:
            values.token_budget === undefined ||
            values.token_budget === null ||
            Number.isNaN(values.token_budget)
              ? DEFAULT_LOREBOOK_TOKEN_BUDGET
              : values.token_budget,
          extensions,
        });
      })}
    >
      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="entries">
            Entries ({form.values.entries.length})
          </Tabs.Tab>
          <Tabs.Tab value="advanced">Advanced</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            <TextInput
              label="Name"
              required
              key={form.key("name")}
              {...form.getInputProps("name")}
            />
            <Textarea
              label="Description"
              autosize
              minRows={3}
              key={form.key("description")}
              {...form.getInputProps("description")}
            />
            <Select
              label="Category"
              data={LOREBOOK_CATEGORIES.map((value) => ({
                value,
                label: LOREBOOK_CATEGORY_LABELS[value],
              }))}
              value={form.values.category}
              onChange={(value) =>
                form.setFieldValue(
                  "category",
                  (value ?? "uncategorized") as LorebookCategory,
                )
              }
            />
            <Switch
              label="Enabled"
              description="When off, this lorebook is skipped in the prompt pipeline."
              checked={form.values.enabled}
              onChange={(event) =>
                form.setFieldValue("enabled", event.currentTarget.checked)
              }
            />
            <Switch
              label="Global"
              description="When on, applies to all chats. Otherwise scoped later per chat/character."
              checked={form.values.global}
              onChange={(event) =>
                form.setFieldValue("global", event.currentTarget.checked)
              }
            />
            <MultiSelect
              label="Linked characters"
              description="Characters this lorebook is tied to."
              placeholder="Select characters"
              searchable
              clearable
              data={characterOptions}
              value={form.values.linked_characters}
              onChange={(linked_characters) =>
                form.setFieldValue("linked_characters", linked_characters)
              }
            />
            <MultiSelect
              label="Linked personas"
              description="Personas (`{{user}}`) this lorebook is tied to."
              placeholder="Select personas"
              searchable
              clearable
              data={personaOptions}
              value={form.values.linked_personas}
              onChange={(linked_personas) =>
                form.setFieldValue("linked_personas", linked_personas)
              }
            />
            <Group grow align="flex-start">
              <NumberInput
                label="Scan depth"
                description="How far back in chat history to scan for keys."
                min={0}
                allowDecimal={false}
                value={form.values.scan_depth ?? ""}
                onChange={(value) =>
                  form.setFieldValue(
                    "scan_depth",
                    typeof value === "number" ? value : null,
                  )
                }
              />
              <NumberInput
                label="Token budget"
                description="Max tokens for inserted entries."
                min={0}
                allowDecimal={false}
                value={form.values.token_budget ?? ""}
                onChange={(value) =>
                  form.setFieldValue(
                    "token_budget",
                    typeof value === "number" ? value : null,
                  )
                }
              />
            </Group>
            <Switch
              label="Recursive scanning"
              description="Entry content can trigger other entries."
              checked={form.values.recursive_scanning}
              onChange={(event) =>
                form.setFieldValue(
                  "recursive_scanning",
                  event.currentTarget.checked,
                )
              }
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="entries" pt="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Keyword-triggered lore snippets.
              </Text>
              <Button
                size="xs"
                variant="default"
                leftSection={<IconPlus size={14} />}
                onClick={addEntry}
              >
                Add entry
              </Button>
            </Group>

            {form.values.entries.length === 0 ? (
              <Text size="sm" c="dimmed">
                No entries yet.
              </Text>
            ) : (
              <Accordion variant="separated" multiple>
                {form.values.entries.map((entry, index) => (
                  <Accordion.Item key={index} value={`entry-${index}`}>
                    <Accordion.Control>
                      <Group justify="space-between" wrap="nowrap" pr="sm">
                        <Text size="sm" fw={500} lineClamp={1}>
                          {entry.name || entry.keys[0] || `Entry ${index + 1}`}
                          {!entry.enabled ? " (disabled)" : ""}
                        </Text>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          aria-label="Delete entry"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeEntry(index);
                          }}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="sm">
                        <Group grow>
                          <TextInput
                            label="Name / memo"
                            description="Optional name for this entry."
                            value={entry.name ?? ""}
                            onChange={(event) =>
                              updateEntry(index, {
                                name: event.currentTarget.value,
                              })
                            }
                          />
                          <NumberInput
                            label="Insertion order"
                            description="Lower = inserted higher"
                            allowDecimal={false}
                            value={entry.insertion_order}
                            onChange={(value) =>
                              updateEntry(index, {
                                insertion_order:
                                  typeof value === "number" ? value : 100,
                              })
                            }
                          />
                        </Group>
                        <TagsInput
                          label="Keys"
                          description="Primary trigger keywords."
                          placeholder="Add key"
                          value={entry.keys}
                          onChange={(keys) => updateEntry(index, { keys })}
                        />
                        <Textarea
                          label="Content"
                          description="The text to insert when the keys are found."
                          autosize
                          minRows={3}
                          value={entry.content}
                          onChange={(event) =>
                            updateEntry(index, {
                              content: event.currentTarget.value,
                            })
                          }
                        />
                        <Group grow>
                          <Select
                            label="Position"
                            description="Where to insert the entry in the prompt."
                            data={LOREBOOK_ENTRY_POSITIONS.map((value) => ({
                              value,
                              label: value,
                            }))}
                            value={entry.position ?? "before_char"}
                            onChange={(value) =>
                              updateEntry(index, {
                                position: (value ??
                                  "before_char") as LorebookEntryPosition,
                              })
                            }
                          />
                          <NumberInput
                            label="Priority"
                            description="Lower discarded first when over budget"
                            allowDecimal={false}
                            value={entry.priority ?? ""}
                            onChange={(value) =>
                              updateEntry(index, {
                                priority:
                                  typeof value === "number" ? value : undefined,
                              })
                            }
                          />
                        </Group>
                        <Switch
                          label="Enabled"
                          checked={entry.enabled}
                          onChange={(event) =>
                            updateEntry(index, {
                              enabled: event.currentTarget.checked,
                            })
                          }
                        />
                        <Switch
                          label="Constant"
                          description="Always insert within budget."
                          checked={Boolean(entry.constant)}
                          onChange={(event) =>
                            updateEntry(index, {
                              constant: event.currentTarget.checked,
                            })
                          }
                        />
                        <Switch
                          label="Case sensitive keys"
                          checked={Boolean(entry.case_sensitive)}
                          onChange={(event) =>
                            updateEntry(index, {
                              case_sensitive: event.currentTarget.checked,
                            })
                          }
                        />
                        <Switch
                          label="Selective"
                          description="Require a key from both primary and secondary keys."
                          checked={Boolean(entry.selective)}
                          onChange={(event) =>
                            updateEntry(index, {
                              selective: event.currentTarget.checked,
                            })
                          }
                        />
                        {entry.selective ? (
                          <TagsInput
                            label="Secondary keys"
                            placeholder="Add secondary key"
                            value={entry.secondary_keys ?? []}
                            onChange={(secondary_keys) =>
                              updateEntry(index, { secondary_keys })
                            }
                          />
                        ) : null}
                        <Textarea
                          label="Comment"
                          autosize
                          minRows={2}
                          value={entry.comment ?? ""}
                          onChange={(event) =>
                            updateEntry(index, {
                              comment: event.currentTarget.value,
                            })
                          }
                        />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="advanced" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Extensions
            </Text>
            <Textarea
              label="extensions (JSON)"
              autosize
              minRows={8}
              value={extensionsJson}
              error={extensionsError}
              styles={{
                input: {
                  fontFamily: "var(--mantine-font-family-monospace)",
                },
              }}
              onChange={(event) => setExtensionsJson(event.currentTarget.value)}
            />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </form>
  );
}
