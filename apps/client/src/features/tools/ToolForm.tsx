import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  formatToolParametersJson,
  isValidToolName,
  parseToolParametersJson,
  toLlmToolDefinition,
  type CreateToolInput,
} from "@ai-hub/shared";
import classes from "./ToolForm.module.css";
import { Textarea, TextInput } from "@/components/ui";

export type ToolFormValues = CreateToolInput;

type ToolFormProps = {
  formId?: string;
  initialValues: ToolFormValues;
  /** Default tools cannot be renamed. */
  nameLocked?: boolean;
  onSubmit: (values: ToolFormValues) => Promise<void> | void;
};

type FieldErrors = Partial<Record<"name" | "description" | "parameters", string>>;

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

export function ToolForm({
  formId = "tool-form",
  initialValues,
  nameLocked = false,
  onSubmit,
}: ToolFormProps) {
  const [values, setValues] = useState<ToolFormValues>({
    ...initialValues,
    parameters: initialValues.parameters,
  });
  const [parametersJson, setParametersJson] = useState(
    formatToolParametersJson(initialValues.parameters),
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  function setField<K extends keyof ToolFormValues>(
    key: K,
    value: ToolFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === "name" || key === "description") {
      setErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  function validate(): FieldErrors {
    const result: FieldErrors = {};
    const name = values.name.trim();

    if (!name) {
      result.name = "Name is required";
    } else if (!isValidToolName(name)) {
      result.name =
        "Must start with a letter; only letters, digits, underscores";
    }

    if (!values.description.trim()) {
      result.description = "Description is required";
    }

    const parsed = parseToolParametersJson(parametersJson);
    if (!parsed.ok) {
      result.parameters = parsed.error;
    }

    return result;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const parsed = parseToolParametersJson(parametersJson);
    if (!parsed.ok) return;

    await onSubmit({
      ...values,
      name: values.name.trim(),
      parameters: parsed.value,
    });
  }

  const llmPreview = useMemo(() => {
    const parsed = parseToolParametersJson(parametersJson);
    return toLlmToolDefinition({
      name: values.name.trim() || "tool_name",
      description: values.description,
      parameters: parsed.ok ? parsed.value : initialValues.parameters,
    });
  }, [parametersJson, values.name, values.description, initialValues.parameters]);

  return (
    <form id={formId} className={classes.form} onSubmit={handleSubmit}>
      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Basics</h3>
        <Field
          label="Name"
          hint={
            nameLocked
              ? "Default tool name is locked."
              : "Snake_case function name the model will call."
          }
          error={errors.name}
        >
          <TextInput
            className={[classes.mono, nameLocked ? classes.inputLocked : ""]
              .filter(Boolean)
              .join(" ")}
            error={Boolean(errors.name)}
            value={values.name}
            readOnly={nameLocked}
            onChange={(event) => setField("name", event.target.value)}
            required
          />
        </Field>
        <Field
          label="Description"
          hint="Tell the model when and how to use this tool."
          error={errors.description}
        >
          <Textarea
            className={[
              classes.textarea,
              errors.description ? classes.inputError : "",
            ]
              .filter(Boolean)
              .join(" ")}
            value={values.description}
            onChange={(event) => setField("description", event.target.value)}
            required
          />
        </Field>
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Parameters (JSON Schema)</h3>
        <p className={classes.sectionHint}>
          Must be a JSON Schema object with{" "}
          <code className={classes.inlineCode}>type: &quot;object&quot;</code>{" "}
          and a <code className={classes.inlineCode}>properties</code> map.
        </p>
        <Field label="parameters" error={errors.parameters}>
          <Textarea
            className={[
              classes.textarea,
              classes.mono,
              classes.schemaEditor,
              errors.parameters ? classes.inputError : "",
            ]
              .filter(Boolean)
              .join(" ")}
            value={parametersJson}
            onChange={(event) => {
              setParametersJson(event.target.value);
              setErrors((current) => {
                if (!current.parameters) return current;
                const next = { ...current };
                delete next.parameters;
                return next;
              });
            }}
            spellCheck={false}
          />
        </Field>
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>LLM payload preview</h3>
        <p className={classes.sectionHint}>
          What gets sent in OpenRouter/OpenAI{" "}
          <code className={classes.inlineCode}>tools[]</code>.
        </p>
        <pre className={classes.code}>
          {JSON.stringify(llmPreview, null, 2)}
        </pre>
      </section>
    </form>
  );
}
