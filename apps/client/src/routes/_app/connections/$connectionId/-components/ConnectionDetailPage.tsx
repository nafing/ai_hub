import { useState } from "react";
import { useNavigate, getRouteApi } from "@tanstack/react-router";
import { Button, Modal, notifications } from "@/components/ui";
import { ConnectionForm } from "@/features/shared/connections/ConnectionForm";
import { ImageConnectionForm } from "@/features/shared/connections/ImageConnectionForm";
import { connectionKind } from "@ai-hub/shared";
import {
  useConnection,
  useDeleteConnection,
  useUpdateConnection,
} from "@/features/api-queries/connections/queries";
import classes from "@/features/shared/entityDetailPage.module.css";

const routeApi = getRouteApi("/_app/connections/$connectionId/");

const FORM_ID = "connection-edit-form";

export function ConnectionDetailPage() {
  const { connectionId } = routeApi.useParams();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data, isLoading, isError } = useConnection(connectionId);
  const updateMutation = useUpdateConnection();
  const deleteMutation = useDeleteConnection();

  function handleConfirmDelete() {
    setDeleteOpen(false);
    deleteMutation.mutate(connectionId, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Connection removed.",
          color: "green",
        });
        void navigate({ to: "/connections" });
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
    return <p className={classes.error}>Connection not found.</p>;
  }

  const { id, ...formValues } = data;
  const kind = connectionKind(data);

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h2 className={classes.title}>{data.name || "Edit connection"}</h2>
          <p className={classes.subtitle}>
            {kind === "image"
              ? "Update OpenRouter image generation settings."
              : "Update OpenRouter LLM connection settings."}
          </p>
        </div>
        <div className={classes.actions}>
          <Button variant="primary" type="submit"
            form={FORM_ID}
            disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button variant="danger" type="button"
            onClick={() => setDeleteOpen(true)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </header>

      {kind === "image" ? (
        <ImageConnectionForm
          key={id}
          formId={FORM_ID}
          connectionId={id}
          initialValues={formValues}
          onSubmit={async (values) => {
            try {
              await updateMutation.mutateAsync({ id, input: values });
              notifications.show({
                title: "Saved",
                message: "Connection updated.",
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
      ) : (
        <ConnectionForm
          key={id}
          formId={FORM_ID}
          connectionId={id}
          initialValues={formValues}
          onSubmit={async (values) => {
            try {
              await updateMutation.mutateAsync({
                id,
                input: { ...values, kind: "llm" },
              });
              notifications.show({
                title: "Saved",
                message: "Connection updated.",
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
      )}

      <Modal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete connection"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{data.name || "this connection"}</strong>? This cannot
          be undone.
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
