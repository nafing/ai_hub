import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { IconCopy, IconPlus, IconTrash } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { type ToolListItem } from "@ai-hub/shared";
import {
  ActionIcon,
  Button,
  Modal,
  MultiSelect,
  notifications,
  TextInput,
} from "@/components/ui";
import { CreateToolModal } from "@/features/modals/tools/CreateToolModal";
import {
  useDeleteTool,
  useDuplicateTool,
  useTools,
} from "@/features/api-queries/tools/queries";
import classes from "./ToolsPage.module.css";

type DeleteTarget = {
  id: string;
  name: string;
};

type ToolSource = "custom" | "builtin";

const SOURCE_OPTIONS: { value: ToolSource; label: string }[] = [
  { value: "custom", label: "Custom" },
  { value: "builtin", label: "Built-in" },
];

export function ToolsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<ToolSource[]>([]);

  const { data, isLoading, isError } = useTools();
  const deleteMutation = useDeleteTool();
  const duplicateMutation = useDuplicateTool();

  const hasActiveFilters = query.trim().length > 0 || sourceFilter.length > 0;

  const filteredTools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data ?? []).filter((tool) => {
      if (sourceFilter.length > 0) {
        const source: ToolSource = tool.is_built_in ? "builtin" : "custom";
        if (!sourceFilter.includes(source)) return false;
      }
      if (!normalizedQuery) return true;
      return (
        tool.name.toLowerCase().includes(normalizedQuery) ||
        tool.description.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [data, query, sourceFilter]);

  const { custom, builtin } = useMemo(() => {
    const customTools: ToolListItem[] = [];
    const builtinTools: ToolListItem[] = [];
    for (const tool of filteredTools) {
      if (tool.is_built_in) builtinTools.push(tool);
      else customTools.push(tool);
    }
    return { custom: customTools, builtin: builtinTools };
  }, [filteredTools]);

  const grouped = useMemo(
    () =>
      [
        { key: "custom" as const, title: "Custom", tools: custom },
        { key: "builtin" as const, title: "Built-in", tools: builtin },
      ].filter((group) => group.tools.length > 0),
    [builtin, custom],
  );

  function clearFilters() {
    setQuery("");
    setSourceFilter([]);
  }

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
          <ActionIcon
            type="button"
            variant="default"
            aria-label="New tool"
            onClick={() => setCreateOpen(true)}
          >
            <IconPlus size={16} />
          </ActionIcon>
        </div>
        <p className={classes.subtitle}>
          LLM function tools for agents. Built-in tools are seeded automatically
          and cannot be deleted.
          {!isLoading && !isError && hasActiveFilters
            ? ` Showing ${filteredTools.length} of ${data?.length ?? 0}.`
            : null}
        </p>
      </header>

      {!isLoading && !isError && (data?.length ?? 0) > 0 ? (
        <div className={classes.filters}>
          <TextInput
            className={classes.searchInput}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search name, description…"
            aria-label="Search tools"
          />
          <MultiSelect
            className={classes.categoryFilter}
            searchable
            clearable
            data={SOURCE_OPTIONS}
            value={sourceFilter}
            onChange={(value) => setSourceFilter(value as ToolSource[])}
            placeholder="All sources"
            searchPlaceholder="Filter sources…"
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
        <p className={classes.statusError}>Failed to load tools.</p>
      ) : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <p className={classes.status}>
          No tools yet. Create one to get started.
        </p>
      ) : null}

      {!isLoading &&
      !isError &&
      (data?.length ?? 0) > 0 &&
      grouped.length === 0 ? (
        <p className={classes.status}>
          No tools match your filters.{" "}
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

      {!isLoading && !isError
        ? grouped.map(({ key, title, tools }) => (
            <section key={key} className={classes.group}>
              <div>
                <h3 className={classes.groupTitle}>{title}</h3>
                <p className={classes.groupHint}>
                  {key === "custom"
                    ? "Your own tools — create, edit, and delete freely."
                    : "Default tools shipped with the hub — editable, not deletable."}
                </p>
              </div>
              <div className={classes.grid}>
                {tools.map((tool) => (
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
            </section>
          ))
        : null}

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
      className={classes.cardWrap}
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
            <ActionIcon
              type="button"
              variant="ghost"
              aria-label="Duplicate"
              disabled={duplicatePending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDuplicate(tool.id);
              }}
            >
              <IconCopy size={15} />
            </ActionIcon>
            {!tool.is_built_in ? (
              <ActionIcon
                type="button"
                variant="ghostDanger"
                aria-label="Delete"
                disabled={deletePending}
                onClick={(event) => {
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
