import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { CreateConnectionInput } from "@ai-hub/shared";
import {
  Button,
  Textarea,
  Select,
  TextInput,
  Switch,
} from "@/components/ui";
import {
  useOpenRouterImageEndpoints,
  useOpenRouterImageModels,
} from "./queries";
import classes from "./ConnectionForm.module.css";

export type ImageConnectionFormValues = CreateConnectionInput;

type ImageConnectionFormProps = {
  formId?: string;
  initialValues: ImageConnectionFormValues;
  connectionId?: string;
  onSubmit: (values: ImageConnectionFormValues) => Promise<void> | void;
};

const NONE_VALUE = "__none__";

function toSelectValue(value: string) {
  return value || NONE_VALUE;
}

function fromSelectValue(value: string) {
  if (!value || value === NONE_VALUE) return "";
  return value;
}

type FieldErrors = Partial<Record<keyof ImageConnectionFormValues, string>>;

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

export function ImageConnectionForm({
  formId = "image-connection-form",
  initialValues,
  connectionId,
  onSubmit,
}: ImageConnectionFormProps) {
  const [values, setValues] = useState<ImageConnectionFormValues>(() => ({
    ...initialValues,
    kind: "image",
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

  const modelsQuery = useOpenRouterImageModels(auth, loadModels);
  const modelId = values.model.trim();

  const endpointsQuery = useOpenRouterImageEndpoints(
    modelId,
    auth,
    Boolean(modelId) && Boolean(auth.apiKey?.trim() || auth.connectionId),
  );

  const modelOptions = useMemo(() => {
    const fromApi =
      modelsQuery.data?.map((item) => ({
        value: item.id,
        label: item.name === item.id ? item.id : `${item.name} (${item.id})`,
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

  function setField<K extends keyof ImageConnectionFormValues>(
    key: K,
    value: ImageConnectionFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validate(next: ImageConnectionFormValues): FieldErrors {
    const result: FieldErrors = {};
    if (!next.name.trim()) result.name = "Name is required";
    if (!next.api_key.trim()) result.api_key = "API key is required";
    if (!next.model.trim()) result.model = "Model is required";
    return result;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { ...values, kind: "image" as const };
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
            hint="A friendly name like 'Seedream — avatars' or 'Flux portraits'."
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
          label="Default image connection"
          description="Used when an image feature needs a connection and none is selected."
        />

        <div className={`${classes.grid} ${classes.grid2}`}>
          <Field
            label="Model"
            hint="OpenRouter image model slug (author/model)."
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
                onChange={(value) => {
                  setField("model", value);
                  setField("preferred_provider", "");
                }}
                placeholder="Select image model"
              />
              {!loadModels ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!values.api_key.trim() && !connectionId}
                  onClick={() => setLoadModels(true)}
                >
                  Load models from OpenRouter
                </Button>
              ) : modelsQuery.isLoading ? (
                <span className={classes.fieldHint}>Loading models…</span>
              ) : null}
            </div>
          </Field>

          <Field
            label="Preferred provider"
            hint="Optional provider routing for this image model."
          >
            <Select
              searchable
              clearable
              data={providerOptions}
              value={toSelectValue(values.preferred_provider)}
              onChange={(value) =>
                setField("preferred_provider", fromSelectValue(value))
              }
              placeholder="Automatic"
              disabled={!modelId}
            />
          </Field>
        </div>
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Advanced</h3>
        <Field
          label="Custom parameters"
          hint='Optional JSON merged into POST /images (e.g. aspect_ratio, resolution).'
          error={errors.custom_parameters}
        >
          <Textarea
            className={classes.textarea}
            value={customParamsText}
            onChange={(event) => handleCustomParamsChange(event.target.value)}
            rows={8}
          />
        </Field>
      </section>
    </form>
  );
}
