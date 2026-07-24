import { useEffect, useState } from "react";
import {
  Button,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import type { Variable } from "@ai-hub/shared";

type SetupVariablesModalProps = {
  opened: boolean;
  onClose: () => void;
  variables: Variable[];
  onApply: (variables: Variable[]) => void;
};

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

  const usable = draft.filter((variable) => variable.variable_name.trim());

  function setSelected(variableId: string, selected: string[]) {
    setDraft((current) =>
      current.map((variable) =>
        variable.id === variableId ? { ...variable, selected } : variable,
      ),
    );
  }

  function handleApply() {
    onApply(draft);
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Setup Variables"
      centered
      size="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Choose the active values injected into {"{{variable}}"} placeholders.
          Apply updates the form — save the preset to persist them.
        </Text>

        {usable.length === 0 ? (
          <Text size="sm" c="dimmed">
            No named variables yet. Add variables in the Sections tab first.
          </Text>
        ) : (
          usable.map((variable) => (
            <VariableSelectedField
              key={variable.id}
              variable={variable}
              onChange={(selected) => setSelected(variable.id, selected)}
            />
          ))
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={usable.length === 0}>
            Apply
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function VariableSelectedField({
  variable,
  onChange,
}: {
  variable: Variable;
  onChange: (selected: string[]) => void;
}) {
  const label = variable.question || variable.variable_name;
  const description = `{{${variable.variable_name}}}`;
  const options = variable.options
    .map((option) => {
      const value = option.value.trim() || option.label.trim();
      if (!value) return null;
      return {
        value,
        label: option.label.trim() || option.value.trim() || value,
      };
    })
    .filter((option): option is { value: string; label: string } =>
      Boolean(option),
    );
  if (variable.multi_select) {
    return (
      <MultiSelect
        label={label}
        description={description}
        data={options}
        value={variable.selected ?? []}
        onChange={onChange}
        searchable
        clearable
      />
    );
  }

  if (options.length > 0) {
    return (
      <Select
        label={label}
        description={description}
        data={options}
        value={variable.selected?.[0] ?? null}
        onChange={(value) => onChange(value ? [value] : [])}
        searchable
        clearable
      />
    );
  }

  return (
    <TextInput
      label={label}
      description={description}
      value={variable.selected?.[0] ?? ""}
      onChange={(event) => {
        const value = event.currentTarget.value;
        onChange(value ? [value] : []);
      }}
    />
  );
}
