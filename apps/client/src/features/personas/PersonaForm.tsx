import {
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { CreatePersonaInput } from "@ai-hub/shared";
import { Tabs, Textarea, TextInput, Switch, RuntimeText } from "@/components/ui";
import { PersonaGeneratePanel } from "./PersonaGeneratePanel";
import classes from "./PersonaForm.module.css";

export type PersonaFormValues = CreatePersonaInput;

type PersonaFormProps = {
  formId?: string;
  initialValues: PersonaFormValues;
  onSubmit: (values: PersonaFormValues) => Promise<void> | void;
  /** Avatar controls rendered in the Metadata tab. */
  avatarSection?: ReactNode;
  /** Linked lorebooks list rendered in the Lorebooks tab. */
  lorebooksSection?: ReactNode;
};

type FieldErrors = Partial<Record<"name", string>>;

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={classes.field}>
      <span className={classes.fieldLabel}>
        {label}
        {required ? " *" : ""}
      </span>
      {hint ? <p className={classes.fieldHint}>{hint}</p> : null}
      {children}
      {error ? <p className={classes.fieldError}>{error}</p> : null}
    </div>
  );
}

export function PersonaForm({
  formId = "persona-form",
  initialValues,
  onSubmit,
  avatarSection,
  lorebooksSection,
}: PersonaFormProps) {
  const [values, setValues] = useState<PersonaFormValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});

  function setField<K extends keyof PersonaFormValues>(
    key: K,
    value: PersonaFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === "name" && errors.name) {
      setErrors((current) => {
        const next = { ...current };
        delete next.name;
        return next;
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = values.name.trim();
    if (!name) {
      setErrors({ name: "Name is required" });
      return;
    }
    void onSubmit({ ...values, name });
  }

  return (
    <form id={formId} className={classes.form} onSubmit={handleSubmit}>
      <Tabs defaultValue="metadata">
        <Tabs.List>
          <Tabs.Tab value="metadata">Metadata</Tabs.Tab>
          <Tabs.Tab value="card">Card</Tabs.Tab>
          <Tabs.Tab value="lorebooks">Lorebooks</Tabs.Tab>
          <Tabs.Tab value="generate">Generate with AI</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="metadata">
          <div className={classes.stack}>
            {avatarSection}
            <Field
              label="Name"
              hint={
                <>
                  Replaces <RuntimeText>{"{{user}}"}</RuntimeText> in prompts.
                </>
              }
              required
              error={errors.name}
            >
              <TextInput
                error={Boolean(errors.name)}
                value={values.name}
                onChange={(event) => setField("name", event.target.value)}
              />
            </Field>
            <Switch
              variant="card"
              checked={values.is_default}
              onChange={(checked) => setField("is_default", checked)}
              label="Default persona"
              description="Used as the active player persona when starting chats. Only one can be default."
            />
            <Field
              label="Notes"
              hint="Private notes — not injected into prompts."
            >
              <Textarea
                className={classes.textarea}
                value={values.notes}
                onChange={(event) => setField("notes", event.target.value)}
              />
            </Field>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="card">
          <div className={classes.stack}>
            <Field
              label="Description"
              hint="Main persona definition / appearance / background."
            >
              <Textarea
                className={classes.textarea}
                value={values.description}
                onChange={(event) =>
                  setField("description", event.target.value)
                }
              />
            </Field>
            <Field
              label="Personality"
              hint="Trait block for the player persona."
            >
              <Textarea
                className={classes.textarea}
                value={values.personality}
                onChange={(event) =>
                  setField("personality", event.target.value)
                }
              />
            </Field>
            <Field
              label="About Me"
              hint="Public bio for conversation chats (About Me inject)."
            >
              <Textarea
                className={classes.textarea}
                value={values.about_me}
                onChange={(event) => setField("about_me", event.target.value)}
              />
            </Field>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="lorebooks">
          {lorebooksSection ?? (
            <p className={classes.muted}>No lorebooks panel available.</p>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="generate">
          <PersonaGeneratePanel
            personaName={values.name}
            description={values.description}
            personality={values.personality}
            onDescriptionChange={(value) => setField("description", value)}
            onPersonalityChange={(value) => setField("personality", value)}
          />
        </Tabs.Panel>
      </Tabs>
    </form>
  );
}
