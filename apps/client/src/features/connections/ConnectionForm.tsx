import { useMemo, useRef, useState } from "react";
import {
  Button,
  Group,
  NumberInput,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import {
  REASONING_EFFORTS,
  SERVICE_TIERS,
  VERBOSITIES,
  type CreateConnectionInput,
  type OpenRouterModel,
} from "@ai-hub/shared";
import { useOpenRouterEndpoints, useOpenRouterModels } from "./queries";

export type ConnectionFormValues = CreateConnectionInput;

type ConnectionFormProps = {
  formId?: string;
  initialValues: ConnectionFormValues;
  connectionId?: string;
  onSubmit: (values: ConnectionFormValues) => Promise<void> | void;
};

const NONE_VALUE = "__none__";

/** Pulls `provider/model` from labels like `DeepSeek: Foo (deepseek/foo)`. */
const CANONICAL_IN_PARENS = /\(([^()/]+\/[^()]+)\)\s*$/;

function toSelectValue(value: string) {
  return value || NONE_VALUE;
}

function fromSelectValue(value: string | null) {
  if (!value || value === NONE_VALUE) return "";
  return value;
}

function labelForTier(value: string) {
  if (!value) return "None (omit service_tier)";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function modelOptionLabel(model: OpenRouterModel) {
  return model.name === model.id ? model.id : `${model.name} (${model.id})`;
}

/** Always prefer OpenRouter canonical slug (`org/model`), never the display name. */
function resolveCanonicalModelId(
  raw: string,
  models: OpenRouterModel[] | undefined,
): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const byId = models?.find((model) => model.id === trimmed);
  if (byId) return byId.id;

  const byName = models?.find((model) => model.name === trimmed);
  if (byName) return byName.id;

  const byLabel = models?.find((model) => modelOptionLabel(model) === trimmed);
  if (byLabel) return byLabel.id;

  const fromParens = trimmed.match(CANONICAL_IN_PARENS)?.[1];
  if (fromParens) return fromParens;

  return trimmed;
}

function isCanonicalModelId(value: string) {
  return value.includes("/") && !value.includes(" ");
}

export function ConnectionForm({
  formId = "connection-form",
  initialValues,
  connectionId,
  onSubmit,
}: ConnectionFormProps) {
  const normalizedInitialModel = resolveCanonicalModelId(
    initialValues.model,
    undefined,
  );

  const form = useForm<ConnectionFormValues>({
    mode: "uncontrolled",
    initialValues: {
      ...initialValues,
      model: normalizedInitialModel,
    },
    validate: {
      name: isNotEmpty("Name is required"),
      api_key: isNotEmpty("API key is required"),
      model: isNotEmpty("Model is required"),
      max_parallel_jobs: isNotEmpty("Max parallel jobs is required"),
      max_completion_tokens: isNotEmpty("Max completion tokens is required"),
      context_length: isNotEmpty("Context length is required"),
      temperature: isNotEmpty("Temperature is required"),
      top_p: isNotEmpty("Top P is required"),
      top_k: isNotEmpty("Top K is required"),
    },
  });

  // Live snapshots for react-query — updated via form.watch, not useEffect on form.values.
  const [apiKey, setApiKey] = useState(initialValues.api_key);
  const [model, setModel] = useState(normalizedInitialModel);
  const [loadModels, setLoadModels] = useState(false);
  const modelsListRef = useRef<OpenRouterModel[] | undefined>(undefined);

  form.watch("api_key", ({ value }) => {
    setApiKey(value);
  });

  form.watch("model", ({ value, previousValue }) => {
    const modelsList = modelsListRef.current;
    const resolved = resolveCanonicalModelId(value, modelsList);
    setModel(resolved);

    if (resolved !== value && isCanonicalModelId(resolved)) {
      form.setFieldValue("model", resolved);
    }

    if (resolved && resolved !== previousValue) {
      form.setFieldValue("preferred_provider", "");
      const meta = modelsList?.find((item) => item.id === resolved);
      if (meta?.max_completion_tokens != null) {
        form.setFieldValue(
          "max_completion_tokens",
          meta.max_completion_tokens,
        );
      }
      if (meta?.context_length != null) {
        form.setFieldValue("context_length", meta.context_length);
      }
    }
  });

  const auth = useMemo(
    () => ({
      apiKey,
      connectionId: apiKey.trim() ? undefined : connectionId,
    }),
    [apiKey, connectionId],
  );

  const modelsQuery = useOpenRouterModels(auth, loadModels);
  modelsListRef.current = modelsQuery.data;

  const modelId = useMemo(
    () => resolveCanonicalModelId(model, modelsQuery.data),
    [model, modelsQuery.data],
  );

  const endpointsSlug = useMemo(() => {
    const match = modelsQuery.data?.find(
      (item) => item.id === modelId || item.canonical_slug === modelId,
    );
    return match?.canonical_slug ?? modelId;
  }, [modelsQuery.data, modelId]);

  const endpointsQuery = useOpenRouterEndpoints(
    endpointsSlug,
    auth,
    isCanonicalModelId(endpointsSlug) &&
      Boolean(auth.apiKey?.trim() || auth.connectionId),
  );

  const modelOptions = useMemo(() => {
    const fromApi =
      modelsQuery.data?.map((item) => ({
        value: item.id,
        label: modelOptionLabel(item),
      })) ?? [];
    if (modelId && !fromApi.some((option) => option.value === modelId)) {
      return [{ value: modelId, label: modelId }, ...fromApi];
    }
    return fromApi;
  }, [modelsQuery.data, modelId]);

  const providerOptions = useMemo(() => {
    const fromApi =
      endpointsQuery.data?.map((endpoint) => ({
        value: endpoint.provider,
        label: endpoint.name
          ? `${endpoint.name} (${endpoint.provider})`
          : endpoint.provider,
      })) ?? [];
    return [
      { value: NONE_VALUE, label: "Automatic (OpenRouter chooses)" },
      ...fromApi,
    ];
  }, [endpointsQuery.data]);

  async function handleSubmit(values: ConnectionFormValues) {
    const modelIdResolved = resolveCanonicalModelId(
      values.model,
      modelsQuery.data,
    );
    await onSubmit({ ...values, model: modelIdResolved });
  }

  return (
    <form
      id={formId}
      onSubmit={form.onSubmit((values) => void handleSubmit(values))}
    >
      <Stack gap="md">
        <Title order={3}>Basics</Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Name"
            description="A friendly name like 'Claude Sonnet — RP' or 'GPT-4o Main'."
            key={form.key("name")}
            {...form.getInputProps("name")}
          />
          <PasswordInput
            label="API key"
            description="Your OpenRouter authentication key."
            key={form.key("api_key")}
            {...form.getInputProps("api_key")}
          />
        </SimpleGrid>
        <Switch
          label="Default connection"
          description="Use this connection as the active one. Only one connection can be default at a time."
          key={form.key("is_default")}
          {...form.getInputProps("is_default", { type: "checkbox" })}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Group align="end" wrap="nowrap" gap="xs">
            <Select
              style={{ flex: 1 }}
              label="Model"
              description="Stores the OpenRouter canonical model id (org/model)."
              searchable
              clearable
              allowDeselect={false}
              data={modelOptions}
              key={form.key("model")}
              {...form.getInputProps("model")}
              onChange={(value) => {
                const next = resolveCanonicalModelId(
                  value ?? "",
                  modelsQuery.data,
                );
                form.setFieldValue("model", next);
              }}
              nothingFoundMessage={
                loadModels
                  ? modelsQuery.isFetching
                    ? "Loading models…"
                    : "No models found — type a custom model ID"
                  : "Load models to search"
              }
              error={
                modelsQuery.isError
                  ? "Failed to load models"
                  : form.errors.model
              }
            />
            <Button
              variant="default"
              onClick={() => setLoadModels(true)}
              loading={modelsQuery.isFetching}
              disabled={!apiKey.trim() && !connectionId}
            >
              Load models
            </Button>
          </Group>
          <Select
            label="Preferred provider"
            description="Leave empty to let OpenRouter choose automatically."
            searchable
            clearable
            data={providerOptions}
            key={form.key("preferred_provider")}
            {...form.getInputProps("preferred_provider")}
            onChange={(value) =>
              form.setFieldValue(
                "preferred_provider",
                fromSelectValue(value),
              )
            }
            disabled={!isCanonicalModelId(modelId)}
            nothingFoundMessage={
              endpointsQuery.isFetching ? "Loading providers…" : "No providers"
            }
          />
        </SimpleGrid>
        <NumberInput
          label="Max parallel jobs"
          description="How many agent LLM requests may run at once for this connection."
          min={1}
          key={form.key("max_parallel_jobs")}
          {...form.getInputProps("max_parallel_jobs")}
        />

        <Title order={3}>Generation</Title>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          <NumberInput
            label="Max completion tokens"
            description="Auto-set when you pick a model from the list."
            min={1}
            key={form.key("max_completion_tokens")}
            {...form.getInputProps("max_completion_tokens")}
          />
          <NumberInput
            label="Context length"
            description="Model context window size."
            min={1}
            key={form.key("context_length")}
            {...form.getInputProps("context_length")}
          />
          <NumberInput
            label="Temperature"
            description="Lower = more focused; higher = more creative."
            decimalScale={2}
            step={0.1}
            key={form.key("temperature")}
            {...form.getInputProps("temperature")}
          />
          <NumberInput
            label="Top P"
            description="Nucleus sampling threshold."
            decimalScale={2}
            step={0.05}
            min={0}
            max={1}
            key={form.key("top_p")}
            {...form.getInputProps("top_p")}
          />
          <NumberInput
            label="Top K"
            description="0 disables this limit."
            min={0}
            key={form.key("top_k")}
            {...form.getInputProps("top_k")}
          />
          <NumberInput
            label="Frequency penalty"
            description="Penalty for repeated tokens."
            decimalScale={2}
            step={0.1}
            key={form.key("frequency_penalty")}
            {...form.getInputProps("frequency_penalty")}
          />
          <NumberInput
            label="Presence penalty"
            description="Penalty for new tokens."
            decimalScale={2}
            step={0.1}
            key={form.key("presence_penalty")}
            {...form.getInputProps("presence_penalty")}
          />
        </SimpleGrid>

        <Title order={3}>Advanced</Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Assistant prefill"
            description="Optional assistant-role text appended after the final user message."
            key={form.key("assistant_prefill")}
            {...form.getInputProps("assistant_prefill")}
          />
          <TextInput
            label="Thinking tag"
            description="Example: <thinking>{{thinking}}</thinking>"
            key={form.key("thinking_tag")}
            {...form.getInputProps("thinking_tag")}
          />
        </SimpleGrid>
        <Textarea
          label="Custom parameters"
          description='Raw JSON object merged into the provider request body. Example: { "reasoning_effort": "high" }'
          autosize
          minRows={3}
          defaultValue={JSON.stringify(
            initialValues.custom_parameters ?? {},
            null,
            2,
          )}
          error={form.errors.custom_parameters}
          onChange={(event) => {
            const text = event.currentTarget.value;
            try {
              const parsed: unknown = JSON.parse(text || "{}");
              if (
                typeof parsed !== "object" ||
                parsed === null ||
                Array.isArray(parsed)
              ) {
                form.setFieldError(
                  "custom_parameters",
                  "Custom parameters must be a JSON object",
                );
                return;
              }
              form.setFieldValue(
                "custom_parameters",
                parsed as Record<string, unknown>,
              );
              form.clearFieldError("custom_parameters");
            } catch {
              form.setFieldError("custom_parameters", "Invalid JSON");
            }
          }}
        />
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          <Select
            label="Service tier"
            description="OpenRouter routing tier. Empty omits service_tier."
            data={SERVICE_TIERS.map((value) => ({
              value: toSelectValue(value),
              label: labelForTier(value),
            }))}
            key={form.key("service_tier")}
            {...form.getInputProps("service_tier")}
            onChange={(value) =>
              form.setFieldValue("service_tier", fromSelectValue(value))
            }
            allowDeselect={false}
          />
          <Select
            label="Reasoning effort"
            description="OpenRouter reasoning effort level."
            data={REASONING_EFFORTS.map((value) => ({
              value: toSelectValue(value),
              label: value || "None",
            }))}
            key={form.key("reasoning_effort")}
            {...form.getInputProps("reasoning_effort")}
            onChange={(value) =>
              form.setFieldValue("reasoning_effort", fromSelectValue(value))
            }
            allowDeselect={false}
          />
          <Select
            label="Verbosity"
            description="OpenRouter verbosity level."
            data={VERBOSITIES.map((value) => ({
              value: toSelectValue(value),
              label: value || "None",
            }))}
            key={form.key("verbosity")}
            {...form.getInputProps("verbosity")}
            onChange={(value) =>
              form.setFieldValue("verbosity", fromSelectValue(value))
            }
            allowDeselect={false}
          />
        </SimpleGrid>
        <Switch
          label="Prompt caching"
          description="Sends cache_control for OpenRouter Claude models."
          key={form.key("prompt_caching")}
          {...form.getInputProps("prompt_caching", { type: "checkbox" })}
        />

        {modelsQuery.isError ? (
          <Text c="red" size="sm">
            Could not load OpenRouter models. Check the API key.
          </Text>
        ) : null}
      </Stack>
    </form>
  );
}
