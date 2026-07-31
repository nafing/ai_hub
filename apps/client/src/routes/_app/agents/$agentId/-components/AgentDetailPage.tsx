import { useState } from "react";
import { useNavigate, getRouteApi } from "@tanstack/react-router";
import { Button, Modal, notifications } from "@/components/ui";
import { AgentForm } from "@/features/shared/agents/AgentForm";
import {
  useAgent,
  useDeleteAgent,
  useUpdateAgent,
} from "@/features/api-queries/agents/queries";
import classes from "@/features/shared/entityDetailPage.module.css";

const routeApi = getRouteApi("/_app/agents/$agentId/");

const FORM_ID = "agent-edit-form";

export function AgentDetailPage() {
  const { agentId } = routeApi.useParams();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data, isLoading, isError } = useAgent(agentId);
  const updateMutation = useUpdateAgent();
  const deleteMutation = useDeleteAgent();

  function handleConfirmDelete() {
    setDeleteOpen(false);
    deleteMutation.mutate(agentId, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Agent removed.",
          color: "green",
        });
        void navigate({ to: "/agents" });
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
    return <p className={classes.error}>Agent not found.</p>;
  }

  const { id, is_built_in, ...formValues } = data;

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h2 className={classes.title}>{data.name || "Edit agent"}</h2>
          <p className={classes.subtitle}>
            {is_built_in
              ? "Built-in default agent — can be edited, but not deleted or re-slugged."
              : "Prompt, tools, and pipeline settings for this agent."}
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

      <AgentForm
        key={id}
        formId={FORM_ID}
        initialValues={formValues}
        slugLocked={is_built_in}
        onSubmit={async (values) => {
          try {
            await updateMutation.mutateAsync({ id, input: values });
            notifications.show({
              title: "Saved",
              message: "Agent updated.",
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
        title="Delete agent"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{data.name || "this agent"}</strong>? This cannot be
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
