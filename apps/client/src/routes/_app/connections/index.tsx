import { useState } from "react";
import { motion } from "motion/react";
import {
  IconCopy,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ActionIcon, Button, Modal, notifications } from "@/components/ui";
import { CreateConnectionModal } from "@/features/connections/CreateConnectionModal";
import {
  useConnections,
  useDeleteConnection,
  useDuplicateConnection,
  useUpdateConnection,
} from "@/features/connections/queries";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/connections/")({
  component: RouteComponent,
});

type DeleteTarget = {
  id: string;
  name: string;
};

function RouteComponent() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const { data, isLoading, isError } = useConnections();
  const deleteMutation = useDeleteConnection();
  const duplicateMutation = useDuplicateConnection();
  const updateMutation = useUpdateConnection();

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Connection removed.",
          color: "green",
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

  function handleDuplicate(id: string) {
    duplicateMutation.mutate(id, {
      onSuccess: (connection) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${connection.name}`,
          color: "green",
        });
      },
      onError: (error) => {
        notifications.show({
          title: "Duplicate failed",
          message: error instanceof Error ? error.message : "Unknown error",
          color: "red",
        });
      },
    });
  }

  function handleSetDefault(id: string) {
    updateMutation.mutate(
      { id, input: { is_default: true } },
      {
        onError: (error) => {
          notifications.show({
            title: "Set default failed",
            message: error instanceof Error ? error.message : "Unknown error",
            color: "red",
          });
        },
      },
    );
  }

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.headerRow}>
          <h2 className={classes.title}>Connections</h2>
          <ActionIcon type="button" variant="default" aria-label="New connection" onClick={() => setCreateOpen(true)}
          >
            <IconPlus size={16} />
          </ActionIcon>
        </div>
        <p className={classes.subtitle}>Manage your OpenRouter connections.</p>
      </header>

      {isLoading ? (
        <div className={classes.loading}>
          <div className={classes.spinner} aria-label="Loading" />
        </div>
      ) : null}

      {isError ? (
        <p className={classes.statusError}>Failed to load connections.</p>
      ) : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <p className={classes.status}>
          No connections yet. Create one to get started.
        </p>
      ) : null}

      <div className={classes.grid}>
        {data?.map((connection) => (
          <motion.div
            key={connection.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
          >
            <Link
              to="/connections/$connectionId"
              params={{ connectionId: connection.id }}
              className={classes.card}
            >
              <div className={classes.cardTop}>
                <p className={classes.cardName}>
                  {connection.name || "Untitled"}
                </p>
                <div className={classes.cardActions}>
                  <ActionIcon
                    type="button"
                    variant={connection.is_default ? "light" : "ghost"}
                    className={
                      connection.is_default ? classes.starActive : undefined
                    }
                    aria-label={
                      connection.is_default
                        ? "Default connection"
                        : "Set as default"
                    }
                    disabled={
                      connection.is_default ||
                      (updateMutation.isPending &&
                        updateMutation.variables?.id === connection.id)
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleSetDefault(connection.id);
                    }}
                  >
                    {connection.is_default ? (
                      <IconStarFilled size={15} />
                    ) : (
                      <IconStar size={15} />
                    )}
                  </ActionIcon>
                  <ActionIcon
                    type="button"
                    variant="ghost"
                    aria-label="Duplicate"
                    disabled={duplicateMutation.isPending}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleDuplicate(connection.id);
                    }}
                  >
                    <IconCopy size={15} />
                  </ActionIcon>
                  <ActionIcon
                    type="button"
                    variant="ghostDanger"
                    aria-label="Delete"
                    disabled={deleteMutation.isPending}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDeleteTarget({
                        id: connection.id,
                        name: connection.name,
                      });
                    }}
                  >
                    <IconTrash size={15} />
                  </ActionIcon>
                </div>
              </div>
              <p className={classes.cardMeta}>
                {connection.model || "No model"}
                {connection.preferred_provider
                  ? ` · ${connection.preferred_provider}`
                  : ""}
              </p>
            </Link>
          </motion.div>
        ))}
      </div>

      <CreateConnectionModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <Modal
        opened={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete connection"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete{" "}
          <strong>{deleteTarget?.name || "this connection"}</strong>? This
          cannot be undone.
        </p>
        <div className={classes.modalActions}>
          <Button variant="default" type="button"
            onClick={() => setDeleteTarget(null)}
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
