import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  IconCopy,
  IconPlus,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import {
  LOREBOOK_CATEGORIES,
  LOREBOOK_CATEGORY_LABELS,
  type LorebookCategory,
  type LorebookListItem,
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
import { CreateLorebookModal } from "@/features/modals/lorebooks/CreateLorebookModal";
import { ImportLorebookModal } from "@/features/modals/lorebooks/ImportLorebookModal";
import {
  useDeleteLorebook,
  useDuplicateLorebook,
  useLorebooks,
} from "@/features/api-queries/lorebooks/queries";
import classes from "./LorebooksPage.module.css";

type DeleteTarget = {
  id: string;
  name: string;
};

export function LorebooksPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<LorebookCategory[]>([]);
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [globalOnly, setGlobalOnly] = useState(false);

  const { data, isLoading, isError } = useLorebooks();
  const deleteMutation = useDeleteLorebook();
  const duplicateMutation = useDuplicateLorebook();

  const categoryOptions = useMemo(
    () =>
      LOREBOOK_CATEGORIES.map((category) => ({
        value: category,
        label: LOREBOOK_CATEGORY_LABELS[category],
      })),
    [],
  );

  const hasActiveFilters =
    query.trim().length > 0 ||
    categoryFilter.length > 0 ||
    enabledOnly ||
    globalOnly;

  const filteredLorebooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data ?? []).filter((lorebook) => {
      if (enabledOnly && !lorebook.enabled) return false;
      if (globalOnly && !lorebook.global) return false;
      if (
        categoryFilter.length > 0 &&
        !categoryFilter.includes(lorebook.category)
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        lorebook.name.toLowerCase().includes(normalizedQuery) ||
        lorebook.description.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [categoryFilter, data, enabledOnly, globalOnly, query]);

  const grouped = useMemo(() => {
    const byCategory = new Map<LorebookCategory, LorebookListItem[]>();
    for (const category of LOREBOOK_CATEGORIES) {
      byCategory.set(category, []);
    }
    for (const lorebook of filteredLorebooks) {
      const list = byCategory.get(lorebook.category) ?? [];
      list.push(lorebook);
      byCategory.set(lorebook.category, list);
    }
    return LOREBOOK_CATEGORIES.map((category) => ({
      category,
      lorebooks: byCategory.get(category) ?? [],
    })).filter((group) => group.lorebooks.length > 0);
  }, [filteredLorebooks]);

  function clearFilters() {
    setQuery("");
    setCategoryFilter([]);
    setEnabledOnly(false);
    setGlobalOnly(false);
  }

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

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.headerRow}>
          <h2 className={classes.title}>Lorebooks</h2>
          <div className={classes.headerActions}>
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
          {!isLoading && !isError && hasActiveFilters
            ? ` Showing ${filteredLorebooks.length} of ${data?.length ?? 0}.`
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
            aria-label="Search lorebooks"
          />
          <MultiSelect
            className={classes.categoryFilter}
            searchable
            clearable
            data={categoryOptions}
            value={categoryFilter}
            onChange={(value) => setCategoryFilter(value as LorebookCategory[])}
            placeholder="All categories"
            searchPlaceholder="Filter categories…"
          />
          <Switch
            className={classes.defaultsSwitch}
            checked={enabledOnly}
            onChange={setEnabledOnly}
            label="Enabled only"
          />
          <Switch
            className={classes.defaultsSwitch}
            checked={globalOnly}
            onChange={setGlobalOnly}
            label="Global only"
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
        <p className={classes.statusError}>Failed to load lorebooks.</p>
      ) : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <p className={classes.status}>
          No lorebooks yet. Create one with + or import JSON.
        </p>
      ) : null}

      {!isLoading &&
      !isError &&
      (data?.length ?? 0) > 0 &&
      grouped.length === 0 ? (
        <p className={classes.status}>
          No lorebooks match your filters.{" "}
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

      {grouped.map(({ category, lorebooks }) => (
        <section key={category} className={classes.group}>
          <h3 className={classes.groupTitle}>
            {LOREBOOK_CATEGORY_LABELS[category]}
          </h3>
          <div className={classes.grid}>
            {lorebooks.map((lorebook) => (
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
        </section>
      ))}

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
      className={classes.cardWrap}
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
