import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { IconCopy, IconPlus, IconTrash } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type ToolListItem } from "@ai-hub/shared";
import { ActionIcon, Button, Modal, notifications } from "@/components/ui";
import { CreateToolModal } from "@/features/tools/CreateToolModal";
import {
  useDeleteTool,
  useDuplicateTool,
  useTools,
} from "@/features/tools/queries";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/tools/")({
  component: RouteComponent,
});

type DeleteTarget = {
  id: string;
  name: string;
};

function RouteComponent() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const { data, isLoading, isError } = useTools();
  const deleteMutation = useDeleteTool();
  const duplicateMutation = useDuplicateTool();

  const { custom, builtin } = useMemo(() => {
    const customTools: ToolListItem[] = [];
    const builtinTools: ToolListItem[] = [];
    for (const tool of data ?? []) {
      if (tool.is_built_in) builtinTools.push(tool);
      else customTools.push(tool);
    }
    return { custom: customTools, builtin: builtinTools };
  }, [data]);

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Tool removed.",
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
      onSuccess: (tool) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${tool.name}`,
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
          <h2 className={classes.title}>Tools</h2>
          <ActionIcon type="button" variant="default" aria-label="New tool" onClick={() => setCreateOpen(true)}
          >
            <IconPlus size={16} />
          </ActionIcon>
        </div>
        <p className={classes.subtitle}>
          LLM function tools for agents. Built-in tools are seeded automatically
          and cannot be deleted.
        </p>
      </header>

      {isLoading ? (
        <div className={classes.loading}>
          <div className={classes.spinner} aria-label="Loading" />
        </div>
      ) : null}

      {isError ? (
        <p className={classes.statusError}>Failed to load tools.</p>
      ) : null}

      {!isLoading && !isError ? (
        <>
          <section className={classes.group}>
            <div>
              <h3 className={classes.groupTitle}>Custom</h3>
              <p className={classes.groupHint}>
                Your own tools — create, edit, and delete freely.
              </p>
            </div>
            {custom.length === 0 ? (
              <p className={classes.status}>
                No custom tools yet. Create one with +.
              </p>
            ) : (
              <div className={classes.grid}>
                {custom.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onDuplicate={handleDuplicate}
                    onDelete={(id, name) => setDeleteTarget({ id, name })}
                    duplicatePending={duplicateMutation.isPending}
                    deletePending={deleteMutation.isPending}
                  />
                ))}
              </div>
            )}
          </section>

          <section className={classes.group}>
            <div>
              <h3 className={classes.groupTitle}>Built-in</h3>
              <p className={classes.groupHint}>
                Default tools shipped with the hub — editable, not deletable.
              </p>
            </div>
            {builtin.length === 0 ? (
              <p className={classes.status}>No built-in tools loaded.</p>
            ) : (
              <div className={classes.grid}>
                {builtin.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onDuplicate={handleDuplicate}
                    onDelete={(id, name) => setDeleteTarget({ id, name })}
                    duplicatePending={duplicateMutation.isPending}
                    deletePending={deleteMutation.isPending}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      <CreateToolModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <Modal
        opened={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete tool"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{deleteTarget?.name || "this tool"}</strong>? This
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

function ToolCard({
  tool,
  onDuplicate,
  onDelete,
  duplicatePending,
  deletePending,
}: {
  tool: ToolListItem;
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
        to="/tools/$toolId"
        params={{ toolId: tool.id }}
        className={classes.card}
      >
        <div className={classes.cardTop}>
          <div className={classes.cardText}>
            <p className={classes.cardName}>{tool.name || "untitled"}</p>
            <p className={classes.cardDescription}>
              {tool.description || "No description"}
            </p>
          </div>
          <div className={classes.cardActions}>
            <ActionIcon type="button" variant="ghost" aria-label="Duplicate" disabled={duplicatePending} onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDuplicate(tool.id);
              }}
            >
              <IconCopy size={15} />
            </ActionIcon>
            {!tool.is_built_in ? (
              <ActionIcon type="button" variant="ghostDanger" aria-label="Delete" disabled={deletePending} onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDelete(tool.id, tool.name);
                }}
              >
                <IconTrash size={15} />
              </ActionIcon>
            ) : null}
          </div>
        </div>
        <div className={classes.badges}>
          <span className={classes.badgeOutline}>
            {tool.parameter_count}{" "}
            {tool.parameter_count === 1 ? "param" : "params"}
          </span>
          {tool.is_built_in ? (
            <span className={classes.badgeBuiltin}>Built-in</span>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}
