import { useState } from "react";
import { useNavigate, getRouteApi } from "@tanstack/react-router";
import { toCharacterBook } from "@ai-hub/shared";
import { Button, Modal, notifications } from "@/components/ui";
import { LorebookForm } from "@/features/shared/lorebooks/LorebookForm";
import {
  useDeleteLorebook,
  useLorebook,
  useUpdateLorebook,
} from "@/features/api-queries/lorebooks/queries";
import classes from "@/features/shared/entityDetailPage.module.css";

const routeApi = getRouteApi("/_app/lorebooks/$lorebookId/");

const FORM_ID = "lorebook-edit-form";

export function LorebookDetailPage() {
  const { lorebookId } = routeApi.useParams();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data, isLoading, isError } = useLorebook(lorebookId);
  const updateMutation = useUpdateLorebook();
  const deleteMutation = useDeleteLorebook();

  function handleConfirmDelete() {
    setDeleteOpen(false);
    deleteMutation.mutate(lorebookId, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Lorebook removed.",
          color: "green",
        });
        void navigate({ to: "/lorebooks" });
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

  function handleExport() {
    if (!data) return;
    const book = toCharacterBook(data);
    const blob = new Blob([JSON.stringify(book, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.name || "lorebook"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className={classes.loading}>
        <div className={classes.spinner} aria-label="Loading" />
      </div>
    );
  }

  if (isError || !data) {
    return <p className={classes.error}>Lorebook not found.</p>;
  }

  const { id, ...formValues } = data;

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h2 className={classes.title}>{data.name || "Edit lorebook"}</h2>
          <p className={classes.subtitle}>
            Overview, keyword entries, and extensions.
          </p>
        </div>
        <div className={classes.actions}>
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

      <LorebookForm
        key={id}
        formId={FORM_ID}
        initialValues={formValues}
        onSubmit={async (values) => {
          try {
            await updateMutation.mutateAsync({ id, input: values });
            notifications.show({
              title: "Saved",
              message: "Lorebook updated.",
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
        title="Delete lorebook"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{data.name || "this lorebook"}</strong>? This cannot
          be undone.
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
