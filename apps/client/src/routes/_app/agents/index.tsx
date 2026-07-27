import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { IconCopy, IconPlus, IconTrash } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type AgentListItem } from "@ai-hub/shared";
import { ActionIcon, Button, Modal, notifications } from "@/components/ui";
import { CreateAgentModal } from "@/features/agents/CreateAgentModal";
import {
  useAgents,
  useDeleteAgent,
  useDuplicateAgent,
} from "@/features/agents/queries";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/agents/")({
  component: RouteComponent,
});

type DeleteTarget = {
  id: string;
  name: string;
};

function RouteComponent() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const { data, isLoading, isError } = useAgents();
  const deleteMutation = useDeleteAgent();
  const duplicateMutation = useDuplicateAgent();

  const { custom, builtin } = useMemo(() => {
    const customAgents: AgentListItem[] = [];
    const builtinAgents: AgentListItem[] = [];
    for (const agent of data ?? []) {
      if (agent.is_built_in) builtinAgents.push(agent);
      else customAgents.push(agent);
    }
    return { custom: customAgents, builtin: builtinAgents };
  }, [data]);

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Agent removed.",
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
      onSuccess: (agent) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${agent.name}`,
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
          <h2 className={classes.title}>Agents</h2>
          <ActionIcon type="button" variant="default" aria-label="New agent" onClick={() => setCreateOpen(true)}
          >
            <IconPlus size={16} />
          </ActionIcon>
        </div>
        <p className={classes.subtitle}>
          Pipeline agents (pre/post/parallel). Built-ins are seeded from
          examples and cannot be deleted.
        </p>
      </header>

      {isLoading ? (
        <div className={classes.loading}>
          <div className={classes.spinner} aria-label="Loading" />
        </div>
      ) : null}

      {isError ? (
        <p className={classes.statusError}>Failed to load agents.</p>
      ) : null}

      {!isLoading && !isError ? (
        <>
          <section className={classes.group}>
            <div>
              <h3 className={classes.groupTitle}>Custom</h3>
              <p className={classes.groupHint}>
                Your own agents — create, edit, and delete freely.
              </p>
            </div>
            {custom.length === 0 ? (
              <p className={classes.status}>
                No custom agents yet. Create one with +.
              </p>
            ) : (
              <div className={classes.grid}>
                {custom.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
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
                Default agents shipped with the hub — editable, not deletable.
              </p>
            </div>
            {builtin.length === 0 ? (
              <p className={classes.status}>No built-in agents loaded.</p>
            ) : (
              <div className={classes.grid}>
                {builtin.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
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

      <CreateAgentModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <Modal
        opened={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete agent"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{deleteTarget?.name || "this agent"}</strong>? This
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

function AgentCard({
  agent,
  onDuplicate,
  onDelete,
  duplicatePending,
  deletePending,
}: {
  agent: AgentListItem;
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
        to="/agents/$agentId"
        params={{ agentId: agent.id }}
        className={classes.card}
      >
        <div className={classes.cardTop}>
          <div className={classes.cardText}>
            <p className={classes.cardName}>{agent.name || "untitled"}</p>
            <p className={classes.cardSlug}>{agent.slug}</p>
            <p className={classes.cardDescription}>
              {agent.description || "No description"}
            </p>
          </div>
          <div className={classes.cardActions}>
            <ActionIcon type="button" variant="ghost" aria-label="Duplicate" disabled={duplicatePending} onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDuplicate(agent.id);
              }}
            >
              <IconCopy size={15} />
            </ActionIcon>
            {!agent.is_built_in ? (
              <ActionIcon type="button" variant="ghostDanger" aria-label="Delete" disabled={deletePending} onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDelete(agent.id, agent.name);
                }}
              >
                <IconTrash size={15} />
              </ActionIcon>
            ) : null}
          </div>
        </div>
        <div className={classes.badges}>
          <span className={classes.badgeSoft}>{agent.phase}</span>
          <span className={classes.badgeOutline}>{agent.category}</span>
          {agent.execution === "feature" ? (
            <span className={classes.badgeWarn}>feature</span>
          ) : null}
          {agent.default_tools.length > 0 ? (
            <span className={classes.badgeOutline}>
              {agent.default_tools.length}{" "}
              {agent.default_tools.length === 1 ? "tool" : "tools"}
            </span>
          ) : null}
          {agent.is_built_in ? (
            <span className={classes.badgeBuiltin}>Built-in</span>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}
