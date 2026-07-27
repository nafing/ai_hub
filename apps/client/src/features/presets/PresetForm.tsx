import {
  forwardRef,
  useImperativeHandle,
  useState,
  type FormEvent,
  type ForwardedRef,
  type ReactNode,
} from "react";
import {
  IconArrowDown,
  IconArrowUp,
  IconLayersIntersect,
  IconMessage,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import {
  SECTION_KIND_LABELS,
  SECTION_MARKER_KINDS,
  SECTION_ROLES,
  PRESET_CATEGORIES,
  PRESET_CATEGORY_LABELS,
  VARIABLE_PRESENTATIONS,
  WRAP_FORMATS,
  createSectionFromKind,
  defaultVariable,
  defaultVariableOption,
  isSectionMarker,
  type CreatePresetInput,
  type PresetVariableValues,
  type SectionKind,
  type Variable,
} from "@ai-hub/shared";
import {
  ActionIcon,
  Button,
  Textarea,
  Accordion,
  Menu,
  Select,
  Tabs,
  TagsInput,
  TextInput,
  NumberInput,
  Switch,
  RuntimeText,
} from "@/components/ui";
import { PresetTestPanel } from "./PresetTestPanel";
import classes from "./PresetForm.module.css";

export type PresetFormValues = CreatePresetInput;

export type PresetFormHandle = {
  getValues: () => PresetFormValues;
  setVariables: (variables: Variable[]) => void;
};

type PresetFormProps = {
  formId?: string;
  presetId?: string;
  initialValues: PresetFormValues;
  /** Active variable values from Setup Variables (drives Test preview). */
  variableValues?: PresetVariableValues;
  onSubmit: (values: PresetFormValues) => Promise<void> | void;
};

type FieldErrors = Partial<Record<"name" | "wrap_format" | "category", string>>;

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
      {hint ? <span className={classes.fieldHint}>{hint}</span> : null}
      {children}
      {error ? <span className={classes.fieldError}>{error}</span> : null}
    </div>
  );
}

