import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button, Modal, notifications } from "@/components/ui";
import { ToolForm } from "@/features/tools/ToolForm";
import {
  useDeleteTool,
  useTool,
  useUpdateTool,
} from "@/features/tools/queries";
import classes from "./index.module.css";

const FORM_ID = "tool-edit-form";

export const Route = createFileRoute("/_app/tools/$toolId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { toolId } = Route.useParams();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data, isLoading, isError } = useTool(toolId);
  const updateMutation = useUpdateTool();
  const deleteMutation = useDeleteTool();

  function handleConfirmDelete() {
    setDeleteOpen(false);
    deleteMutation.mutate(toolId, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Tool removed.",
          color: "green",
        });
        void navigate({ to: "/tools" });
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
    return <p className={classes.error}>Tool not found.</p>;
  }

  const { id, is_built_in, ...formValues } = data;

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h2 className={classes.title}>{data.name || "Edit tool"}</h2>
          <p className={classes.subtitle}>
            {is_built_in
              ? "Built-in default tool — can be edited, but not deleted or renamed."
              : "Function definition for LLM tool calling (OpenAI / OpenRouter)."}
          </p>
        </div>
        <div className={classes.actions}>
          <Button variant="primary" type="submit"
            form={FORM_ID}
            disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving…" : "Save"}
          </Button>
          {!is_built_in ? (
            <Button variant="danger" type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          ) : null}
        </div>
      </header>

      <ToolForm
        key={id}
        formId={FORM_ID}
        initialValues={formValues}
        nameLocked={is_built_in}
        onSubmit={async (values) => {
          try {
            await updateMutation.mutateAsync({ id, input: values });
            notifications.show({
              title: "Saved",
              message: "Tool updated.",
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
        title="Delete tool"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{data.name || "this tool"}</strong>? This cannot be
          undone.
        </p>
        <div className={classes.modalActions}>
          <Button variant="default" type="button"
            onClick={() => setDeleteOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="dangerSolid" type="button"
            onClick={handleConfirmDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
