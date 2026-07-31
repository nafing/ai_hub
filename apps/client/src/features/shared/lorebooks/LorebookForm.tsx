import { useMemo, useState, type FormEvent, type ReactNode } from "react";
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
import {
  ActionIcon,
  Button,
  Textarea,
  Accordion,
  MultiSelect,
  Select,
  Tabs,
  TagsInput,
  TextInput,
  NumberInput,
  Switch,
  RuntimeText,
} from "@/components/ui";
import { useCharacters } from "@/features/api-queries/characters/queries";
import { usePersonas } from "@/features/api-queries/personas/queries";
import classes from "./LorebookForm.module.css";

export type LorebookFormValues = CreateLorebookInput;

type LorebookFormProps = {
  formId?: string;
  initialValues: LorebookFormValues;
  onSubmit: (values: LorebookFormValues) => Promise<void> | void;
};

type FieldErrors = Partial<Record<"name", string>>;

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={classes.field}>
      <span className={classes.fieldLabel}>{label}</span>
      {hint ? <p className={classes.fieldHint}>{hint}</p> : null}
      {children}
      {error ? <p className={classes.fieldError}>{error}</p> : null}
    </div>
  );
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

  const [values, setValues] = useState<LorebookFormValues>(() => ({
    ...initialValues,
    linked_characters: [...(initialValues.linked_characters ?? [])],
    linked_personas: [...(initialValues.linked_personas ?? [])],
    entries: initialValues.entries.map((entry) => ({
      ...entry,
      keys: [...entry.keys],
      secondary_keys: [...(entry.secondary_keys ?? [])],
    })),
    extensions: { ...(initialValues.extensions ?? {}) },
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [extensionsJson, setExtensionsJson] = useState(
    formatJson(initialValues.extensions),
  );
  const [extensionsError, setExtensionsError] = useState<string | null>(null);

  function setField<K extends keyof LorebookFormValues>(
    key: K,
    value: LorebookFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === "name") {
      setErrors((current) => {
        if (!current.name) return current;
        const next = { ...current };
        delete next.name;
        return next;
      });
    }
  }

  function updateEntry(index: number, patch: Partial<LorebookEntry>) {
    setValues((current) => {
      const entries = [...current.entries];
      const entry = entries[index];
      if (!entry) return current;
      entries[index] = { ...entry, ...patch };
      return { ...current, entries };
    });
  }

  function addEntry() {
    setValues((current) => ({
      ...current,
      entries: [
        ...current.entries,
        defaultLorebookEntry({
          insertion_order: (current.entries.length + 1) * 100,
          name: `Entry ${current.entries.length + 1}`,
        }),
      ],
    }));
  }

  function removeEntry(index: number) {
    setValues((current) => ({
      ...current,
      entries: current.entries.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FieldErrors = {};
    if (!values.name.trim()) {
      nextErrors.name = "Name is required";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

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

    await onSubmit({
      ...values,
      name: values.name.trim(),
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
  }

  return (
    <form id={formId} className={classes.form} onSubmit={handleSubmit}>
      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="entries">
            Entries ({values.entries.length})
          </Tabs.Tab>
          <Tabs.Tab value="advanced">Advanced</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview">
          <div className={classes.stack}>
            <Field label="Name" error={errors.name}>
              <TextInput
                error={Boolean(errors.name)}
                value={values.name}
                onChange={(event) => setField("name", event.target.value)}
                required
              />
            </Field>
            <Field label="Description">
              <Textarea
                className={classes.textarea}
                value={values.description}
                onChange={(event) =>
                  setField("description", event.target.value)
                }
              />
            </Field>
            <Field label="Category">
              <Select
                data={LOREBOOK_CATEGORIES.map((value) => ({
                  value,
                  label: LOREBOOK_CATEGORY_LABELS[value],
                }))}
                value={values.category}
                onChange={(value) =>
                  setField(
                    "category",
                    (value ?? "uncategorized") as LorebookCategory,
                  )
                }
              />
            </Field>
            <Switch
              variant="card"
              checked={values.enabled}
              onChange={(checked) => setField("enabled", checked)}
              label="Enabled"
              description="When off, this lorebook is skipped in the prompt pipeline."
            />
            <Switch
              variant="card"
              checked={values.global}
              onChange={(checked) => setField("global", checked)}
              label="Global"
              description="When on, applies to all chats. Otherwise scoped later per chat/character."
            />
            <Field
              label="Linked characters"
              hint="Characters this lorebook is tied to."
            >
              <MultiSelect
                searchable
                clearable
                data={characterOptions}
                value={values.linked_characters}
                onChange={(linked_characters) =>
                  setField("linked_characters", linked_characters)
                }
                placeholder="Select characters"
              />
            </Field>
            <Field
              label="Linked personas"
              hint={
                <>
                  Personas (<RuntimeText>{"{{user}}"}</RuntimeText>) this
                  lorebook is tied to.
                </>
              }
            >
              <MultiSelect
                searchable
                clearable
                data={personaOptions}
                value={values.linked_personas}
                onChange={(linked_personas) =>
                  setField("linked_personas", linked_personas)
                }
                placeholder="Select personas"
              />
            </Field>
            <div className={`${classes.grid} ${classes.grid2}`}>
              <Field
                label="Scan depth"
                hint="How far back in chat history to scan for keys."
              >
                <NumberInput
                  min={0}
                  step={1}
                  value={values.scan_depth ?? ""}
                  onChange={(value) =>
                    setField("scan_depth", value === "" ? null : value)
                  }
                />
              </Field>
              <Field
                label="Token budget"
                hint="Max tokens for inserted entries."
              >
                <NumberInput
                  min={0}
                  step={1}
                  value={values.token_budget ?? ""}
                  onChange={(value) =>
                    setField("token_budget", value === "" ? null : value)
                  }
                />
              </Field>
            </div>
            <Switch
              variant="card"
              checked={values.recursive_scanning}
              onChange={(checked) => setField("recursive_scanning", checked)}
              label="Recursive scanning"
              description="Entry content can trigger other entries."
            />
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="entries">
          <div className={classes.stack}>
            <div className={classes.toolbar}>
              <p className={classes.muted}>Keyword-triggered lore snippets.</p>
              <Button variant="default" type="button"
                onClick={addEntry}>
                <IconPlus size={14} />
                Add entry
              </Button>
            </div>

            {values.entries.length === 0 ? (
              <p className={classes.muted}>No entries yet.</p>
            ) : (
              <Accordion multiple defaultValue={[]}>
                {values.entries.map((entry, index) => (
                  <Accordion.Item key={index} value={`entry-${index}`}>
                    <div className={classes.itemRow}>
                      <div className={classes.itemMain}>
                        <Accordion.Control>
                          <div className={classes.itemHeader}>
                            <p className={classes.itemTitle}>
                              {entry.name ||
                                entry.keys[0] ||
                                `Entry ${index + 1}`}
                              {!entry.enabled ? " (disabled)" : ""}
                            </p>
                          </div>
                        </Accordion.Control>
                      </div>
                      <ActionIcon type="button" variant="ghostDanger" className={classes.removePad} aria-label="Delete entry" onClick={() => removeEntry(index)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </div>
                    <Accordion.Panel>
                      <div className={classes.stackSm}>
                        <div className={`${classes.grid} ${classes.grid2}`}>
                          <Field
                            label="Name / memo"
                            hint="Optional name for this entry."
                          >
                            <TextInput
                              value={entry.name ?? ""}
                              onChange={(event) =>
                                updateEntry(index, {
                                  name: event.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field
                            label="Insertion order"
                            hint="Lower = inserted higher"
                          >
                            <NumberInput
                              step={1}
                              value={entry.insertion_order}
                              onChange={(value) =>
                                updateEntry(index, {
                                  insertion_order: value === "" ? 100 : value,
                                })
                              }
                            />
                          </Field>
                        </div>
                        <Field
                          label="Keys"
                          hint="Primary trigger keywords."
                        >
                          <TagsInput
                            placeholder="Add key"
                            value={entry.keys}
                            onChange={(keys) => updateEntry(index, { keys })}
                          />
                        </Field>
                        <Field
                          label="Content"
                          hint="The text to insert when the keys are found."
                        >
                          <Textarea
                            className={classes.textarea}
                            value={entry.content}
                            onChange={(event) =>
                              updateEntry(index, {
                                content: event.target.value,
                              })
                            }
                          />
                        </Field>
                        <div className={`${classes.grid} ${classes.grid2}`}>
                          <Field
                            label="Position"
                            hint="Where to insert the entry in the prompt."
                          >
                            <Select
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
                          </Field>
                          <Field
                            label="Priority"
                            hint="Lower discarded first when over budget"
                          >
                            <NumberInput
                              step={1}
                              value={entry.priority ?? ""}
                              onChange={(value) =>
                                updateEntry(index, {
                                  priority: value === "" ? undefined : value,
                                })
                              }
                            />
                          </Field>
                        </div>
                        <Switch
                          variant="card"
                          checked={entry.enabled}
                          onChange={(checked) =>
                            updateEntry(index, { enabled: checked })
                          }
                          label="Enabled"
                        />
                        <Switch
                          variant="card"
                          checked={Boolean(entry.constant)}
                          onChange={(checked) =>
                            updateEntry(index, { constant: checked })
                          }
                          label="Constant"
                          description="Always insert within budget."
                        />
                        <Switch
                          variant="card"
                          checked={Boolean(entry.case_sensitive)}
                          onChange={(checked) =>
                            updateEntry(index, { case_sensitive: checked })
                          }
                          label="Case sensitive keys"
                        />
                        <Switch
                          variant="card"
                          checked={Boolean(entry.selective)}
                          onChange={(checked) =>
                            updateEntry(index, { selective: checked })
                          }
                          label="Selective"
                          description="Require a key from both primary and secondary keys."
                        />
                        {entry.selective ? (
                          <Field label="Secondary keys">
                            <TagsInput
                              placeholder="Add secondary key"
                              value={entry.secondary_keys ?? []}
                              onChange={(secondary_keys) =>
                                updateEntry(index, { secondary_keys })
                              }
                            />
                          </Field>
                        ) : null}
                        <Field label="Comment">
                          <Textarea
                            className={classes.textarea}
                            value={entry.comment ?? ""}
                            onChange={(event) =>
                              updateEntry(index, {
                                comment: event.target.value,
                              })
                            }
                          />
                        </Field>
                      </div>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="advanced">
          <div className={classes.stack}>
            <p className={classes.sectionTitle}>Extensions</p>
            <Field label="extensions (JSON)" error={extensionsError ?? undefined}>
              <Textarea
                className={[
                  classes.textarea,
                  classes.mono,
                  classes.jsonEditor,
                  extensionsError ? classes.inputError : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                value={extensionsJson}
                spellCheck={false}
                onChange={(event) => {
                  setExtensionsJson(event.target.value);
                  setExtensionsError(null);
                }}
              />
            </Field>
          </div>
        </Tabs.Panel>
      </Tabs>
    </form>
  );
}
