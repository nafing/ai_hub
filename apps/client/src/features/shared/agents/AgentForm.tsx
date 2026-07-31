import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AGENT_CATEGORIES,
  AGENT_EXECUTIONS,
  AGENT_PHASES,
  isValidAgentSlug,
  type CreateAgentInput,
} from "@ai-hub/shared";
import {
  Textarea,
  MultiSelect,
  Select,
  TagsInput,
  TextInput,
  NumberInput,
  Switch,
} from "@/components/ui";
import { useTools } from "@/features/api-queries/tools/queries";
import classes from "./AgentForm.module.css";

export type AgentFormValues = CreateAgentInput;

type AgentFormProps = {
  formId?: string;
  initialValues: AgentFormValues;
  /** Built-in agents cannot change slug. */
  slugLocked?: boolean;
  onSubmit: (values: AgentFormValues) => Promise<void> | void;
};

type FieldErrors = Partial<
  Record<"name" | "slug" | "default_settings" | "prompt_templates", string>
>;

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

  const [values, setValues] = useState<AgentFormValues>({
    ...initialValues,
    default_tools: [...(initialValues.default_tools ?? [])],
    mode_allowlist: [...(initialValues.mode_allowlist ?? [])],
    prompt_templates: [...(initialValues.prompt_templates ?? [])],
    default_settings: { ...(initialValues.default_settings ?? {}) },
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [settingsJson, setSettingsJson] = useState(
    formatJson(initialValues.default_settings),
  );
  const [templatesJson, setTemplatesJson] = useState(
    JSON.stringify(initialValues.prompt_templates ?? [], null, 2),
  );

  function setField<K extends keyof AgentFormValues>(
    key: K,
    value: AgentFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === "name" || key === "slug") {
      setErrors((current) => {
        if (!current[key as "name" | "slug"]) return current;
        const next = { ...current };
        delete next[key as "name" | "slug"];
        return next;
      });
    }
  }

  function validate(): FieldErrors {
    const result: FieldErrors = {};
    const name = values.name.trim();
    const slug = values.slug.trim();

    if (!name) result.name = "Name is required";

    if (!slug) {
      result.slug = "Slug is required";
    } else if (!isValidAgentSlug(slug)) {
      result.slug =
        "Must start with a letter; only lowercase letters, digits, hyphens";
    }

    try {
      const parsed: unknown = JSON.parse(settingsJson || "{}");
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        result.default_settings = "Must be a JSON object";
      }
    } catch {
      result.default_settings = "Invalid JSON";
    }

    try {
      const parsed: unknown = JSON.parse(templatesJson || "[]");
      if (!Array.isArray(parsed)) {
        result.prompt_templates = "Must be a JSON array";
      }
    } catch {
      result.prompt_templates = "Invalid JSON";
    }

    return result;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const default_settings = JSON.parse(settingsJson || "{}") as Record<
      string,
      unknown
    >;
    const prompt_templates = JSON.parse(
      templatesJson || "[]",
    ) as AgentFormValues["prompt_templates"];

    await onSubmit({
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
  }

  return (
    <form id={formId} className={classes.form} onSubmit={handleSubmit}>
      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Basics</h3>
        <Field label="Name" error={errors.name}>
          <TextInput
            error={Boolean(errors.name)}
            value={values.name}
            onChange={(event) => setField("name", event.target.value)}
            required
          />
        </Field>
        <Field
          label="Slug"
          hint={
            slugLocked
              ? "Built-in agent slug is locked."
              : "Stable kebab-case id used by the hub."
          }
          error={errors.slug}
        >
          <TextInput
            className={[classes.mono, slugLocked ? classes.inputLocked : ""]
              .filter(Boolean)
              .join(" ")}
            error={Boolean(errors.slug)}
            value={values.slug}
            readOnly={slugLocked}
            onChange={(event) => setField("slug", event.target.value)}
            required
          />
        </Field>
        <Field label="Description">
          <Textarea
            className={classes.textarea}
            value={values.description}
            onChange={(event) => setField("description", event.target.value)}
          />
        </Field>
        <Field label="Author">
          <TextInput
            value={values.author}
            onChange={(event) => setField("author", event.target.value)}
          />
        </Field>

        <div className={`${classes.grid} ${classes.grid2}`}>
          <Field label="Phase">
            <Select
              data={AGENT_PHASES.map((value) => ({ value, label: value }))}
              value={values.phase}
              onChange={(value) => {
                if (value) setField("phase", value as AgentFormValues["phase"]);
              }}
            />
          </Field>
          <Field label="Category">
            <Select
              data={AGENT_CATEGORIES.map((value) => ({ value, label: value }))}
              value={values.category}
              onChange={(value) => {
                if (value)
                  setField("category", value as AgentFormValues["category"]);
              }}
            />
          </Field>
          <Field
            label="Execution"
            hint="feature = non-LLM runtime (e.g. Calls)."
          >
            <Select
              data={AGENT_EXECUTIONS.map((value) => ({ value, label: value }))}
              value={values.execution}
              onChange={(value) => {
                if (value)
                  setField("execution", value as AgentFormValues["execution"]);
              }}
            />
          </Field>
          <Field label="Result type">
            <Select
              clearable
              data={[{ value: "text_rewrite", label: "text_rewrite" }]}
              value={values.result_type ?? ""}
              onChange={(value) =>
                setField(
                  "result_type",
                  (value || null) as AgentFormValues["result_type"],
                )
              }
              placeholder="None"
            />
          </Field>
        </div>

        <Switch
          variant="card"
          checked={values.enabled_by_default}
          onChange={(checked) => setField("enabled_by_default", checked)}
          label="Enabled by default"
          description="Suggested on when first added to a chat."
        />

        <Switch
          variant="card"
          checked={values.default_inject_as_section}
          onChange={(checked) => setField("default_inject_as_section", checked)}
          label="Inject as section"
          description="Trackers can inject state into the prompt as a section."
        />

        <Switch
          variant="card"
          checked={values.runtime_disabled}
          onChange={(checked) => setField("runtime_disabled", checked)}
          label="Runtime disabled"
          description="Skip LLM pipeline (feature agents)."
        />

        <Field
          label="Run interval"
          hint="Optional — run every N messages (empty = every turn)."
        >
          <NumberInput
            min={1}
            step={1}
            value={values.run_interval ?? ""}
            onChange={(value) => setField("run_interval", value === "" ? null : value)}
          />
        </Field>
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Tools & modes</h3>
        <Field
          label="Default tools"
          hint="Tool names from the Tools catalog."
        >
          <MultiSelect
            searchable
            data={toolOptions}
            value={values.default_tools ?? []}
            onChange={(default_tools) => setField("default_tools", default_tools)}
            placeholder="Select tools…"
          />
        </Field>
        <Field
          label="Mode allowlist"
          hint="Empty = all modes. Examples: roleplay, conversation."
        >
          <TagsInput
            value={values.mode_allowlist ?? []}
            onChange={(mode_allowlist) =>
              setField("mode_allowlist", mode_allowlist)
            }
            placeholder="Add mode and press Enter"
          />
        </Field>
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Prompt</h3>
        <Field
          label="Default prompt template"
          hint="Main system/user prompt for the agent."
        >
          <Textarea
            className={`${classes.textarea} ${classes.mono} ${classes.promptEditor}`}
            value={values.default_prompt_template}
            onChange={(event) =>
              setField("default_prompt_template", event.target.value)
            }
            spellCheck={false}
          />
        </Field>
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Default settings (JSON)</h3>
        <p className={classes.sectionHint}>
          Free-form runtime knobs (e.g.{" "}
          <code className={classes.inlineCode}>contextSize</code>,{" "}
          <code className={classes.inlineCode}>directorMode</code>).
        </p>
        <Field label="settings" error={errors.default_settings}>
          <Textarea
            className={[
              classes.textarea,
              classes.mono,
              classes.jsonEditor,
              errors.default_settings ? classes.inputError : "",
            ]
              .filter(Boolean)
              .join(" ")}
            value={settingsJson}
            onChange={(event) => {
              setSettingsJson(event.target.value);
              setErrors((current) => {
                if (!current.default_settings) return current;
                const next = { ...current };
                delete next.default_settings;
                return next;
              });
            }}
            spellCheck={false}
          />
        </Field>
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Prompt templates (JSON)</h3>
        <p className={classes.sectionHint}>
          Optional alternate packs: array of{" "}
          <code className={classes.inlineCode}>
            {"{ id, name, description, prompt_template }"}
          </code>
          .
        </p>
        <Field label="templates" error={errors.prompt_templates}>
          <Textarea
            className={[
              classes.textarea,
              classes.mono,
              classes.jsonEditor,
              errors.prompt_templates ? classes.inputError : "",
            ]
              .filter(Boolean)
              .join(" ")}
            value={templatesJson}
            onChange={(event) => {
              setTemplatesJson(event.target.value);
              setErrors((current) => {
                if (!current.prompt_templates) return current;
                const next = { ...current };
                delete next.prompt_templates;
                return next;
              });
            }}
            spellCheck={false}
          />
        </Field>
      </section>
    </form>
  );
}
