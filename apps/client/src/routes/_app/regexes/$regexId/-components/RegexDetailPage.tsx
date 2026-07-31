import { useState } from "react";
import { useNavigate, getRouteApi } from "@tanstack/react-router";
import { Button, Modal, notifications } from "@/components/ui";
import { RegexForm } from "@/features/shared/regexes/RegexForm";
import {
  useDeleteRegex,
  useRegex,
  useUpdateRegex,
} from "@/features/api-queries/regexes/queries";
import classes from "@/features/shared/entityDetailPage.module.css";

const routeApi = getRouteApi("/_app/regexes/$regexId/");

const FORM_ID = "regex-edit-form";

export function RegexDetailPage() {
  const { regexId } = routeApi.useParams();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data, isLoading, isError } = useRegex(regexId);
  const updateMutation = useUpdateRegex();
  const deleteMutation = useDeleteRegex();

  function handleConfirmDelete() {
    setDeleteOpen(false);
    deleteMutation.mutate(regexId, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Regex script removed.",
          color: "green",
        });
        void navigate({ to: "/regexes" });
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
    return <p className={classes.error}>Regex script not found.</p>;
  }

  const { id, ...formValues } = data;

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h2 className={classes.title}>{data.name || "Edit regex"}</h2>
          <p className={classes.subtitle}>
            Pattern runs when messages pass through chat (display and/or
            prompt).
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

      <RegexForm
        key={id}
        formId={FORM_ID}
        initialValues={formValues}
        onSubmit={async (values) => {
          try {
            await updateMutation.mutateAsync({ id, input: values });
            notifications.show({
              title: "Saved",
              message: "Regex script updated.",
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
        title="Delete regex"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{data.name || "this regex"}</strong>? This cannot be
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
