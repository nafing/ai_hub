import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { IconCopy, IconPlus, IconTrash } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AGENT_CATEGORIES,
  AGENT_PHASES,
  type AgentCategory,
  type AgentListItem,
  type AgentPhase,
} from "@ai-hub/shared";
import {
  ActionIcon,
  Button,
  Modal,
  MultiSelect,
  notifications,
  Switch,
  TextInput,
} from "@/components/ui";
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

type AgentSource = "custom" | "builtin";

const SOURCE_OPTIONS: { value: AgentSource; label: string }[] = [
  { value: "custom", label: "Custom" },
  { value: "builtin", label: "Built-in" },
];

function RouteComponent() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [query, setQuery] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<AgentPhase[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<AgentCategory[]>([]);
  const [sourceFilter, setSourceFilter] = useState<AgentSource[]>([]);
  const [builtinOnly, setBuiltinOnly] = useState(false);

  const { data, isLoading, isError } = useAgents();
  const deleteMutation = useDeleteAgent();
  const duplicateMutation = useDuplicateAgent();

  const phaseOptions = useMemo(
    () =>
      AGENT_PHASES.map((phase) => ({
        value: phase,
        label: phase,
      })),
    [],
  );

  const categoryOptions = useMemo(
    () =>
      AGENT_CATEGORIES.map((category) => ({
        value: category,
        label: category,
      })),
    [],
  );

  const hasActiveFilters =
    query.trim().length > 0 ||
    phaseFilter.length > 0 ||
    categoryFilter.length > 0 ||
    sourceFilter.length > 0 ||
    builtinOnly;

  const filteredAgents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data ?? []).filter((agent) => {
      if (builtinOnly && !agent.is_built_in) return false;
      if (sourceFilter.length > 0) {
        const source: AgentSource = agent.is_built_in ? "builtin" : "custom";
        if (!sourceFilter.includes(source)) return false;
      }
      if (phaseFilter.length > 0 && !phaseFilter.includes(agent.phase)) {
        return false;
      }
      if (
        categoryFilter.length > 0 &&
        !categoryFilter.includes(agent.category)
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        agent.name.toLowerCase().includes(normalizedQuery) ||
        agent.slug.toLowerCase().includes(normalizedQuery) ||
        agent.description.toLowerCase().includes(normalizedQuery) ||
        agent.author.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [
    builtinOnly,
    categoryFilter,
    data,
    phaseFilter,
    query,
    sourceFilter,
  ]);

  const grouped = useMemo(() => {
    const byPhase = new Map<AgentPhase, AgentListItem[]>();
    for (const phase of AGENT_PHASES) {
      byPhase.set(phase, []);
    }
    for (const agent of filteredAgents) {
      const list = byPhase.get(agent.phase) ?? [];
      list.push(agent);
      byPhase.set(agent.phase, list);
    }
    return AGENT_PHASES.map((phase) => ({
      phase,
      agents: byPhase.get(phase) ?? [],
    })).filter((group) => group.agents.length > 0);
  }, [filteredAgents]);

  function clearFilters() {
    setQuery("");
    setPhaseFilter([]);
    setCategoryFilter([]);
    setSourceFilter([]);
    setBuiltinOnly(false);
  }

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
          <ActionIcon
            type="button"
            variant="default"
            aria-label="New agent"
            onClick={() => setCreateOpen(true)}
          >
            <IconPlus size={16} />
          </ActionIcon>
        </div>
        <p className={classes.subtitle}>
          Pipeline agents (pre/post/parallel). Built-ins are seeded from
          examples and cannot be deleted.
          {!isLoading && !isError && hasActiveFilters
            ? ` Showing ${filteredAgents.length} of ${data?.length ?? 0}.`
            : null}
        </p>
      </header>

      {!isLoading && !isError && (data?.length ?? 0) > 0 ? (
        <div className={classes.filters}>
          <TextInput
            className={classes.searchInput}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search name, slug, description…"
            aria-label="Search agents"
          />
          <MultiSelect
            className={classes.categoryFilter}
            searchable
            clearable
            data={phaseOptions}
            value={phaseFilter}
            onChange={(value) => setPhaseFilter(value as AgentPhase[])}
            placeholder="All phases"
            searchPlaceholder="Filter phases…"
          />
          <MultiSelect
            className={classes.categoryFilter}
            searchable
            clearable
            data={categoryOptions}
            value={categoryFilter}
            onChange={(value) => setCategoryFilter(value as AgentCategory[])}
            placeholder="All categories"
            searchPlaceholder="Filter categories…"
          />
          <MultiSelect
            className={classes.categoryFilter}
            searchable
            clearable
            data={SOURCE_OPTIONS}
            value={sourceFilter}
            onChange={(value) => setSourceFilter(value as AgentSource[])}
            placeholder="All sources"
            searchPlaceholder="Filter sources…"
          />
          <Switch
            className={classes.defaultsSwitch}
            checked={builtinOnly}
            onChange={setBuiltinOnly}
            label="Built-in only"
          />
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="default"
              className={classes.clearFilters}
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <div className={classes.loading}>
          <div className={classes.spinner} aria-label="Loading" />
        </div>
      ) : null}

      {isError ? (
        <p className={classes.statusError}>Failed to load agents.</p>
      ) : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <p className={classes.status}>
          No agents yet. Create one to get started.
        </p>
      ) : null}

      {!isLoading &&
      !isError &&
      (data?.length ?? 0) > 0 &&
      grouped.length === 0 ? (
        <p className={classes.status}>
          No agents match your filters.{" "}
          {hasActiveFilters ? (
            <button
              type="button"
              className={classes.clearFiltersLink}
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </p>
      ) : null}

      {grouped.map(({ phase, agents }) => (
        <section key={phase} className={classes.group}>
          <h3 className={classes.groupTitle}>{phase}</h3>
          <div className={classes.grid}>
            {agents.map((agent) => (
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
        </section>
      ))}

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
          <Button
            variant="default"
            type="button"
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </Button>
          <Button variant="dangerSolid" type="button" onClick={handleConfirmDelete}>
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
      className={classes.cardWrap}
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
            <ActionIcon
              type="button"
              variant="ghost"
              aria-label="Duplicate"
              disabled={duplicatePending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDuplicate(agent.id);
              }}
            >
              <IconCopy size={15} />
            </ActionIcon>
            {!agent.is_built_in ? (
              <ActionIcon
                type="button"
                variant="ghostDanger"
                aria-label="Delete"
                disabled={deletePending}
                onClick={(event) => {
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