function reorder<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export const PresetForm = forwardRef(function PresetForm(
  {
    formId = "preset-form",
    presetId,
    initialValues,
    variableValues = {},
    onSubmit,
  }: PresetFormProps,
  ref: ForwardedRef<PresetFormHandle>,
) {
  const [values, setValues] = useState<PresetFormValues>(() => ({
    ...initialValues,
    groups: [...(initialValues.groups ?? [])],
    sections: initialValues.sections.map((section) => ({ ...section })),
    variables: initialValues.variables.map((variable) => ({
      ...variable,
      selected: [...(variable.selected ?? [])],
      options: variable.options.map((option) => ({ ...option })),
    })),
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [expandedVariables, setExpandedVariables] = useState<string[]>([]);

  useImperativeHandle(ref, () => ({
    getValues: () => values,
    setVariables: (variables) => {
      setValues((current) => ({
        ...current,
        variables: variables.map((variable) => ({
          ...variable,
          selected: [...(variable.selected ?? [])],
          options: variable.options.map((option) => ({ ...option })),
        })),
      }));
    },
  }));

  function updateValues(patch: Partial<PresetFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  function addSection(kind: SectionKind) {
    const section = createSectionFromKind(kind);
    setValues((current) => ({
      ...current,
      sections: [...current.sections, section],
    }));
    setExpandedSections((current) => [...current, section.id]);
  }

  function validate(next: PresetFormValues): FieldErrors {
    const nextErrors: FieldErrors = {};
    if (!next.name.trim()) nextErrors.name = "Name is required";
    if (!next.wrap_format) nextErrors.wrap_format = "Wrap format is required";
    if (!next.category) nextErrors.category = "Category is required";
    return nextErrors;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    void onSubmit(values);
  }

  return (
    <form id={formId} className={classes.form} onSubmit={handleSubmit}>
      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="sections">Sections</Tabs.Tab>
          {presetId ? <Tabs.Tab value="test">Test</Tabs.Tab> : null}
        </Tabs.List>

        <Tabs.Panel value="overview">
          <div className={classes.stack}>
            <div className={`${classes.grid} ${classes.grid2}`}>
              <Field
                label="Name"
                hint="The display name for this preset."
                error={errors.name}
              >
                <TextInput
                  error={Boolean(errors.name)}
                  value={values.name}
                  onChange={(event) => {
                    updateValues({ name: event.target.value });
                    if (errors.name) {
                      setErrors((current) => ({ ...current, name: undefined }));
                    }
                  }}
                />
              </Field>
              <Field label="Author" hint="Optional creator name.">
                <TextInput
                  value={values.author ?? ""}
                  onChange={(event) =>
                    updateValues({ author: event.target.value })
                  }
                />
              </Field>
            </div>

            <Field
              label="Description"
              hint="A short summary of what this preset is designed for."
            >
              <Textarea
                className={classes.textarea}
                value={values.description ?? ""}
                onChange={(event) =>
                  updateValues({ description: event.target.value })
                }
              />
            </Field>

            <div className={`${classes.grid} ${classes.grid2}`}>
              <Field
                label="Category"
                hint="Where this preset is intended to be used."
                error={errors.category}
              >
                <Select
                  data={PRESET_CATEGORIES.map((value) => ({
                    value,
                    label: PRESET_CATEGORY_LABELS[value],
                  }))}
                  value={values.category}
                  onChange={(category) => {
                    updateValues({
                      category: category as PresetFormValues["category"],
                    });
                    if (errors.category) {
                      setErrors((current) => ({
                        ...current,
                        category: undefined,
                      }));
                    }
                  }}
                  error={Boolean(errors.category)}
                />
              </Field>
              <Field
                label="Wrap format"
                hint="XML uses tags, Markdown uses headings, None sends raw content."
                error={errors.wrap_format}
              >
                <Select
                  data={WRAP_FORMATS.map((value) => ({
                    value,
                    label: value.charAt(0).toUpperCase() + value.slice(1),
                  }))}
                  value={values.wrap_format}
                  onChange={(wrap_format) => {
                    updateValues({
                      wrap_format:
                        wrap_format as PresetFormValues["wrap_format"],
                    });
                    if (errors.wrap_format) {
                      setErrors((current) => ({
                        ...current,
                        wrap_format: undefined,
                      }));
                    }
                  }}
                  error={Boolean(errors.wrap_format)}
                />
              </Field>
            </div>

            <Switch
              variant="card"
              checked={Boolean(values.is_default)}
              onChange={(checked) => updateValues({ is_default: checked })}
              label="Default for category"
              description="Use this preset as the active one for its category. Only one default per category."
            />
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="sections">
          <div className={classes.stack}>
            <Field
              label="Groups"
              hint="Named wrappers for sections. Members of the same group are nested under one group tag/heading in the prompt."
            >
              <TagsInput
                value={values.groups}
                onChange={(groups) => updateValues({ groups })}
                formatTag={(name) => {
                  const count = values.sections.filter(
                    (section) => section.group === name,
                  ).length;
                  return `${name} · ${count}`;
                }}
              />
            </Field>

            <div className={classes.toolbar}>
              <h3 className={classes.sectionTitle}>Sections</h3>
              <div className={classes.toolbarActions}>
                <Button variant="default" type="button"
                  disabled={values.sections.length === 0}
                  onClick={() =>
                    setExpandedSections(
                      values.sections.map((section) => section.id),
                    )
                  }
                >
                  Expand all
                </Button>
                <Button variant="default" type="button"
                  disabled={expandedSections.length === 0}
                  onClick={() => setExpandedSections([])}
                >
                  Collapse all
                </Button>
                <Menu>
                  <Menu.Target>
                    <Button variant="default" type="button">
                      <IconPlus size={16} />
                      Add section
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconMessage size={16} />}
                      onClick={() => addSection("prompt_block")}
                    >
                      Prompt Block
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Label>Markers</Menu.Label>
                    {SECTION_MARKER_KINDS.map((kind) => (
                      <Menu.Item
                        key={kind}
                        leftSection={<IconLayersIntersect size={16} />}
                        onClick={() => addSection(kind)}
                      >
                        {SECTION_KIND_LABELS[kind]}
                      </Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>
              </div>
            </div>

            {values.sections.length === 0 ? (
              <p className={classes.muted}>
                No sections yet. Add a Prompt Block or Marker to build the
                prompt.
              </p>
            ) : null}

            <Accordion
              multiple
              value={expandedSections}
              onChange={(next) =>
                setExpandedSections(Array.isArray(next) ? next : [])
              }
            >
              {values.sections.map((section, index) => (
                <Accordion.Item key={section.id} value={section.id}>
                  <div className={classes.itemRow}>
                    <div className={classes.reorder}>
                      <ActionIcon type="button" variant="default" aria-label="Move section up" disabled={index === 0} onClick={() =>
                          setValues((current) => ({
                            ...current,
                            sections: reorder(
                              current.sections,
                              index,
                              index - 1,
                            ),
                          }))
                        }
                      >
                        <IconArrowUp size={14} />
                      </ActionIcon>
                      <ActionIcon type="button" variant="default" aria-label="Move section down" disabled={index === values.sections.length - 1} onClick={() =>
                          setValues((current) => ({
                            ...current,
                            sections: reorder(
                              current.sections,
                              index,
                              index + 1,
                            ),
                          }))
                        }
                      >
                        <IconArrowDown size={14} />
                      </ActionIcon>
                    </div>
                    <div className={classes.itemMain}>
                      <Accordion.Control>
                        <div className={classes.itemHeader}>
                          <div className={classes.itemTitleRow}>
                            <span className={classes.itemIndex}>
                              {index + 1}
                            </span>
                            {isSectionMarker(
                              section.kind ?? "prompt_block",
                            ) ? (
                              <IconLayersIntersect size={16} />
                            ) : (
                              <IconMessage size={16} />
                            )}
                            <p className={classes.itemTitle}>
                              {section.name ||
                                SECTION_KIND_LABELS[
                                  section.kind ?? "prompt_block"
                                ]}
                            </p>
                          </div>
                          <div className={classes.badges}>
                            <span className={classes.badge}>
                              {
                                SECTION_KIND_LABELS[
                                  section.kind ?? "prompt_block"
                                ]
                              }
                            </span>
                            <span
                              className={`${classes.badge} ${classes.badgeOutline}`}
                            >
                              {section.role}
                            </span>
                            {section.group ? (
                              <span
                                className={`${classes.badge} ${classes.badgeOutline}`}
                              >
                                {section.group}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Accordion.Control>
                    </div>
                    <ActionIcon type="button" variant="ghostDanger" className={classes.removePad} aria-label="Remove section" onClick={() => {
                        setValues((current) => ({
                          ...current,
                          sections: current.sections.filter(
                            (_, i) => i !== index,
                          ),
                        }));
                        setExpandedSections((current) =>
                          current.filter((id) => id !== section.id),
                        );
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </div>
                  <Accordion.Panel>
                    <div className={classes.stackSm}>
                      <div className={`${classes.grid} ${classes.grid2}`}>
                        <Field label="Name">
                          <TextInput
                            value={section.name}
                            onChange={(event) =>
                              setValues((current) => ({
                                ...current,
                                sections: current.sections.map((item, i) =>
                                  i === index
                                    ? { ...item, name: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </Field>
                        <Field label="Role">
                          <Select
                            data={SECTION_ROLES.map((role) => ({
                              value: role,
                              label: role,
                            }))}
                            value={section.role}
                            onChange={(role) =>
                              setValues((current) => ({
                                ...current,
                                sections: current.sections.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        role: role as typeof item.role,
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </Field>
                        <Field label="Group">
                          <Select
                            data={[
                              { value: "", label: "No group" },
                              ...values.groups.map((group) => ({
                                value: group,
                                label: group,
                              })),
                            ]}
                            value={section.group ?? ""}
                            clearable
                            onChange={(group) =>
                              setValues((current) => ({
                                ...current,
                                sections: current.sections.map((item, i) =>
                                  i === index
                                    ? { ...item, group: group || "" }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </Field>
                        <PositionField
                          position={section.position}
                          onModeChange={(mode) =>
                            setValues((current) => ({
                              ...current,
                              sections: current.sections.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      position:
                                        mode === "index" ? 0 : "ordered",
                                    }
                                  : item,
                              ),
                            }))
                          }
                          onIndexChange={(position) =>
                            setValues((current) => ({
                              ...current,
                              sections: current.sections.map((item, i) =>
                                i === index ? { ...item, position } : item,
                              ),
                            }))
                          }
                        />
                      </div>
                      <Field
                        label="Content"
                        hint={
                          isSectionMarker(section.kind ?? "prompt_block")
                            ? "Marker content is injected at runtime."
                            : "The text content of this section."
                        }
                      >
                        <Textarea
                          className={classes.textarea}
                          disabled={isSectionMarker(
                            section.kind ?? "prompt_block",
                          )}
                          value={section.content}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              sections: current.sections.map((item, i) =>
                                i === index
                                  ? { ...item, content: event.target.value }
                                  : item,
                              ),
                            }))
                          }
                        />
                      </Field>
                    </div>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>

            <div className={classes.toolbar}>
              <h3 className={classes.sectionTitle}>Variables</h3>
              <div className={classes.toolbarActions}>
                <Button variant="default" type="button"
                  disabled={values.variables.length === 0}
                  onClick={() =>
                    setExpandedVariables(
                      values.variables.map((variable) => variable.id),
                    )
                  }
                >
                  Expand all
                </Button>
                <Button variant="default" type="button"
                  disabled={expandedVariables.length === 0}
                  onClick={() => setExpandedVariables([])}
                >
                  Collapse all
                </Button>
                <Button variant="default" type="button"
                  onClick={() => {
                    const variable = defaultVariable();
                    setValues((current) => ({
                      ...current,
                      variables: [...current.variables, variable],
                    }));
                    setExpandedVariables((current) => [
                      ...current,
                      variable.id,
                    ]);
                  }}
                >
                  <IconPlus size={16} />
                  Add variable
                </Button>
              </div>
            </div>

            {values.variables.length === 0 ? (
              <p className={classes.muted}>No variables yet.</p>
            ) : null}

            <Accordion
              multiple
              value={expandedVariables}
              onChange={(next) =>
                setExpandedVariables(Array.isArray(next) ? next : [])
              }
            >
              {values.variables.map((variable, index) => (
                <Accordion.Item key={variable.id} value={variable.id}>
                  <div className={classes.itemRow}>
                    <div className={classes.reorder}>
                      <ActionIcon type="button" variant="default" aria-label="Move variable up" disabled={index === 0} onClick={() =>
                          setValues((current) => ({
                            ...current,
                            variables: reorder(
                              current.variables,
                              index,
                              index - 1,
                            ),
                          }))
                        }
                      >
                        <IconArrowUp size={14} />
                      </ActionIcon>
                      <ActionIcon type="button" variant="default" aria-label="Move variable down" disabled={index === values.variables.length - 1} onClick={() =>
                          setValues((current) => ({
                            ...current,
                            variables: reorder(
                              current.variables,
                              index,
                              index + 1,
                            ),
                          }))
                        }
                      >
                        <IconArrowDown size={14} />
                      </ActionIcon>
                    </div>
                    <div className={classes.itemMain}>
                      <Accordion.Control>
                        <div className={classes.itemHeader}>
                          <div className={classes.itemTitleRow}>
                            <span className={classes.itemIndex}>
                              {index + 1}
                            </span>
                            <p className={classes.itemTitle}>
                              # {variable.variable_name || "variable"}
                            </p>
                          </div>
                          <div className={classes.badges}>
                            <span className={classes.badge}>
                              {variable.options.length} options
                            </span>
                            {variable.variable_name ? (
                              <RuntimeText>{`{{${variable.variable_name}}}`}</RuntimeText>
                            ) : null}
                            {variable.multi_select ? (
                              <span
                                className={`${classes.badge} ${classes.badgeOutline}`}
                              >
                                multi
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Accordion.Control>
                    </div>
                    <ActionIcon type="button" variant="ghostDanger" className={classes.removePad} aria-label="Remove variable" onClick={() => {
                        setValues((current) => ({
                          ...current,
                          variables: current.variables.filter(
                            (_, i) => i !== index,
                          ),
                        }));
                        setExpandedVariables((current) =>
                          current.filter((id) => id !== variable.id),
                        );
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </div>
                  <Accordion.Panel>
                    <div className={classes.stackSm}>
                      <Field
                        label="Variable name"
                        hint={
                          <RuntimeText text="Use {{name}} in any prompt section to insert the selected value. Must be alphanumeric/underscores only." />
                        }
                      >
                        <TextInput
                          value={variable.variable_name}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              variables: current.variables.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      variable_name: event.target.value,
                                    }
                                  : item,
                              ),
                            }))
                          }
                        />
                      </Field>
                      <Field label="Question (shown to user)">
                        <TextInput
                          value={variable.question}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              variables: current.variables.map((item, i) =>
                                i === index
                                  ? { ...item, question: event.target.value }
                                  : item,
                              ),
                            }))
                          }
                        />
                      </Field>
                      <Switch
                        variant="card"
                        checked={Boolean(variable.multi_select)}
                        onChange={(checked) =>
                          setValues((current) => ({
                            ...current,
                            variables: current.variables.map((item, i) =>
                              i === index
                                ? { ...item, multi_select: checked }
                                : item,
                            ),
                          }))
                        }
                        label="Multi-Select"
                        description="Allow users to select multiple options instead of just one."
                      />

                      <Field label="Presentation">
                        <div className={classes.segmented} role="group">
                          {VARIABLE_PRESENTATIONS.map((presentation) => (
                            <Button
                              key={presentation}
                              type="button"
                              variant={
                                variable.presentation === presentation
                                  ? "light"
                                  : "ghost"
                              }
                              size="sm"
                              className={[
                                classes.segment,
                                variable.presentation === presentation
                                  ? classes.segmentActive
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              onClick={() =>
                                setValues((current) => ({
                                  ...current,
                                  variables: current.variables.map(
                                    (item, i) =>
                                      i === index
                                        ? { ...item, presentation }
                                        : item,
                                  ),
                                }))
                              }
                            >
                              {presentation.charAt(0).toUpperCase() +
                                presentation.slice(1)}
                            </Button>
                          ))}
                        </div>
                      </Field>

                      <Switch
                        variant="card"
                        checked={Boolean(variable.alphabetical)}
                        onChange={(checked) =>
                          setValues((current) => ({
                            ...current,
                            variables: current.variables.map((item, i) =>
                              i === index
                                ? { ...item, alphabetical: checked }
                                : item,
                            ),
                          }))
                        }
                        label="Alphabetical option display"
                        description="Manual order is kept for editing and exports."
                      />

                      <div className={classes.toolbar}>
                        <span className={classes.fieldLabel}>Options</span>
                        <Button variant="default" type="button"
                          onClick={() =>
                            setValues((current) => ({
                              ...current,
                              variables: current.variables.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      options: [
                                        ...item.options,
                                        defaultVariableOption(),
                                      ],
                                    }
                                  : item,
                              ),
                            }))
                          }
                        >
                          <IconPlus size={14} />
                          Add Option
                        </Button>
                      </div>

                      <div className={classes.stackSm}>
                        {variable.options.map((option, optionIndex) => (
                          <div key={option.id} className={classes.optionRow}>
                            <div className={classes.reorder}>
                              <ActionIcon type="button" variant="default" aria-label="Move option up" disabled={optionIndex === 0} onClick={() =>
                                  setValues((current) => ({
                                    ...current,
                                    variables: current.variables.map(
                                      (item, i) =>
                                        i === index
                                          ? {
                                              ...item,
                                              options: reorder(
                                                item.options,
                                                optionIndex,
                                                optionIndex - 1,
                                              ),
                                            }
                                          : item,
                                    ),
                                  }))
                                }
                              >
                                <IconArrowUp size={14} />
                              </ActionIcon>
                              <ActionIcon type="button" variant="default" aria-label="Move option down" disabled={ optionIndex === variable.options.length - 1 } onClick={() =>
                                  setValues((current) => ({
                                    ...current,
                                    variables: current.variables.map(
                                      (item, i) =>
                                        i === index
                                          ? {
                                              ...item,
                                              options: reorder(
                                                item.options,
                                                optionIndex,
                                                optionIndex + 1,
                                              ),
                                            }
                                          : item,
                                    ),
                                  }))
                                }
                              >
                                <IconArrowDown size={14} />
                              </ActionIcon>
                            </div>
                            <span
                              className={classes.itemIndex}
                              style={{ paddingTop: "0.45rem" }}
                            >
                              {optionIndex + 1}
                            </span>
                            <TextInput
                              className={classes.optionLabelInput}
                              placeholder="Label"
                              value={option.label}
                              onChange={(event) =>
                                setValues((current) => ({
                                  ...current,
                                  variables: current.variables.map(
                                    (item, i) =>
                                      i === index
                                        ? {
                                            ...item,
                                            options: item.options.map(
                                              (opt, oi) =>
                                                oi === optionIndex
                                                  ? {
                                                      ...opt,
                                                      label:
                                                        event.target.value,
                                                    }
                                                  : opt,
                                            ),
                                          }
                                        : item,
                                  ),
                                }))
                              }
                            />
                            <TextInput
                              className={classes.optionValueInput}
                              placeholder="Value injected into prompt"
                              value={option.value}
                              onChange={(event) =>
                                setValues((current) => ({
                                  ...current,
                                  variables: current.variables.map(
                                    (item, i) =>
                                      i === index
                                        ? {
                                            ...item,
                                            options: item.options.map(
                                              (opt, oi) =>
                                                oi === optionIndex
                                                  ? {
                                                      ...opt,
                                                      value:
                                                        event.target.value,
                                                    }
                                                  : opt,
                                            ),
                                          }
                                        : item,
                                  ),
                                }))
                              }
                            />
                            <ActionIcon type="button" variant="ghostDanger" aria-label="Remove option" onClick={() =>
                                setValues((current) => ({
                                  ...current,
                                  variables: current.variables.map(
                                    (item, i) =>
                                      i === index
                                        ? {
                                            ...item,
                                            options: item.options.filter(
                                              (_, oi) => oi !== optionIndex,
                                            ),
                                          }
                                        : item,
                                  ),
                                }))
                              }
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </div>
        </Tabs.Panel>

        {presetId ? (
          <Tabs.Panel value="test">
            <PresetTestPanel
              presetId={presetId}
              values={values}
              variableValues={variableValues}
            />
          </Tabs.Panel>
        ) : null}
      </Tabs>
    </form>
  );
});

function PositionField({
  position,
  onModeChange,
  onIndexChange,
}: {
  position: "ordered" | number;
  onModeChange: (mode: "ordered" | "index") => void;
  onIndexChange: (value: number) => void;
}) {
  const mode = position === "ordered" ? "ordered" : "index";

  return (
    <div className={classes.positionRow}>
      <Field label="Position">
        <Select
          data={[
            { value: "ordered", label: "Ordered" },
            { value: "index", label: "Numeric index" },
          ]}
          value={mode}
          onChange={(value) =>
            onModeChange(value === "index" ? "index" : "ordered")
          }
        />
      </Field>
      {mode === "index" ? (
        <Field label="Index">
          <NumberInput
            min={0}
            value={typeof position === "number" ? position : 0}
            onChange={(value) =>
              onIndexChange(value === "" ? 0 : Math.max(0, value))
            }
          />
        </Field>
      ) : null}
    </div>
  );
}
