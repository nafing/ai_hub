import { useMemo, useState } from "react";
import {
  Code,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import {
  formatToolParametersJson,
  isValidToolName,
  parseToolParametersJson,
  toLlmToolDefinition,
  type CreateToolInput,
} from "@ai-hub/shared";

export type ToolFormValues = CreateToolInput;

type ToolFormProps = {
  formId?: string;
  initialValues: ToolFormValues;
  /** Default tools cannot be renamed. */
  nameLocked?: boolean;
  onSubmit: (values: ToolFormValues) => Promise<void> | void;
};

export function ToolForm({
  formId = "tool-form",
  initialValues,
  nameLocked = false,
  onSubmit,
}: ToolFormProps) {
  const form = useForm<ToolFormValues>({
    mode: "uncontrolled",
    initialValues,
    validate: {
      name: (value) => {
        if (!value.trim()) return "Name is required";
        if (!isValidToolName(value.trim())) {
          return "Must start with a letter; only letters, digits, underscores";
        }
        return null;
      },
      description: isNotEmpty("Description is required"),
    },
  });

  const [parametersJson, setParametersJson] = useState(
    formatToolParametersJson(initialValues.parameters),
  );
  const [parametersError, setParametersError] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState(initialValues.name);
  const [previewDescription, setPreviewDescription] = useState(
    initialValues.description,
  );

  form.watch("name", ({ value }) => setPreviewName(value));
  form.watch("description", ({ value }) => setPreviewDescription(value));

  const llmPreview = useMemo(() => {
    const parsed = parseToolParametersJson(parametersJson);
    return toLlmToolDefinition({
      name: previewName || "tool_name",
      description: previewDescription,
      parameters: parsed.ok ? parsed.value : initialValues.parameters,
    });
  }, [
    parametersJson,
    previewName,
    previewDescription,
    initialValues.parameters,
  ]);

  return (
    <form
      id={formId}
      onSubmit={form.onSubmit((values) => {
        const parsed = parseToolParametersJson(parametersJson);
        if (!parsed.ok) {
          setParametersError(parsed.error);
          return;
        }
        setParametersError(null);
        void onSubmit({
          ...values,
          name: values.name.trim(),
          parameters: parsed.value,
        });
      })}
    >
      <Stack gap="lg">
        <Stack gap="sm">
          <Title order={4}>Basics</Title>
          <TextInput
            label="Name"
            description={
              nameLocked
                ? "Default tool name is locked."
                : "Snake_case function name the model will call."
            }
            withAsterisk
            readOnly={nameLocked}
            styles={{
              input: { fontFamily: "var(--mantine-font-family-monospace)" },
            }}
            key={form.key("name")}
            {...form.getInputProps("name")}
          />
          <Textarea
            label="Description"
            description="Tell the model when and how to use this tool."
            withAsterisk
            autosize
            minRows={3}
            key={form.key("description")}
            {...form.getInputProps("description")}
          />
        </Stack>

        <Stack gap="sm">
          <Title order={4}>Parameters (JSON Schema)</Title>
          <Text size="sm" c="dimmed">
            Must be a JSON Schema object with{" "}
            <Code>type: &quot;object&quot;</Code> and a{" "}
            <Code>properties</Code> map.
          </Text>
          <Textarea
            label="parameters"
            autosize
            minRows={10}
            error={parametersError}
            value={parametersJson}
            onChange={(event) => {
              setParametersJson(event.currentTarget.value);
              setParametersError(null);
            }}
            styles={{
              input: { fontFamily: "var(--mantine-font-family-monospace)" },
            }}
          />
        </Stack>

        <Stack gap="sm">
          <Title order={4}>LLM payload preview</Title>
          <Text size="sm" c="dimmed">
            What gets sent in OpenRouter/OpenAI <Code>tools[]</Code>.
          </Text>
          <Code block>{JSON.stringify(llmPreview, null, 2)}</Code>
        </Stack>
      </Stack>
    </form>
  );
}
