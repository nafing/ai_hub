import { useMemo, useState, type FormEvent, type ReactNode } from "react";
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
import {
  Textarea,
  Select,
  TagsInput,
  TextInput,
  NumberInput,
  Switch,
  Checkbox,
} from "@/components/ui";
import classes from "./RegexForm.module.css";

export type RegexFormValues = CreateRegexScriptInput;

type RegexFormProps = {
  formId?: string;
  initialValues: RegexFormValues;
  onSubmit: (values: RegexFormValues) => Promise<void> | void;
};

type FieldErrors = Partial<Record<keyof RegexFormValues, string>>;

const SAMPLE =
  "*She smiles* and says hello. ((OOC: ignore this)) She smiles again.";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
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

export function RegexForm({
  formId = "regex-form",
  initialValues,
  onSubmit,
}: RegexFormProps) {
  const [values, setValues] = useState<RegexFormValues>({
    ...initialValues,
    targets: [...initialValues.targets],
    character_ids: [...initialValues.character_ids],
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sample, setSample] = useState(SAMPLE);

  function setField<K extends keyof RegexFormValues>(
    key: K,
    value: RegexFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function toggleTarget(target: RegexTarget) {
    setValues((current) => {
      const has = current.targets.includes(target);
      const targets = has
        ? current.targets.filter((item) => item !== target)
        : [...current.targets, target];
      return { ...current, targets };
    });
    setErrors((current) => {
      if (!current.targets) return current;
      const next = { ...current };
      delete next.targets;
      return next;
    });
  }

  function validate(next: RegexFormValues): FieldErrors {
    const result: FieldErrors = {};

    if (!next.name.trim()) {
      result.name = "Name is required";
    }

    if (!next.find_regex.trim()) {
      result.find_regex = "Find pattern is required";
    } else if (isUnsafeRegexPattern(next.find_regex)) {
      result.find_regex =
        "Pattern looks unsafe (possible ReDoS) — simplify nested quantifiers";
    } else {
      try {
        // eslint-disable-next-line no-new
        new RegExp(next.find_regex, "g");
      } catch {
        result.find_regex = "Invalid regular expression";
      }
    }

    if (next.targets.length === 0) {
      result.targets = "Select at least one target";
    }

    if (!/^[gimsuy]*$/.test(next.flags)) {
      result.flags = "Flags may only include g, i, m, s, u, y";
    }

    return result;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSubmit({
      ...values,
      character_ids:
        values.scope === "character" ? values.character_ids : [],
      min_depth: values.min_depth ?? null,
      max_depth: values.max_depth ?? null,
    });
  }

  const preview = useMemo(() => {
    const script: RegexScript = {
      id: "preview",
      ...values,
      enabled: true,
    };
    return applyRegexScriptToText(sample, script);
  }, [values, sample]);

  function parseDepth(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
  }

  return (
    <form id={formId} className={classes.form} onSubmit={handleSubmit}>
      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Basics</h3>
        <div className={`${classes.grid} ${classes.grid2}`}>
          <Field
            label="Name"
            hint="The display name for this regex."
            error={errors.name}
          >
            <TextInput
              error={Boolean(errors.name)}
              value={values.name}
              onChange={(event) => setField("name", event.target.value)}
              required
            />
          </Field>
          <Field label="Order" hint="Lower runs first" error={errors.order}>
            <NumberInput
              step={1}
              value={values.order}
              onChange={(value) => setField("order", value === "" ? 0 : value)}
            />
          </Field>
        </div>

        <Switch
          variant="card"
          checked={values.enabled}
          onChange={(checked) => setField("enabled", checked)}
          label="Enabled"
          description="When off, the script is skipped."
        />
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Pattern</h3>
        <Field
          label="Find regex"
          hint="JS regex source without surrounding slashes. Example: \\*([^*]+)\\*"
          error={errors.find_regex}
        >
          <TextInput
            className={classes.mono}
            error={Boolean(errors.find_regex)}
            value={values.find_regex}
            onChange={(event) => setField("find_regex", event.target.value)}
            required
          />
        </Field>
        <Field
          label="Replace with"
          hint="Use $1, $2 for capture groups. Example: $1"
          error={errors.replace_with}
        >
          <TextInput
            className={classes.mono}
            value={values.replace_with}
            onChange={(event) => setField("replace_with", event.target.value)}
          />
        </Field>
        <Field
          label="Flags"
          hint="Recommended: g. Allowed: g i m s u y"
          error={errors.flags}
        >
          <TextInput
            className={classes.mono}
            error={Boolean(errors.flags)}
            value={values.flags}
            onChange={(event) => setField("flags", event.target.value)}
          />
        </Field>
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Where it applies</h3>

        <Field
          label="Targets"
          hint="Which message sources the script runs on"
          error={errors.targets}
        >
          <div className={classes.checkRow}>
            {REGEX_TARGETS.map((target) => (
              <Checkbox
                key={target}
                className={classes.check}
                checked={values.targets.includes(target)}
                onChange={() => toggleTarget(target as RegexTarget)}
                label={REGEX_TARGET_LABELS[target as RegexTarget]}
              />
            ))}
          </div>
        </Field>

        <Field
          label="Apply to"
          hint="Display = screen only · Prompt = model context only · Both = both"
        >
          <Select
            data={REGEX_APPLY_TO.map((value) => ({
              value,
              label: REGEX_APPLY_TO_LABELS[value as RegexApplyTo],
            }))}
            value={values.apply_to}
            onChange={(value) => {
              if (value) setField("apply_to", value as RegexApplyTo);
            }}
          />
        </Field>

        <div className={`${classes.grid} ${classes.grid2}`}>
          <Field
            label="Min depth"
            hint="0 = newest message. Empty = no min"
          >
            <NumberInput
              min={0}
              step={1}
              value={values.min_depth ?? ""}
              onChange={(value) =>
                setField("min_depth", parseDepth(value === "" ? "" : String(value)))
              }
            />
          </Field>
          <Field label="Max depth" hint="Empty = no max">
            <NumberInput
              min={0}
              step={1}
              value={values.max_depth ?? ""}
              onChange={(value) =>
                setField("max_depth", parseDepth(value === "" ? "" : String(value)))
              }
            />
          </Field>
        </div>

        <Field
          label="Scope"
          hint="Global runs everywhere; character-scoped only for listed IDs"
        >
          <Select
            data={REGEX_SCOPES.map((value) => ({
              value,
              label: REGEX_SCOPE_LABELS[value as RegexScope],
            }))}
            value={values.scope}
            onChange={(value) => {
              if (value) setField("scope", value as RegexScope);
            }}
          />
        </Field>

        {values.scope === "character" ? (
          <Field
            label="Character IDs"
            hint="Scripts run only when the chat character matches one of these IDs"
          >
            <TagsInput
              value={values.character_ids}
              onChange={(character_ids) =>
                setField("character_ids", character_ids)
              }
              placeholder="Paste character id and press Enter"
            />
          </Field>
        ) : null}
      </section>

      <section className={classes.section}>
        <h3 className={classes.sectionTitle}>Live preview</h3>
        <p className={classes.previewHint}>
          Tries the current pattern on sample text (same engine as chat
          display/prompt apply, including ReDoS + timeout guards).
        </p>
        <Field label="Sample input">
          <Textarea
            className={classes.textarea}
            value={sample}
            onChange={(event) => setSample(event.target.value)}
          />
        </Field>
        <div className={classes.previewOut}>
          <span className={classes.fieldLabel}>Output</span>
          {preview.skipped ? (
            <p className={classes.previewError}>Skipped: {preview.skipped}</p>
          ) : (
            <pre className={classes.code}>{preview.text || "(empty)"}</pre>
          )}
        </div>
      </section>
    </form>
  );
}
