import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  GENERATOR_CATEGORIES,
  PRESET_CATEGORY_LABELS,
  type CreateGeneratorPresetInput,
  type GeneratorCategory,
} from "@ai-hub/shared";
import { Select, Switch, Tabs, Textarea, TextInput } from "@/components/ui";
import { usePresets } from "@/features/presets/queries";
import classes from "./GeneratorPresetForm.module.css";

export type GeneratorPresetFormValues = CreateGeneratorPresetInput;

type GeneratorPresetFormProps = {
  formId?: string;
  initialValues: GeneratorPresetFormValues;
  onSubmit: (values: GeneratorPresetFormValues) => Promise<void> | void;
};

type FieldErrors = Partial<Record<"name" | "prompt", string>>;

type PromptTab =
  | "main"
  | "create"
  | "import"
  | "regenerate"
  | "rebuild";

const PROMPT_TABS: Array<{
  value: PromptTab;
  label: string;
  field: keyof Pick<
    GeneratorPresetFormValues,
    | "prompt"
    | "prompt_create"
    | "prompt_import"
    | "prompt_regenerate"
    | "prompt_rebuild"
  >;
  hint: string;
}> = [
  {
    value: "main",
    label: "Główny Prompt",
    field: "prompt",
    hint: "Always injected as the Generator Prompt marker.",
  },
  {
    value: "create",
    label: "Prompt Create",
    field: "prompt_create",
    hint: "Appended when generation_mode is create.",
  },
  {
    value: "import",
    label: "Prompt Import",
    field: "prompt_import",
    hint: "Appended when generation_mode is import.",
  },
  {
    value: "regenerate",
    label: "Prompt Regenerate",
    field: "prompt_regenerate",
    hint: "Appended when generation_mode is regenerate.",
  },
  {
    value: "rebuild",
    label: "Prompt Rebuild",
    field: "prompt_rebuild",
    hint: "Appended when generation_mode is rebuild.",
  },
];

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

export function GeneratorPresetForm({
  formId = "generator-preset-form",
  initialValues,
  onSubmit,
}: GeneratorPresetFormProps) {
  const { data: presets } = usePresets();
  const [values, setValues] = useState<GeneratorPresetFormValues>({
    ...initialValues,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [promptTab, setPromptTab] = useState<PromptTab>("main");

  const categoryOptions = useMemo(
    () =>
      GENERATOR_CATEGORIES.map((value) => ({
        value,
        label: PRESET_CATEGORY_LABELS[value],
      })),
    [],
  );

  const linkedPresetOptions = useMemo(() => {
    const matching = (presets ?? []).filter(
      (preset) => preset.category === values.category,
    );
    return [
      { value: "", label: "Default for category" },
      ...matching.map((preset) => ({
        value: preset.id,
        label: `${preset.name}${preset.is_default ? " (default)" : ""}`,
      })),
    ];
  }, [presets, values.category]);

  function setField<K extends keyof GeneratorPresetFormValues>(
    key: K,
    value: GeneratorPresetFormValues[K],
  ) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "category" && value !== current.category) {
        next.preset_id = null;
      }
      return next;
    });
    if (key === "name" || key === "prompt") {
      setErrors((current) => {
        if (!current[key as "name" | "prompt"]) return current;
        const next = { ...current };
        delete next[key as "name" | "prompt"];
        return next;
      });
    }
  }

  function validate(): FieldErrors {
    const result: FieldErrors = {};
    if (!values.name.trim()) result.name = "Name is required";
    if (!values.prompt.trim()) result.prompt = "Główny Prompt is required";
    return result;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.prompt) setPromptTab("main");
      return;
    }

    await onSubmit({
      ...values,
      name: values.name.trim(),
      description: values.description.trim(),
      author: values.author.trim(),
      prompt: values.prompt,
      prompt_create: values.prompt_create,
      prompt_import: values.prompt_import,
      prompt_regenerate: values.prompt_regenerate,
      prompt_rebuild: values.prompt_rebuild,
      preset_id: values.preset_id?.trim() ? values.preset_id : null,
    });
  }

  return (
    <form id={formId} className={classes.form} onSubmit={handleSubmit}>
      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Basics</h3>
        <div className={`${classes.grid} ${classes.grid2}`}>
          <Field label="Name" error={errors.name}>
            <TextInput
              value={values.name}
              onChange={(event) => setField("name", event.currentTarget.value)}
              required
            />
          </Field>
          <Field label="Author">
            <TextInput
              value={values.author}
              onChange={(event) =>
                setField("author", event.currentTarget.value)
              }
            />
          </Field>
          <Field
            label="Category"
            hint="Must match the generator pipeline and linked Preset category."
          >
            <Select
              data={categoryOptions}
              value={values.category}
              onChange={(value) => {
                if (value) setField("category", value as GeneratorCategory);
              }}
            />
          </Field>
          <Field
            label="Linked Preset"
            hint="Structural template from Presets. Empty uses the category default."
          >
            <Select
              data={linkedPresetOptions}
              value={values.preset_id ?? ""}
              onChange={(value) =>
                setField("preset_id", value?.trim() ? value : null)
              }
              searchable
              clearable
            />
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            value={values.description}
            onChange={(event) =>
              setField("description", event.currentTarget.value)
            }
            rows={2}
          />
        </Field>
        <Field label="Default for category">
          <Switch
            checked={values.is_default}
            onChange={(checked) => setField("is_default", checked)}
            label={
              values.is_default
                ? "This is the default Generator Preset for its category"
                : "Set as default for this category"
            }
          />
        </Field>
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Prompts</h3>
        <p className={classes.sectionHint}>
          Główny Prompt is always injected. Mode prompts are appended when
          generation_mode matches.
        </p>
        <Tabs value={promptTab} onChange={(value) => setPromptTab(value as PromptTab)}>
          <Tabs.List>
            {PROMPT_TABS.map((tab) => (
              <Tabs.Tab key={tab.value} value={tab.value}>
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {PROMPT_TABS.map((tab) => (
            <Tabs.Panel key={tab.value} value={tab.value}>
              <Field
                label={tab.label}
                hint={tab.hint}
                error={tab.field === "prompt" ? errors.prompt : undefined}
              >
                <Textarea
                  className={classes.prompt}
                  value={values[tab.field]}
                  onChange={(event) =>
                    setField(tab.field, event.currentTarget.value)
                  }
                  rows={16}
                  required={tab.field === "prompt"}
                />
              </Field>
            </Tabs.Panel>
          ))}
        </Tabs>
      </section>
    </form>
  );
}
