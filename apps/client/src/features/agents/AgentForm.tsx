import { useMemo, useState } from "react";
import {
  Code,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import {
  AGENT_CATEGORIES,
  AGENT_EXECUTIONS,
  AGENT_PHASES,
  isValidAgentSlug,
  type CreateAgentInput,
} from "@ai-hub/shared";
import { useTools } from "@/features/tools/queries";

export type AgentFormValues = CreateAgentInput;

type AgentFormProps = {
  formId?: string;
  initialValues: AgentFormValues;
  /** Built-in agents cannot change slug. */
  slugLocked?: boolean;
  onSubmit: (values: AgentFormValues) => Promise<void> | void;
};

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

export function AgentForm({
  formId = "agent-form",
  initialValues,
  slugLocked = false,
  onSubmit,
}: AgentFormProps) {
  const { data: tools } = useTools();
  const toolOptions = useMemo(
    () =>
      (tools ?? []).map((tool) => ({
        value: tool.name,
        label: tool.name,
      })),
    [tools],
  );

  const form = useForm<AgentFormValues>({
    mode: "uncontrolled",
    initialValues,
    validate: {
      name: isNotEmpty("Name is required"),
      slug: (value) => {
        if (!value.trim()) return "Slug is required";
        if (!isValidAgentSlug(value.trim())) {
          return "Must start with a letter; only lowercase letters, digits, hyphens";
        }
        return null;
      },
    },
  });

  const [settingsJson, setSettingsJson] = useState(
    formatJson(initialValues.default_settings),
  );
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [templatesJson, setTemplatesJson] = useState(
    formatJson(initialValues.prompt_templates),
  );
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  return (
    <form
      id={formId}
      onSubmit={form.onSubmit((values) => {
        let default_settings: Record<string, unknown> = {};
        try {
          const parsed: unknown = JSON.parse(settingsJson || "{}");
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
          ) {
            setSettingsError("Must be a JSON object");
            return;
          }
          default_settings = parsed as Record<string, unknown>;
          setSettingsError(null);
        } catch {
          setSettingsError("Invalid JSON");
          return;
        }

        let prompt_templates = initialValues.prompt_templates;
        try {
          const parsed: unknown = JSON.parse(templatesJson || "[]");
          if (!Array.isArray(parsed)) {
            setTemplatesError("Must be a JSON array");
            return;
          }
          prompt_templates = parsed as AgentFormValues["prompt_templates"];
          setTemplatesError(null);
        } catch {
          setTemplatesError("Invalid JSON");
          return;
        }

        void onSubmit({
          ...values,
          name: values.name.trim(),
          slug: values.slug.trim(),
          default_settings,
          prompt_templates,
          default_tools: values.default_tools ?? [],
          mode_allowlist: values.mode_allowlist ?? [],
          result_type: values.result_type || null,
          run_interval:
            values.run_interval === undefined ||
            values.run_interval === null ||
            Number.isNaN(Number(values.run_interval))
              ? null
              : Number(values.run_interval),
        });
      })}
    >
      <Stack gap="lg">
        <Stack gap="sm">
          <Title order={4}>Basics</Title>
          <TextInput
            label="Name"
            withAsterisk
            key={form.key("name")}
            {...form.getInputProps("name")}
          />
          <TextInput
            label="Slug"
            description={
              slugLocked
                ? "Built-in agent slug is locked."
                : "Stable kebab-case id used by the hub."
            }
            withAsterisk
            readOnly={slugLocked}
            styles={{
              input: { fontFamily: "var(--mantine-font-family-monospace)" },
            }}
            key={form.key("slug")}
            {...form.getInputProps("slug")}
          />
          <Textarea
            label="Description"
            autosize
            minRows={2}
            key={form.key("description")}
            {...form.getInputProps("description")}
          />
          <TextInput
            label="Author"
            key={form.key("author")}
            {...form.getInputProps("author")}
          />
          <Select
            label="Phase"
            data={AGENT_PHASES.map((value) => ({ value, label: value }))}
            allowDeselect={false}
            key={form.key("phase")}
            {...form.getInputProps("phase")}
          />
          <Select
            label="Category"
            data={AGENT_CATEGORIES.map((value) => ({ value, label: value }))}
            allowDeselect={false}
            key={form.key("category")}
            {...form.getInputProps("category")}
          />
          <Select
            label="Execution"
            description="feature = non-LLM runtime (e.g. Calls)."
            data={AGENT_EXECUTIONS.map((value) => ({ value, label: value }))}
            allowDeselect={false}
            key={form.key("execution")}
            {...form.getInputProps("execution")}
          />
          <Select
            label="Result type"
            clearable
            data={[{ value: "text_rewrite", label: "text_rewrite" }]}
            key={form.key("result_type")}
            {...form.getInputProps("result_type")}
          />
          <Switch
            label="Enabled by default"
            description="Suggested on when first added to a chat."
            key={form.key("enabled_by_default")}
            {...form.getInputProps("enabled_by_default", { type: "checkbox" })}
          />
          <Switch
            label="Inject as section"
            description="Trackers can inject state into the prompt as a section."
            key={form.key("default_inject_as_section")}
            {...form.getInputProps("default_inject_as_section", {
              type: "checkbox",
            })}
          />
          <Switch
            label="Runtime disabled"
            description="Skip LLM pipeline (feature agents)."
            key={form.key("runtime_disabled")}
            {...form.getInputProps("runtime_disabled", { type: "checkbox" })}
          />
          <NumberInput
            label="Run interval"
            description="Optional — run every N messages (null = every turn)."
            min={1}
            allowDecimal={false}
            clearable
            key={form.key("run_interval")}
            {...form.getInputProps("run_interval")}
          />
        </Stack>

        <Stack gap="sm">
          <Title order={4}>Tools & modes</Title>
          <MultiSelect
            label="Default tools"
            description="Tool names from the Tools catalog."
            data={toolOptions}
            searchable
            key={form.key("default_tools")}
            {...form.getInputProps("default_tools")}
          />
          <TagsInput
            label="Mode allowlist"
            description="Empty = all modes. Examples: roleplay, conversation, visual_novel."
            key={form.key("mode_allowlist")}
            {...form.getInputProps("mode_allowlist")}
          />
        </Stack>

        <Stack gap="sm">
          <Title order={4}>Prompt</Title>
          <Textarea
            label="Default prompt template"
            description="Main system/user prompt for the agent."
            autosize
            minRows={8}
            styles={{
              input: { fontFamily: "var(--mantine-font-family-monospace)" },
            }}
            key={form.key("default_prompt_template")}
            {...form.getInputProps("default_prompt_template")}
          />
        </Stack>

        <Stack gap="sm">
          <Title order={4}>Default settings (JSON)</Title>
          <Text size="sm" c="dimmed">
            Free-form runtime knobs (e.g.{" "}
            <Code>contextSize</Code>, <Code>directorMode</Code>).
          </Text>
          <Textarea
            autosize
            minRows={6}
            error={settingsError}
            value={settingsJson}
            onChange={(event) => {
              setSettingsJson(event.currentTarget.value);
              setSettingsError(null);
            }}
            styles={{
              input: { fontFamily: "var(--mantine-font-family-monospace)" },
            }}
          />
        </Stack>

        <Stack gap="sm">
          <Title order={4}>Prompt templates (JSON)</Title>
          <Text size="sm" c="dimmed">
            Optional alternate packs: array of{" "}
            <Code>
              {"{ id, name, description, prompt_template }"}
            </Code>
            .
          </Text>
          <Textarea
            autosize
            minRows={6}
            error={templatesError}
            value={templatesJson}
            onChange={(event) => {
              setTemplatesJson(event.currentTarget.value);
              setTemplatesError(null);
            }}
            styles={{
              input: { fontFamily: "var(--mantine-font-family-monospace)" },
            }}
          />
        </Stack>
      </Stack>
    </form>
  );
}
