import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  REASONING_EFFORTS,
  SERVICE_TIERS,
  VERBOSITIES,
  type CreateConnectionInput,
  type OpenRouterModel,
} from "@ai-hub/shared";
import {
  Button,
  Textarea,
  Select,
  TextInput,
  NumberInput,
  Switch,
  RuntimeText,
} from "@/components/ui";
import { useOpenRouterEndpoints, useOpenRouterModels } from "./queries";
import classes from "./ConnectionForm.module.css";

export type ConnectionFormValues = CreateConnectionInput;

type ConnectionFormProps = {
  formId?: string;
  initialValues: ConnectionFormValues;
  connectionId?: string;
  onSubmit: (values: ConnectionFormValues) => Promise<void> | void;
};

const NONE_VALUE = "__none__";
const CANONICAL_IN_PARENS = /\(([^()/]+\/[^()]+)\)\s*$/;

function toSelectValue(value: string) {
  return value || NONE_VALUE;
}

function fromSelectValue(value: string) {
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

type FieldErrors = Partial<Record<keyof ConnectionFormValues, string>>;

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

export function ConnectionForm({
  formId = "connection-form",
  initialValues,
  connectionId,
  onSubmit,
}: ConnectionFormProps) {
  const [values, setValues] = useState<ConnectionFormValues>(() => ({
    ...initialValues,
    kind: "llm",
    model: resolveCanonicalModelId(initialValues.model, undefined),
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [customParamsText, setCustomParamsText] = useState(() =>
    JSON.stringify(initialValues.custom_parameters ?? {}, null, 2),
  );
  const [loadModels, setLoadModels] = useState(false);

  const auth = useMemo(
    () => ({
      apiKey: values.api_key,
      connectionId: values.api_key.trim() ? undefined : connectionId,
    }),
    [values.api_key, connectionId],
  );

  const modelsQuery = useOpenRouterModels(auth, loadModels);

  const modelId = useMemo(
    () => resolveCanonicalModelId(values.model, modelsQuery.data),
    [values.model, modelsQuery.data],
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

  function setField<K extends keyof ConnectionFormValues>(
    key: K,
    value: ConnectionFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function setModelValue(raw: string) {
    const resolved = resolveCanonicalModelId(raw, modelsQuery.data);
    setValues((current) => {
      const next = { ...current, model: resolved };
      if (resolved && resolved !== current.model) {
        next.preferred_provider = "";
        const meta = modelsQuery.data?.find((item) => item.id === resolved);
        if (meta?.max_completion_tokens != null) {
          next.max_completion_tokens = meta.max_completion_tokens;
        }
        if (meta?.context_length != null) {
          next.context_length = meta.context_length;
        }
      }
      return next;
    });
    setErrors((current) => {
      if (!current.model) return current;
      const next = { ...current };
      delete next.model;
      return next;
    });
  }

  function validate(next: ConnectionFormValues): FieldErrors {
    const result: FieldErrors = {};
    if (!next.name.trim()) result.name = "Name is required";
    if (!next.api_key.trim()) result.api_key = "API key is required";
    if (!next.model.trim()) result.model = "Model is required";
    if (next.max_parallel_jobs == null)
      result.max_parallel_jobs = "Max parallel jobs is required";
    if (next.max_completion_tokens == null)
      result.max_completion_tokens = "Max completion tokens is required";
    if (next.context_length == null)
      result.context_length = "Context length is required";
    if (next.temperature == null) result.temperature = "Temperature is required";
    if (next.top_p == null) result.top_p = "Top P is required";
    if (next.top_k == null) result.top_k = "Top K is required";
    return result;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const modelIdResolved = resolveCanonicalModelId(
      values.model,
      modelsQuery.data,
    );
    const payload = { ...values, model: modelIdResolved, kind: "llm" as const };
    const nextErrors = validate(payload);
    if (errors.custom_parameters) {
      nextErrors.custom_parameters = errors.custom_parameters;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(payload);
  }

  function handleCustomParamsChange(text: string) {
    setCustomParamsText(text);
    try {
      const parsed: unknown = JSON.parse(text || "{}");
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        setErrors((current) => ({
          ...current,
          custom_parameters: "Custom parameters must be a JSON object",
        }));
        return;
      }
      setField("custom_parameters", parsed as Record<string, unknown>);
    } catch {
      setErrors((current) => ({
        ...current,
        custom_parameters: "Invalid JSON",
      }));
    }
  }

  return (
    <form id={formId} className={classes.form} onSubmit={handleSubmit}>
      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Basics</h3>
        <div className={`${classes.grid} ${classes.grid2}`}>
          <Field
            label="Name"
            hint="A friendly name like 'Claude Sonnet — RP' or 'GPT-4o Main'."
            error={errors.name}
          >
            <TextInput
              error={Boolean(errors.name)}
              value={values.name}
              onChange={(event) => setField("name", event.target.value)}
            />
          </Field>
          <Field
            label="API key"
            hint="Your OpenRouter authentication key."
            error={errors.api_key}
          >
            <TextInput
              type="password"
              error={Boolean(errors.api_key)}
              value={values.api_key}
              onChange={(event) => setField("api_key", event.target.value)}
              autoComplete="off"
            />
          </Field>
        </div>

        <Switch
          variant="card"
          checked={values.is_default}
          onChange={(checked) => setField("is_default", checked)}
          label="Default connection"
          description="Use this connection as the active one. Only one connection can be default at a time."
        />

        <div className={`${classes.grid} ${classes.grid2}`}>
          <Field
            label="Model"
            hint="Stores the OpenRouter canonical model id (org/model)."
            error={
              modelsQuery.isError ? "Failed to load models" : errors.model
            }
          >
            <div className={classes.fieldStack}>
              <Select
                searchable
                clearable
                data={modelOptions}
                value={values.model}
                onChange={setModelValue}
                placeholder="Select model"
                searchPlaceholder={
                  loadModels
                    ? modelsQuery.isFetching
                      ? "Loading models…"
                      : "Search models…"
                    : "Load models to search"
                }
                nothingFoundMessage={
                  loadModels
                    ? modelsQuery.isFetching
                      ? "Loading models…"
                      : "No models found"
                    : "Load models to search"
                }
                error={Boolean(errors.model || modelsQuery.isError)}
              />
              <Button variant="default" type="button"
                onClick={() => setLoadModels(true)}
                disabled={
                  (!values.api_key.trim() && !connectionId) ||
                  modelsQuery.isFetching
                }
              >
                {modelsQuery.isFetching ? "Loading…" : "Load models"}
              </Button>
            </div>
          </Field>

          <Field
            label="Preferred provider"
            hint="Leave empty to let OpenRouter choose automatically."
          >
            <Select
              searchable
              clearable
              data={providerOptions}
              value={toSelectValue(values.preferred_provider)}
              disabled={!isCanonicalModelId(modelId)}
              onChange={(value) =>
                setField("preferred_provider", fromSelectValue(value))
              }
              placeholder="Automatic (OpenRouter chooses)"
              nothingFoundMessage={
                endpointsQuery.isFetching
                  ? "Loading providers…"
                  : "No providers"
              }
            />
          </Field>
        </div>

        <Field
          label="Max parallel jobs"
          hint="How many agent LLM requests may run at once for this connection."
          error={errors.max_parallel_jobs}
        >
          <NumberInput
            min={1}
            error={Boolean(errors.max_parallel_jobs)}
            value={values.max_parallel_jobs}
            onChange={(value) =>
              setField("max_parallel_jobs", value === "" ? 0 : value)
            }
          />
        </Field>
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Generation</h3>
        <div className={`${classes.grid} ${classes.grid3}`}>
          <Field
            label="Max completion tokens"
            hint="Auto-set when you pick a model from the list."
            error={errors.max_completion_tokens}
          >
            <NumberInput
              min={1}
              error={Boolean(errors.max_completion_tokens)}
              value={values.max_completion_tokens}
              onChange={(value) =>
                setField("max_completion_tokens", value === "" ? 0 : value)
              }
            />
          </Field>
          <Field
            label="Context length"
            hint="Model context window size."
            error={errors.context_length}
          >
            <NumberInput
              min={1}
              error={Boolean(errors.context_length)}
              value={values.context_length}
              onChange={(value) =>
                setField("context_length", value === "" ? 0 : value)
              }
            />
          </Field>
          <Field
            label="Temperature"
            hint="Lower = more focused; higher = more creative."
            error={errors.temperature}
          >
            <NumberInput
              step={0.1}
              error={Boolean(errors.temperature)}
              value={values.temperature}
              onChange={(value) =>
                setField("temperature", value === "" ? 0 : value)
              }
            />
          </Field>
          <Field
            label="Top P"
            hint="Nucleus sampling threshold."
            error={errors.top_p}
          >
            <NumberInput
              step={0.05}
              min={0}
              max={1}
              error={Boolean(errors.top_p)}
              value={values.top_p}
              onChange={(value) => setField("top_p", value === "" ? 0 : value)}
            />
          </Field>
          <Field label="Top K" hint="0 disables this limit." error={errors.top_k}>
            <NumberInput
              min={0}
              error={Boolean(errors.top_k)}
              value={values.top_k}
              onChange={(value) => setField("top_k", value === "" ? 0 : value)}
            />
          </Field>
          <Field label="Frequency penalty" hint="Penalty for repeated tokens.">
            <NumberInput
              step={0.1}
              value={values.frequency_penalty}
              onChange={(value) =>
                setField("frequency_penalty", value === "" ? 0 : value)
              }
            />
          </Field>
          <Field label="Presence penalty" hint="Penalty for new tokens.">
            <NumberInput
              step={0.1}
              value={values.presence_penalty}
              onChange={(value) =>
                setField("presence_penalty", value === "" ? 0 : value)
              }
            />
          </Field>
        </div>
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Advanced</h3>
        <div className={`${classes.grid} ${classes.grid2}`}>
          <Field
            label="Assistant prefill"
            hint="Optional assistant-role text appended after the final user message."
          >
            <TextInput
              value={values.assistant_prefill}
              onChange={(event) =>
                setField("assistant_prefill", event.target.value)
              }
            />
          </Field>
          <Field
            label="Thinking tag"
            hint={
              <RuntimeText>
                {"Example: <thinking>{{thinking}}</thinking>"}
              </RuntimeText>
            }
          >
            <TextInput
              value={values.thinking_tag}
              onChange={(event) => setField("thinking_tag", event.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Custom parameters"
          hint='Raw JSON object merged into the provider request body. Example: { "reasoning_effort": "high" }'
          error={errors.custom_parameters as string | undefined}
        >
          <Textarea
            className={[
              classes.textarea,
              errors.custom_parameters ? classes.textareaError : "",
            ]
              .filter(Boolean)
              .join(" ")}
            value={customParamsText}
            onChange={(event) => handleCustomParamsChange(event.target.value)}
          />
        </Field>

        <div className={`${classes.grid} ${classes.grid3}`}>
          <Field
            label="Service tier"
            hint="OpenRouter routing tier. Empty omits service_tier."
          >
            <Select
              data={SERVICE_TIERS.map((value) => ({
                value: toSelectValue(value),
                label: labelForTier(value),
              }))}
              value={toSelectValue(values.service_tier)}
              onChange={(value) =>
                setField("service_tier", fromSelectValue(value))
              }
              placeholder="None"
            />
          </Field>
          <Field
            label="Reasoning effort"
            hint="OpenRouter reasoning effort level."
          >
            <Select
              data={REASONING_EFFORTS.map((value) => ({
                value: toSelectValue(value),
                label: value || "None",
              }))}
              value={toSelectValue(values.reasoning_effort)}
              onChange={(value) =>
                setField("reasoning_effort", fromSelectValue(value))
              }
              placeholder="None"
            />
          </Field>
          <Field label="Verbosity" hint="OpenRouter verbosity level.">
            <Select
              data={VERBOSITIES.map((value) => ({
                value: toSelectValue(value),
                label: value || "None",
              }))}
              value={toSelectValue(values.verbosity)}
              onChange={(value) =>
                setField("verbosity", fromSelectValue(value))
              }
              placeholder="None"
            />
          </Field>
        </div>

        <Switch
          variant="card"
          checked={values.prompt_caching}
          onChange={(checked) => setField("prompt_caching", checked)}
          label="Prompt caching"
          description="Sends cache_control for OpenRouter Claude models."
        />

        {modelsQuery.isError ? (
          <p className={classes.errorText}>
            Could not load OpenRouter models. Check the API key.
          </p>
        ) : null}
      </section>
    </form>
  );
}
