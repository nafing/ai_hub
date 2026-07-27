import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button, Modal, notifications } from "@/components/ui";
import { ConnectionForm } from "@/features/connections/ConnectionForm";
import {
  useConnection,
  useDeleteConnection,
  useUpdateConnection,
} from "@/features/connections/queries";
import classes from "./index.module.css";

const FORM_ID = "connection-edit-form";

export const Route = createFileRoute("/_app/connections/$connectionId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { connectionId } = Route.useParams();
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

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h2 className={classes.title}>{data.name || "Edit connection"}</h2>
          <p className={classes.subtitle}>
            Update OpenRouter connection settings.
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

      <ConnectionForm
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
