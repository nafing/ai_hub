import { useEffect, useRef, useState } from "react";
import { useNavigate, getRouteApi } from "@tanstack/react-router";
import {
  selectedVariableValues,
  toPresetExport,
  type PresetVariableValues,
  type Variable,
} from "@ai-hub/shared";
import { Button, Modal, notifications } from "@/components/ui";
import {
  PresetForm,
  type PresetFormHandle,
} from "@/features/shared/presets/PresetForm";
import { PresetMacrosModal } from "@/features/modals/presets/PresetMacrosModal";
import { SetupVariablesModal } from "@/features/modals/presets/SetupVariablesModal";
import { persistPresetVariableSelection } from "@/features/shared/presets/persistPresetVariableSelection";
import {
  useDeletePreset,
  usePreset,
  useUpdatePreset,
  presetKeys,
} from "@/features/api-queries/presets/queries";
import { useQueryClient } from "@tanstack/react-query";
import classes from "@/features/shared/entityDetailPage.module.css";

const routeApi = getRouteApi("/_app/presets/$presetId/");

const FORM_ID = "preset-edit-form";

export function PresetDetailPage() {
  const { presetId } = routeApi.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = usePreset(presetId);
  const updateMutation = useUpdatePreset();
  const deleteMutation = useDeletePreset();
  const formRef = useRef<PresetFormHandle>(null);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [macrosOpen, setMacrosOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [modalVariables, setModalVariables] = useState<Variable[]>([]);
  const [variableValues, setVariableValues] = useState<PresetVariableValues>(
    {},
  );

  useEffect(() => {
    if (!data) return;
    setVariableValues(selectedVariableValues(data.variables));

    // Keep form `selected` in sync when Setup Variables is applied via
    // Run Test / generators (PresetCommandBridge), otherwise the open form
    // stays stale and Save would overwrite the DB with empty selections.
    const form = formRef.current;
    if (!form) return;
    const current = form.getValues();
    const selectedById = new Map(
      data.variables.map((variable) => [variable.id, variable.selected ?? []]),
    );
    let changed = false;
    const next = current.variables.map((variable) => {
      if (!selectedById.has(variable.id)) return variable;
      const selected = selectedById.get(variable.id)!;
      const prev = variable.selected ?? [];
      if (
        selected.length === prev.length &&
        selected.every((entry, index) => entry === prev[index])
      ) {
        return variable;
      }
      changed = true;
      return { ...variable, selected: [...selected] };
    });
    if (changed) form.setVariables(next);
  }, [data]);

  function handleOpenVariables() {
    const values = formRef.current?.getValues();
    setModalVariables(values?.variables ?? data?.variables ?? []);
    setVariablesOpen(true);
  }

  function handleOpenMacros() {
    const values = formRef.current?.getValues();
    setModalVariables(values?.variables ?? data?.variables ?? []);
    setMacrosOpen(true);
  }

  async function handleApplyVariables(variables: Variable[]) {
    formRef.current?.setVariables(variables);
    setVariableValues(selectedVariableValues(variables));
    setVariablesOpen(false);
    try {
      const saved = await persistPresetVariableSelection(presetId, variables);
      queryClient.setQueryData(presetKeys.detail(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: presetKeys.all });
      notifications.show({
        title: "Variables saved",
        message: "Selected values are stored on this preset.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Save failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  function handleExport() {
    if (!data) return;
    const payload = toPresetExport(data);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.name || "preset"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleConfirmDelete() {
    setDeleteOpen(false);
    deleteMutation.mutate(presetId, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Preset removed.",
          color: "green",
        });
        void navigate({ to: "/presets" });
      },
      onError: (error) => {
        notifications.show({
          title: "Delete failed",
          message: error instanceof Error ? error.message : "Unknown error",
          color: "red",
        });
      },
    });
  }

  if (isLoading) {
    return (
      <div className={classes.loading}>
        <div className={classes.spinner} aria-label="Loading" />
      </div>
    );
  }

  if (isError || !data) {
    return <p className={classes.error}>Preset not found.</p>;
  }

  const { id, ...formValues } = data;

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h2 className={classes.title}>{data.name || "Edit preset"}</h2>
          <p className={classes.subtitle}>Update prompt preset settings.</p>
        </div>
        <div className={classes.actions}>
          <Button variant="default" type="button" onClick={handleOpenMacros}>
            Macros
          </Button>
          <Button
            variant="default"
            type="button"
            onClick={handleOpenVariables}
          >
            Setup Variables
          </Button>
          <Button variant="default" type="button" onClick={handleExport}>
            Export
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={FORM_ID}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="danger"
            type="button"
            onClick={() => setDeleteOpen(true)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </header>

      <PresetForm
        key={id}
        ref={formRef}
        formId={FORM_ID}
        presetId={id}
        initialValues={formValues}
        variableValues={variableValues}
        onSubmit={async (values) => {
          try {
            await updateMutation.mutateAsync({ id, input: values });
            setVariableValues(selectedVariableValues(values.variables));
            notifications.show({
              title: "Saved",
              message: "Preset updated.",
              color: "green",
            });
          } catch (error) {
            notifications.show({
              title: "Save failed",
              message: error instanceof Error ? error.message : "Unknown error",
              color: "red",
            });
          }
        }}
      />

      <SetupVariablesModal
        opened={variablesOpen}
        onClose={() => setVariablesOpen(false)}
        variables={modalVariables}
        onApply={handleApplyVariables}
      />

      <PresetMacrosModal
        opened={macrosOpen}
        onClose={() => setMacrosOpen(false)}
        variables={modalVariables}
      />

      <Modal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete preset"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{data.name || "this preset"}</strong>? This cannot be
          undone.
        </p>
        <div className={classes.modalActions}>
          <Button variant="default" type="button"
            onClick={() => setDeleteOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="danger" type="button"
            onClick={handleConfirmDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
