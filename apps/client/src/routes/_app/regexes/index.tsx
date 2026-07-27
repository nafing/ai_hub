import { useState } from "react";
import { motion } from "motion/react";
import { IconCopy, IconPlus, IconTrash } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  REGEX_APPLY_TO_LABELS,
  REGEX_TARGET_LABELS,
  type RegexApplyTo,
  type RegexTarget,
} from "@ai-hub/shared";
import { ActionIcon, Button, Modal, notifications } from "@/components/ui";
import { CreateRegexModal } from "@/features/regexes/CreateRegexModal";
import {
  useDeleteRegex,
  useDuplicateRegex,
  useRegexes,
} from "@/features/regexes/queries";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/regexes/")({
  component: RouteComponent,
});

type DeleteTarget = {
  id: string;
  name: string;
};

function RouteComponent() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const { data, isLoading, isError } = useRegexes();
  const deleteMutation = useDeleteRegex();
  const duplicateMutation = useDuplicateRegex();

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Regex script removed.",
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
      onSuccess: (script) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${script.name}`,
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

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.headerRow}>
          <h2 className={classes.title}>Regexes</h2>
          <ActionIcon type="button" variant="default" aria-label="New regex" onClick={() => setCreateOpen(true)}
          >
            <IconPlus size={16} />
          </ActionIcon>
        </div>
        <p className={classes.subtitle}>
          Find/replace scripts for AI output and user input (display and/or
          prompt).
        </p>
      </header>

      {isLoading ? (
        <div className={classes.loading}>
          <div className={classes.spinner} aria-label="Loading" />
        </div>
      ) : null}

      {isError ? (
        <p className={classes.statusError}>Failed to load regexes.</p>
      ) : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <p className={classes.status}>
          No regex scripts yet. Create one to get started.
        </p>
      ) : null}

      <div className={classes.grid}>
        {data?.map((script) => (
          <motion.div
            key={script.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
          >
            <Link
              to="/regexes/$regexId"
              params={{ regexId: script.id }}
              className={classes.card}
            >
              <div className={classes.cardTop}>
                <div className={classes.cardText}>
                  <p className={classes.cardName}>
                    {script.name || "Untitled"}
                  </p>
                  <p className={classes.cardPattern}>
                    /{script.find_regex || "…"}/ →{" "}
                    {script.replace_with || "(empty)"}
                  </p>
                </div>
                <div className={classes.cardActions}>
                  <ActionIcon type="button" variant="ghost" aria-label="Duplicate" disabled={duplicateMutation.isPending} onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleDuplicate(script.id);
                    }}
                  >
                    <IconCopy size={15} />
                  </ActionIcon>
                  <ActionIcon type="button" variant="ghostDanger" aria-label="Delete" disabled={deleteMutation.isPending} onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDeleteTarget({
                        id: script.id,
                        name: script.name,
                      });
                    }}
                  >
                    <IconTrash size={15} />
                  </ActionIcon>
                </div>
              </div>

              <div className={classes.badges}>
                <span
                  className={[
                    classes.badge,
                    script.enabled ? classes.badgeOn : classes.badgeOff,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {script.enabled ? "On" : "Off"}
                </span>
                <span className={classes.badgeOutline}>#{script.order}</span>
                <span className={classes.badgeOutline}>
                  {REGEX_APPLY_TO_LABELS[script.apply_to as RegexApplyTo]}
                </span>
                {script.targets.map((target) => (
                  <span key={target} className={classes.badgeDot}>
                    {REGEX_TARGET_LABELS[target as RegexTarget]}
                  </span>
                ))}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <CreateRegexModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <Modal
        opened={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete regex"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{deleteTarget?.name || "this regex"}</strong>? This
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
