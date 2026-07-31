import { useEffect, useState, type ReactNode } from "react";
import type { Variable } from "@ai-hub/shared";
import {
  Button,
  Modal,
  MultiSelect,
  Select,
  TextInput,
  RuntimeText,
} from "@/components/ui";
import classes from "./SetupVariablesModal.module.css";

type SetupVariablesModalProps = {
  opened: boolean;
  onClose: () => void;
  variables: Variable[];
  onApply: (variables: Variable[]) => void;
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={classes.field}>
      <span className={classes.fieldLabel}>{label}</span>
      {hint ? <span className={classes.fieldHint}>{hint}</span> : null}
      {children}
    </div>
  );
}

export function SetupVariablesModal({
  opened,
  onClose,
  variables,
  onApply,
}: SetupVariablesModalProps) {
  const [draft, setDraft] = useState<Variable[]>(variables);

  useEffect(() => {
    if (opened) {
      setDraft(variables.map((variable) => ({ ...variable })));
    }
  }, [opened, variables]);

  const usable = draft.filter((variable) =>
    Boolean(variable?.variable_name?.trim()),
  );

  function setSelected(variableId: string, selected: string[]) {
    setDraft((current) =>
      current.map((variable) =>
        variable.id === variableId ? { ...variable, selected } : variable,
      ),
    );
  }

  function handleApply() {
    onApply(draft);
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Setup Variables" size="lg">
      <div className={classes.stack}>
        <p className={classes.muted}>
          Choose the active values injected into{" "}
          <RuntimeText text="{{variable}}" /> placeholders.
        </p>

        {usable.length === 0 ? (
          <p className={classes.muted}>
            No named variables on this preset yet.
          </p>
        ) : (
          usable.map((variable) => (
            <VariableSelectedField
              key={variable.id}
              variable={variable}
              onChange={(selected) => setSelected(variable.id, selected)}
            />
          ))
        )}

        <div className={classes.actions}>
          <Button variant="default" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={handleApply}
            disabled={usable.length === 0}
          >
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Map stored selected entries (id / value / part suffix) to option ids. */
function selectedOptionIds(variable: Variable): string[] {
  return (variable.selected ?? [])
    .map((entry) => {
      const match = variable.options.find(
        (option) =>
          option.id === entry ||
          option.value === entry ||
          option.id.endsWith(`:${entry}`),
      );
      return match?.id ?? entry;
    })
    .filter(Boolean);
}

function VariableSelectedField({
  variable,
  onChange,
}: {
  variable: Variable;
  onChange: (selected: string[]) => void;
}) {
  const label = variable.question || variable.variable_name;
  const description = (
    <RuntimeText text={`{{${variable.variable_name}}}`} />
  );
  const options = variable.options
    .map((option) => {
      if (!option.id) return null;
      return {
        value: option.id,
        label:
          option.label.trim() ||
          option.value.trim() ||
          option.id,
      };
    })
    .filter((option): option is { value: string; label: string } =>
      Boolean(option),
    );
  const selectedIds = selectedOptionIds(variable);

  if (variable.multi_select) {
    return (
      <Field label={label} hint={description}>
        <MultiSelect
          data={options}
          value={selectedIds}
          onChange={onChange}
          searchable
          clearable
        />
      </Field>
    );
  }

  if (options.length > 0) {
    return (
      <Field label={label} hint={description}>
        <Select
          data={options}
          value={selectedIds[0] ?? ""}
          onChange={(value) => onChange(value ? [value] : [])}
          searchable
          clearable
        />
      </Field>
    );
  }

  return (
    <Field label={label} hint={description}>
      <TextInput
        value={variable.selected?.[0] ?? ""}
        onChange={(event) => {
          const value = event.currentTarget.value;
          onChange(value ? [value] : []);
        }}
      />
    </Field>
  );
}
