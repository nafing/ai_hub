import { useState } from "react";
import { useNavigate, getRouteApi } from "@tanstack/react-router";
import { Button, Modal, notifications } from "@/components/ui";
import { GeneratorPresetForm } from "@/features/shared/generator-presets/GeneratorPresetForm";
import {
  useDeleteGeneratorPreset,
  useGeneratorPreset,
  useUpdateGeneratorPreset,
} from "@/features/api-queries/generator-presets/queries";
import classes from "@/features/shared/entityDetailPage.module.css";

const routeApi = getRouteApi("/_app/presets/generator/$generatorPresetId/");

const FORM_ID = "generator-preset-edit-form";

export function GeneratorPresetDetailPage() {
  const { generatorPresetId } = routeApi.useParams();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data, isLoading, isError } = useGeneratorPreset(generatorPresetId);
  const updateMutation = useUpdateGeneratorPreset();
  const deleteMutation = useDeleteGeneratorPreset();

  function handleConfirmDelete() {
    setDeleteOpen(false);
    deleteMutation.mutate(generatorPresetId, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Generator preset removed.",
          color: "green",
        });
        void navigate({
          to: "/presets",
          search: data?.category ? { category: data.category } : {},
        });
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
    return <p className={classes.error}>Generator preset not found.</p>;
  }

  const { id, ...formValues } = data;

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h2 className={classes.title}>
            {data.name || "Edit generator preset"}
          </h2>
          <p className={classes.subtitle}>
            Main prompt injected into the linked Preset via the Generator Prompt
            marker.
          </p>
        </div>
        <div className={classes.actions}>
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

      <GeneratorPresetForm
        key={id}
        formId={FORM_ID}
        initialValues={formValues}
        onSubmit={async (values) => {
          try {
            await updateMutation.mutateAsync({ id, input: values });
            notifications.show({
              title: "Saved",
              message: "Generator preset updated.",
              color: "green",
            });
          } catch (error) {
            notifications.show({
              title: "Save failed",
              message:
                error instanceof Error ? error.message : "Unknown error",
              color: "red",
            });
          }
        }}
      />

      <Modal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete generator preset"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{data.name || "this generator preset"}</strong>? This
          cannot be undone.
        </p>
        <div className={classes.modalActions}>
          <Button
            variant="default"
            type="button"
            onClick={() => setDeleteOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="dangerSolid"
            type="button"
            onClick={handleConfirmDelete}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
