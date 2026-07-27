import { useState } from "react";
import { motion } from "motion/react";
import {
  IconCopy,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LOREBOOK_CATEGORY_LABELS,
  type LorebookListItem,
} from "@ai-hub/shared";
import { ActionIcon, Button, Modal, notifications } from "@/components/ui";
import { CreateLorebookModal } from "@/features/lorebooks/CreateLorebookModal";
import { ImportLorebookModal } from "@/features/lorebooks/ImportLorebookModal";
import {
  useDeleteLorebook,
  useDuplicateLorebook,
  useLoreIndexStatus,
  useLorebooks,
  useReindexLorebooks,
} from "@/features/lorebooks/queries";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/lorebooks/")({
  component: RouteComponent,
});

type DeleteTarget = {
  id: string;
  name: string;
};

function RouteComponent() {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const { data, isLoading, isError } = useLorebooks();
  const indexStatus = useLoreIndexStatus();
  const deleteMutation = useDeleteLorebook();
  const duplicateMutation = useDuplicateLorebook();
  const reindexMutation = useReindexLorebooks();

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Lorebook removed.",
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
      onSuccess: (lorebook) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${lorebook.name}`,
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

  function handleReindex() {
    reindexMutation.mutate(undefined, {
      onSuccess: (result) => {
        notifications.show({
          title: "Reindexed",
          message: `${result.entries} entries across ${result.lorebooks} lorebooks.`,
          color: "green",
        });
      },
      onError: (error) => {
        notifications.show({
          title: "Reindex failed",
          message: error instanceof Error ? error.message : "Unknown error",
          color: "red",
        });
      },
    });
  }

  const status = indexStatus.data;
  const dirtyCount = status?.dirty_count ?? 0;

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.headerRow}>
          <h2 className={classes.title}>Lorebooks</h2>
          <div className={classes.headerActions}>
            <ActionIcon
              type="button"
              variant="default"
              aria-label="Reindex lore vectors"
              disabled={reindexMutation.isPending}
              onClick={handleReindex}
            >
              <IconRefresh size={16} />
            </ActionIcon>
            <ActionIcon
              type="button"
              variant="default"
              aria-label="Import lorebook"
              onClick={() => setImportOpen(true)}
            >
              <IconUpload size={16} />
            </ActionIcon>
            <ActionIcon
              type="button"
              variant="default"
              aria-label="New lorebook"
              onClick={() => setCreateOpen(true)}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </div>
        </div>
        <p className={classes.subtitle}>
          Lorebooks. Create, edit, duplicate, or import JSON.
        </p>
        {status ? (
          <p className={classes.indexStatus}>
            Vector index: {status.indexed_rows} rows
            {dirtyCount > 0
              ? ` · ${dirtyCount} pending reindex`
              : " · up to date"}
            {reindexMutation.isPending ? " · reindexing…" : null}
          </p>
        ) : null}
      </header>

      {isLoading ? (
        <div className={classes.loading}>
          <div className={classes.spinner} aria-label="Loading" />
        </div>
      ) : null}

      {isError ? (
        <p className={classes.statusError}>Failed to load lorebooks.</p>
      ) : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <p className={classes.status}>
          No lorebooks yet. Create one with + or import JSON.
        </p>
      ) : null}

      {!isLoading && !isError && (data?.length ?? 0) > 0 ? (
        <div className={classes.grid}>
          {(data ?? []).map((lorebook) => (
            <LorebookCard
              key={lorebook.id}
              lorebook={lorebook}
              onDuplicate={handleDuplicate}
              onDelete={(id, name) => setDeleteTarget({ id, name })}
              duplicatePending={duplicateMutation.isPending}
              deletePending={deleteMutation.isPending}
            />
          ))}
        </div>
      ) : null}

      <CreateLorebookModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <ImportLorebookModal
        opened={importOpen}
        onClose={() => setImportOpen(false)}
      />

      <Modal
        opened={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete lorebook"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{deleteTarget?.name || "this lorebook"}</strong>? This
          cannot be undone.
        </p>
        <div className={classes.modalActions}>
          <Button
            variant="default"
            type="button"
            onClick={() => setDeleteTarget(null)}
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

function LorebookCard({
  lorebook,
  onDuplicate,
  onDelete,
  duplicatePending,
  deletePending,
}: {
  lorebook: LorebookListItem;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  duplicatePending: boolean;
  deletePending: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
    >
      <Link
        to="/lorebooks/$lorebookId"
        params={{ lorebookId: lorebook.id }}
        className={classes.card}
      >
        <div className={classes.cardTop}>
          <div className={classes.cardText}>
            <p className={classes.cardName}>{lorebook.name || "untitled"}</p>
            <p className={classes.cardDescription}>
              {lorebook.description || "No description"}
            </p>
          </div>
          <div className={classes.cardActions}>
            <ActionIcon
              type="button"
              variant="ghost"
              aria-label="Duplicate"
              disabled={duplicatePending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDuplicate(lorebook.id);
              }}
            >
              <IconCopy size={15} />
            </ActionIcon>
            <ActionIcon
              type="button"
              variant="ghostDanger"
              aria-label="Delete"
              disabled={deletePending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDelete(lorebook.id, lorebook.name);
              }}
            >
              <IconTrash size={15} />
            </ActionIcon>
          </div>
        </div>
        <div className={classes.badges}>
          <span className={classes.badgeSoft}>
            {LOREBOOK_CATEGORY_LABELS[lorebook.category]}
          </span>
          <span className={classes.badgeSoft}>
            {lorebook.entry_count}{" "}
            {lorebook.entry_count === 1 ? "entry" : "entries"}
          </span>
          {lorebook.index_dirty ? (
            <span className={classes.badgeWarn}>index pending</span>
          ) : null}
          {!lorebook.enabled ? (
            <span className={classes.badgeMuted}>disabled</span>
          ) : null}
          {lorebook.global ? (
            <span className={classes.badgeOutline}>global</span>
          ) : null}
          {lorebook.linked_characters.length > 0 ? (
            <span className={classes.badgeOutline}>
              {lorebook.linked_characters.length}{" "}
              {lorebook.linked_characters.length === 1
                ? "character"
                : "characters"}
            </span>
          ) : null}
          {lorebook.linked_personas.length > 0 ? (
            <span className={classes.badgeOutline}>
              {lorebook.linked_personas.length}{" "}
              {lorebook.linked_personas.length === 1 ? "persona" : "personas"}
            </span>
          ) : null}
          {lorebook.recursive_scanning ? (
            <span className={classes.badgeOutline}>recursive</span>
          ) : null}
          {lorebook.token_budget != null ? (
            <span className={classes.badgeOutline}>
              {lorebook.token_budget} tok
            </span>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}
