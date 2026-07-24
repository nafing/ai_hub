import { useMemo, useState } from "react";
import {
  Checkbox,
  Code,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
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
  REGEX_APPLY_TO,
  REGEX_APPLY_TO_LABELS,
  REGEX_SCOPE_LABELS,
  REGEX_SCOPES,
  REGEX_TARGET_LABELS,
  REGEX_TARGETS,
  applyRegexScriptToText,
  isUnsafeRegexPattern,
  type CreateRegexScriptInput,
  type RegexApplyTo,
  type RegexScope,
  type RegexScript,
  type RegexTarget,
} from "@ai-hub/shared";

export type RegexFormValues = CreateRegexScriptInput;

type RegexFormProps = {
  formId?: string;
  initialValues: RegexFormValues;
  onSubmit: (values: RegexFormValues) => Promise<void> | void;
};

const SAMPLE =
  "*She smiles* and says hello. ((OOC: ignore this)) She smiles again.";

export function RegexForm({
  formId = "regex-form",
  initialValues,
  onSubmit,
}: RegexFormProps) {
  const form = useForm<RegexFormValues>({
    mode: "uncontrolled",
    initialValues,
    validate: {
      name: isNotEmpty("Name is required"),
      find_regex: (value) => {
        if (!value.trim()) return "Find pattern is required";
        if (isUnsafeRegexPattern(value)) {
          return "Pattern looks unsafe (possible ReDoS) — simplify nested quantifiers";
        }
        try {
          // eslint-disable-next-line no-new
          new RegExp(value, "g");
        } catch {
          return "Invalid regular expression";
        }
        return null;
      },
      targets: (value) =>
        value.length === 0 ? "Select at least one target" : null,
      flags: (value) => {
        if (!/^[gimsuy]*$/.test(value)) {
          return "Flags may only include g, i, m, s, u, y";
        }
        return null;
      },
    },
  });

  const [sample, setSample] = useState(SAMPLE);
  const [previewValues, setPreviewValues] = useState(initialValues);
  const [scope, setScope] = useState(initialValues.scope);

  form.watch("find_regex", ({ value }) => {
    setPreviewValues((prev) => ({ ...prev, find_regex: value }));
  });
  form.watch("replace_with", ({ value }) => {
    setPreviewValues((prev) => ({ ...prev, replace_with: value }));
  });
  form.watch("flags", ({ value }) => {
    setPreviewValues((prev) => ({ ...prev, flags: value }));
  });
  form.watch("scope", ({ value }) => {
    setScope(value);
  });

  const preview = useMemo(() => {
    const script: RegexScript = {
      id: "preview",
      ...previewValues,
      enabled: true,
    };
    return applyRegexScriptToText(sample, script);
  }, [previewValues, sample]);

  return (
    <form
      id={formId}
      onSubmit={form.onSubmit((values) => {
        void onSubmit({
          ...values,
          character_ids:
            values.scope === "character" ? values.character_ids : [],
          min_depth: values.min_depth === undefined ? null : values.min_depth,
          max_depth: values.max_depth === undefined ? null : values.max_depth,
        });
      })}
    >
      <Stack gap="lg">
        <Stack gap="sm">
          <Title order={4}>Basics</Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Name"
              description="The display name for this regex."
              withAsterisk
              key={form.key("name")}
              {...form.getInputProps("name")}
            />
            <NumberInput
              label="Order"
              description="Lower runs first"
              allowDecimal={false}
              key={form.key("order")}
              {...form.getInputProps("order")}
            />
          </SimpleGrid>
          <Switch
            label="Enabled"
            key={form.key("enabled")}
            {...form.getInputProps("enabled", { type: "checkbox" })}
          />
        </Stack>

        <Stack gap="sm">
          <Title order={4}>Pattern</Title>
          <TextInput
            label="Find regex"
            description="JS regex source without surrounding slashes. Example: \\*([^*]+)\\*"
            withAsterisk
            styles={{
              input: { fontFamily: "var(--mantine-font-family-monospace)" },
            }}
            key={form.key("find_regex")}
            {...form.getInputProps("find_regex")}
          />
          <TextInput
            label="Replace with"
            description="Use $1, $2 for capture groups. Example: $1"
            styles={{
              input: { fontFamily: "var(--mantine-font-family-monospace)" },
            }}
            key={form.key("replace_with")}
            {...form.getInputProps("replace_with")}
          />
          <TextInput
            label="Flags"
            description="Recommended: g. Allowed: g i m s u y"
            styles={{
              input: { fontFamily: "var(--mantine-font-family-monospace)" },
            }}
            key={form.key("flags")}
            {...form.getInputProps("flags")}
          />
        </Stack>

        <Stack gap="sm">
          <Title order={4}>Where it applies</Title>
          <Checkbox.Group
            label="Targets"
            description="Which message sources the script runs on"
            key={form.key("targets")}
            {...form.getInputProps("targets")}
          >
            <Group mt="xs">
              {REGEX_TARGETS.map((target) => (
                <Checkbox
                  key={target}
                  value={target}
                  label={REGEX_TARGET_LABELS[target as RegexTarget]}
                />
              ))}
            </Group>
          </Checkbox.Group>

          <Select
            label="Apply to"
            description="Display = screen only · Prompt = model context only · Both = both"
            data={REGEX_APPLY_TO.map((value) => ({
              value,
              label: REGEX_APPLY_TO_LABELS[value as RegexApplyTo],
            }))}
            allowDeselect={false}
            key={form.key("apply_to")}
            {...form.getInputProps("apply_to")}
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NumberInput
              label="Min depth"
              description="0 = newest message. Empty = no min"
              allowDecimal={false}
              min={0}
              key={form.key("min_depth")}
              {...form.getInputProps("min_depth")}
              onChange={(value) =>
                form.setFieldValue(
                  "min_depth",
                  value === "" || value === undefined ? null : Number(value),
                )
              }
            />
            <NumberInput
              label="Max depth"
              description="Empty = no max"
              allowDecimal={false}
              min={0}
              key={form.key("max_depth")}
              {...form.getInputProps("max_depth")}
              onChange={(value) =>
                form.setFieldValue(
                  "max_depth",
                  value === "" || value === undefined ? null : Number(value),
                )
              }
            />
          </SimpleGrid>

          <Select
            label="Scope"
            description="Which message sources the script runs on"
            data={REGEX_SCOPES.map((value) => ({
              value,
              label: REGEX_SCOPE_LABELS[value as RegexScope],
            }))}
            allowDeselect={false}
            key={form.key("scope")}
            {...form.getInputProps("scope")}
          />

          {scope === "character" ? (
            <TagsInput
              label="Character IDs"
              description="Scripts run only when the chat character matches one of these IDs"
              placeholder="Paste character id and press Enter"
              key={form.key("character_ids")}
              {...form.getInputProps("character_ids")}
            />
          ) : null}
        </Stack>

        <Stack gap="sm">
          <Title order={4}>Live preview</Title>
          <Text size="sm" c="dimmed">
            Tries the current pattern on sample text (same engine as chat
            display/prompt apply, including ReDoS + timeout guards).
          </Text>
          <Textarea
            label="Sample input"
            autosize
            value={sample}
            onChange={(event) => setSample(event.currentTarget.value)}
          />
          <div>
            <Text size="sm" fw={500} mb={4}>
              Output
            </Text>
            {preview.skipped ? (
              <Text size="sm" c="red">
                Skipped: {preview.skipped}
              </Text>
            ) : (
              <Code block>{preview.text || "(empty)"}</Code>
            )}
          </div>
        </Stack>
      </Stack>
    </form>
  );
}
