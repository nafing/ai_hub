import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Group,
  Menu,
  NumberInput,
  Pill,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  TagsInput,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import {
  forwardRef,
  useImperativeHandle,
  useState,
  type ForwardedRef,
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
import { PresetTestPanel } from "./PresetTestPanel";

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
  const form = useForm<PresetFormValues>({
    mode: "controlled",
    initialValues,
    validate: {
      name: isNotEmpty("Name is required"),
      wrap_format: isNotEmpty("Wrap format is required"),
      category: isNotEmpty("Category is required"),
    },
  });

  useImperativeHandle(ref, () => ({
    getValues: () => form.getValues(),
    setVariables: (variables) => {
      form.setFieldValue(
        "variables",
        variables.map((variable) => ({
          ...variable,
          selected: [...(variable.selected ?? [])],
          options: variable.options.map((option) => ({ ...option })),
        })),
      );
    },
  }));

  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [expandedVariables, setExpandedVariables] = useState<string[]>([]);

  function addSection(kind: SectionKind) {
    const section = createSectionFromKind(kind);
    form.insertListItem("sections", section);
    setExpandedSections((current) => [...current, section.id]);
  }

  return (
    <form
      id={formId}
      onSubmit={form.onSubmit((values) => void onSubmit(values))}
    >
      <Tabs defaultValue="overview" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="sections">Sections</Tabs.Tab>
          {presetId ? <Tabs.Tab value="test">Test</Tabs.Tab> : null}
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput
                label="Name"
                description="The display name for this preset."
                {...form.getInputProps("name")}
              />
              <TextInput
                label="Author"
                description="Optional creator name."
                {...form.getInputProps("author")}
              />
            </SimpleGrid>
            <Textarea
              label="Description"
              description="A short summary of what this preset is designed for."
              autosize
              minRows={2}
              {...form.getInputProps("description")}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select
                label="Category"
                description="Where this preset is intended to be used."
                data={PRESET_CATEGORIES.map((value) => ({
                  value,
                  label: PRESET_CATEGORY_LABELS[value],
                }))}
                allowDeselect={false}
                {...form.getInputProps("category")}
              />
              <Select
                label="Wrap format"
                description="XML uses tags, Markdown uses headings, None sends raw content."
                data={WRAP_FORMATS.map((value) => ({
                  value,
                  label: value.charAt(0).toUpperCase() + value.slice(1),
                }))}
                allowDeselect={false}
                {...form.getInputProps("wrap_format")}
              />
            </SimpleGrid>
            <Switch
              label="Default for category"
              description="Use this preset as the active one for its category. Only one default per category."
              {...form.getInputProps("is_default", { type: "checkbox" })}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="sections" pt="md">
          <Stack gap="md">
              <TagsInput
              label="Groups"
              description="Named wrappers for sections. Members of the same group are nested under one group tag/heading in the prompt."
              value={form.values.groups}
              onChange={(groups) => form.setFieldValue("groups", groups)}
              renderPill={({ option, onRemove, disabled, reorderProps }) => {
                const name = String(option.value);
                const count = form.values.sections.filter(
                  (section) => section.group === name,
                ).length;
                return (
                  <Pill
                    withRemoveButton={!disabled}
                    onRemove={onRemove}
                    disabled={disabled}
                    {...reorderProps}
                  >
                    {name} · {count}
                  </Pill>
                );
              }}
            />
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Text fw={600}>Sections</Text>
              <Group gap="xs" wrap="wrap">
                <Button
                  variant="default"
                  size="compact-xs"
                  disabled={form.values.sections.length === 0}
                  onClick={() =>
                    setExpandedSections(
                      form.values.sections.map((section) => section.id),
                    )
                  }
                >
                  Expand all
                </Button>
                <Button
                  variant="default"
                  size="compact-xs"
                  disabled={expandedSections.length === 0}
                  onClick={() => setExpandedSections([])}
                >
                  Collapse all
                </Button>
                <Menu shadow="md" width={280} position="bottom-end">
                  <Menu.Target>
                    <Button
                      variant="default"
                      size="compact-xs"
                      leftSection={<IconPlus size={16} />}
                    >
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
                    <Divider my={4} />
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
              </Group>
            </Group>
            {form.values.sections.length === 0 ? (
              <Text c="dimmed" size="sm">
                No sections yet. Add a Prompt Block or Marker to build the
                prompt.
              </Text>
            ) : null}
            <Accordion
              multiple
              value={expandedSections}
              onChange={setExpandedSections}
              variant="separated"
            >
              {form.values.sections.map((section, index) => (
                <Accordion.Item key={section.id} value={section.id}>
                  <Group wrap="nowrap" gap="xs" align="flex-start" pr="xs">
                    <Stack gap={2} pt={6} pl={4}>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        aria-label="Move section up"
                        disabled={index === 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          form.reorderListItem("sections", {
                            from: index,
                            to: index - 1,
                          });
                        }}
                      >
                        <IconArrowUp size={14} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        aria-label="Move section down"
                        disabled={index === form.values.sections.length - 1}
                        onClick={(event) => {
                          event.stopPropagation();
                          form.reorderListItem("sections", {
                            from: index,
                            to: index + 1,
                          });
                        }}
                      >
                        <IconArrowDown size={14} />
                      </ActionIcon>
                    </Stack>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Accordion.Control>
                        <Stack gap={6}>
                          <Group gap="xs" wrap="nowrap">
                            <Text size="sm" c="dimmed" w={18} ta="right">
                              {index + 1}
                            </Text>
                            {isSectionMarker(section.kind ?? "prompt_block") ? (
                              <IconLayersIntersect size={16} />
                            ) : (
                              <IconMessage size={16} />
                            )}
                            <Text fw={600} lineClamp={2} style={{ flex: 1, minWidth: 0 }}>
                              {section.name ||
                                SECTION_KIND_LABELS[
                                  section.kind ?? "prompt_block"
                                ]}
                            </Text>
                          </Group>
                          <Group gap={6} wrap="wrap">
                            <Badge size="sm" variant="light">
                              {
                                SECTION_KIND_LABELS[
                                  section.kind ?? "prompt_block"
                                ]
                              }
                            </Badge>
                            <Badge size="sm" variant="outline">
                              {section.role}
                            </Badge>
                            {section.group ? (
                              <Badge size="sm" variant="outline">
                                {section.group}
                              </Badge>
                            ) : null}
                          </Group>
                        </Stack>
                      </Accordion.Control>
                    </Box>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      mt={6}
                      aria-label="Remove section"
                      onClick={(event) => {
                        event.stopPropagation();
                        form.removeListItem("sections", index);
                        setExpandedSections((current) =>
                          current.filter((id) => id !== section.id),
                        );
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                        <TextInput
                          label="Name"
                          {...form.getInputProps(`sections.${index}.name`)}
                        />
                        <Select
                          label="Role"
                          data={SECTION_ROLES.map((role) => ({
                            value: role,
                            label: role,
                          }))}
                          allowDeselect={false}
                          {...form.getInputProps(`sections.${index}.role`)}
                        />
                        <Select
                          label="Group"
                          data={[
                            { value: "", label: "No group" },
                            ...form.values.groups.map((group) => ({
                              value: group,
                              label: group,
                            })),
                          ]}
                          clearable
                          {...form.getInputProps(`sections.${index}.group`)}
                        />
                        <PositionField
                          position={section.position}
                          onModeChange={(mode) =>
                            form.setFieldValue(
                              `sections.${index}.position`,
                              mode === "index" ? 0 : "ordered",
                            )
                          }
                          onIndexChange={(value) =>
                            form.setFieldValue(
                              `sections.${index}.position`,
                              value,
                            )
                          }
                        />
                      </SimpleGrid>
                      <Textarea
                        label="Content"
                        description={
                          isSectionMarker(section.kind ?? "prompt_block")
                            ? "Marker content is injected at runtime."
                            : "The text content of this section."
                        }
                        autosize
                        minRows={3}
                        disabled={isSectionMarker(
                          section.kind ?? "prompt_block",
                        )}
                        {...form.getInputProps(`sections.${index}.content`)}
                      />
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>

            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Text fw={600}>Variables</Text>
              <Group gap="xs" wrap="wrap">
                <Button
                  variant="default"
                  size="compact-xs"
                  disabled={form.values.variables.length === 0}
                  onClick={() =>
                    setExpandedVariables(
                      form.values.variables.map((variable) => variable.id),
                    )
                  }
                >
                  Expand all
                </Button>
                <Button
                  variant="default"
                  size="compact-xs"
                  disabled={expandedVariables.length === 0}
                  onClick={() => setExpandedVariables([])}
                >
                  Collapse all
                </Button>
                <Button
                  variant="default"
                  size="compact-xs"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => {
                    const variable = defaultVariable();
                    form.insertListItem("variables", variable);
                    setExpandedVariables((current) => [
                      ...current,
                      variable.id,
                    ]);
                  }}
                >
                  Add variable
                </Button>
              </Group>
            </Group>
            {form.values.variables.length === 0 ? (
              <Text c="dimmed" size="sm">
                No variables yet.
              </Text>
            ) : null}
            <Accordion
              multiple
              value={expandedVariables}
              onChange={setExpandedVariables}
              variant="separated"
            >
              {form.values.variables.map((variable, index) => (
                <Accordion.Item key={variable.id} value={variable.id}>
                  <Group wrap="nowrap" gap="xs" align="flex-start" pr="xs">
                    <Stack gap={2} pt={6} pl={4}>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        aria-label="Move variable up"
                        disabled={index === 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          form.reorderListItem("variables", {
                            from: index,
                            to: index - 1,
                          });
                        }}
                      >
                        <IconArrowUp size={14} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        aria-label="Move variable down"
                        disabled={index === form.values.variables.length - 1}
                        onClick={(event) => {
                          event.stopPropagation();
                          form.reorderListItem("variables", {
                            from: index,
                            to: index + 1,
                          });
                        }}
                      >
                        <IconArrowDown size={14} />
                      </ActionIcon>
                    </Stack>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Accordion.Control>
                        <Stack gap={6}>
                          <Group gap="xs" wrap="nowrap">
                            <Text size="sm" c="dimmed" w={18} ta="right">
                              {index + 1}
                            </Text>
                            <Text
                              fw={600}
                              lineClamp={2}
                              style={{ flex: 1, minWidth: 0 }}
                            >
                              # {variable.variable_name || "variable"}
                            </Text>
                          </Group>
                          <Group gap={6} wrap="wrap">
                            <Badge variant="light" size="sm">
                              {variable.options.length} options
                            </Badge>
                            {variable.variable_name ? (
                              <Code>{`{{${variable.variable_name}}}`}</Code>
                            ) : null}
                            {variable.multi_select ? (
                              <Badge size="sm" variant="outline">
                                multi
                              </Badge>
                            ) : null}
                          </Group>
                        </Stack>
                      </Accordion.Control>
                    </Box>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      mt={6}
                      aria-label="Remove variable"
                      onClick={(event) => {
                        event.stopPropagation();
                        form.removeListItem("variables", index);
                        setExpandedVariables((current) =>
                          current.filter((id) => id !== variable.id),
                        );
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      <TextInput
                        label="Variable name"
                        description="Use {{name}} in any prompt section to insert the selected value. Must be alphanumeric/underscores only."
                        {...form.getInputProps(
                          `variables.${index}.variable_name`,
                        )}
                      />
                      <TextInput
                        label="Question (shown to user)"
                        {...form.getInputProps(`variables.${index}.question`)}
                      />
                      <Switch
                        label="Multi-Select"
                        description="Allow users to select multiple options instead of just one."
                        {...form.getInputProps(
                          `variables.${index}.multi_select`,
                          { type: "checkbox" },
                        )}
                      />
                      <Stack gap={4}>
                        <Text size="sm" fw={500}>
                          Presentation
                        </Text>
                        <SegmentedControl
                          fullWidth
                          data={VARIABLE_PRESENTATIONS.map((value) => ({
                            value,
                            label:
                              value.charAt(0).toUpperCase() + value.slice(1),
                          }))}
                          value={variable.presentation}
                          onChange={(value) =>
                            form.setFieldValue(
                              `variables.${index}.presentation`,
                              value as typeof variable.presentation,
                            )
                          }
                        />
                      </Stack>
                      <Switch
                        label="Alphabetical option display"
                        description="Manual order is kept for editing and exports."
                        {...form.getInputProps(
                          `variables.${index}.alphabetical`,
                          { type: "checkbox" },
                        )}
                      />

                      <Group justify="space-between" align="center">
                        <Text size="sm" fw={500}>
                          Options
                        </Text>
                        <Button
                          variant="default"
                          size="compact-xs"
                          leftSection={<IconPlus size={14} />}
                          onClick={() =>
                            form.insertListItem(
                              `variables.${index}.options`,
                              defaultVariableOption(),
                            )
                          }
                        >
                          Add Option
                        </Button>
                      </Group>

                      <Stack gap="xs">
                        {variable.options.map((option, optionIndex) => (
                          <Group
                            key={option.id}
                            align="flex-start"
                            wrap="nowrap"
                            gap="xs"
                          >
                            <Stack gap={2}>
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                aria-label="Move option up"
                                disabled={optionIndex === 0}
                                onClick={() =>
                                  form.reorderListItem(
                                    `variables.${index}.options`,
                                    {
                                      from: optionIndex,
                                      to: optionIndex - 1,
                                    },
                                  )
                                }
                              >
                                <IconArrowUp size={14} />
                              </ActionIcon>
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                aria-label="Move option down"
                                disabled={
                                  optionIndex === variable.options.length - 1
                                }
                                onClick={() =>
                                  form.reorderListItem(
                                    `variables.${index}.options`,
                                    {
                                      from: optionIndex,
                                      to: optionIndex + 1,
                                    },
                                  )
                                }
                              >
                                <IconArrowDown size={14} />
                              </ActionIcon>
                            </Stack>
                            <Text size="sm" c="dimmed" w={16} pt={6}>
                              {optionIndex + 1}
                            </Text>
                            <TextInput
                              placeholder="Label"
                              style={{ flex: "0 0 140px" }}
                              {...form.getInputProps(
                                `variables.${index}.options.${optionIndex}.label`,
                              )}
                            />
                            <TextInput
                              placeholder="Value injected into prompt"
                              style={{ flex: 1 }}
                              {...form.getInputProps(
                                `variables.${index}.options.${optionIndex}.value`,
                              )}
                            />
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label="Remove option"
                              onClick={() =>
                                form.removeListItem(
                                  `variables.${index}.options`,
                                  optionIndex,
                                )
                              }
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        ))}
                      </Stack>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Stack>
        </Tabs.Panel>

        {presetId ? (
          <Tabs.Panel value="test" pt="md">
            <PresetTestPanel
              presetId={presetId}
              values={form.values}
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
    <Group align="end" grow wrap="nowrap">
      <Select
        label="Position"
        data={[
          { value: "ordered", label: "Ordered" },
          { value: "index", label: "Numeric index" },
        ]}
        value={mode}
        allowDeselect={false}
        onChange={(value) =>
          onModeChange(value === "index" ? "index" : "ordered")
        }
      />
      {mode === "index" ? (
        <NumberInput
          label="Index"
          min={0}
          value={typeof position === "number" ? position : 0}
          onChange={(value) =>
            onIndexChange(typeof value === "number" ? value : 0)
          }
        />
      ) : null}
    </Group>
  );
}
