import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  IconCopy,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PRESET_CATEGORIES,
  PRESET_CATEGORY_LABELS,
  type PresetCategory,
  type PresetListItem,
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
import { CreatePresetModal } from "@/features/presets/CreatePresetModal";
import { ImportPresetModal } from "@/features/presets/ImportPresetModal";
import {
  useDeletePreset,
  useDuplicatePreset,
  usePresets,
  useUpdatePreset,
} from "@/features/presets/queries";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/presets/")({
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
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PresetCategory[]>([]);
  const [defaultsOnly, setDefaultsOnly] = useState(false);

  const { data, isLoading, isError } = usePresets();
  const deleteMutation = useDeletePreset();
  const duplicateMutation = useDuplicatePreset();
  const updateMutation = useUpdatePreset();

  const categoryOptions = useMemo(
    () =>
      PRESET_CATEGORIES.map((category) => ({
        value: category,
        label: PRESET_CATEGORY_LABELS[category],
      })),
    [],
  );

  const hasActiveFilters =
    query.trim().length > 0 || categoryFilter.length > 0 || defaultsOnly;

  const filteredPresets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data ?? []).filter((preset) => {
      if (defaultsOnly && !preset.is_default) return false;
      if (
        categoryFilter.length > 0 &&
        !categoryFilter.includes(preset.category)
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        preset.name.toLowerCase().includes(normalizedQuery) ||
        preset.description.toLowerCase().includes(normalizedQuery) ||
        preset.author.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [categoryFilter, data, defaultsOnly, query]);

  const grouped = useMemo(() => {
    const byCategory = new Map<PresetCategory, PresetListItem[]>();
    for (const category of PRESET_CATEGORIES) {
      byCategory.set(category, []);
    }
    for (const preset of filteredPresets) {
      const list = byCategory.get(preset.category) ?? [];
      list.push(preset);
      byCategory.set(preset.category, list);
    }
    return PRESET_CATEGORIES.map((category) => ({
      category,
      presets: byCategory.get(category) ?? [],
    })).filter((group) => group.presets.length > 0);
  }, [filteredPresets]);

  function clearFilters() {
    setQuery("");
    setCategoryFilter([]);
    setDefaultsOnly(false);
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Preset removed.",
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
      onSuccess: (preset) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${preset.name}`,
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
          <h2 className={classes.title}>Presets</h2>
          <div className={classes.headerActions}>
            <ActionIcon
              type="button"
              variant="default"
              aria-label="Import preset"
              onClick={() => setImportOpen(true)}
            >
              <IconUpload size={16} />
            </ActionIcon>
            <ActionIcon
              type="button"
              variant="default"
              aria-label="New preset"
              onClick={() => setCreateOpen(true)}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </div>
        </div>
        <p className={classes.subtitle}>
          Manage prompt presets for chats.
          {!isLoading && !isError && hasActiveFilters
            ? ` Showing ${filteredPresets.length} of ${data?.length ?? 0}.`
            : null}
        </p>
      </header>

      {!isLoading && !isError && (data?.length ?? 0) > 0 ? (
        <div className={classes.filters}>
          <TextInput
            className={classes.searchInput}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search name, description, author…"
            aria-label="Search presets"
          />
          <MultiSelect
            className={classes.categoryFilter}
            searchable
            clearable
            data={categoryOptions}
            value={categoryFilter}
            onChange={(value) => setCategoryFilter(value as PresetCategory[])}
            placeholder="All categories"
            searchPlaceholder="Filter categories…"
          />
          <Switch
            className={classes.defaultsSwitch}
            checked={defaultsOnly}
            onChange={setDefaultsOnly}
            label="Defaults only"
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
        <p className={classes.statusError}>Failed to load presets.</p>
      ) : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <p className={classes.status}>
          No presets yet. Create one to get started.
        </p>
      ) : null}

      {!isLoading &&
      !isError &&
      (data?.length ?? 0) > 0 &&
      grouped.length === 0 ? (
        <p className={classes.status}>
          No presets match your filters.{" "}
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

      {grouped.map(({ category, presets }) => (
        <section key={category} className={classes.group}>
          <h3 className={classes.groupTitle}>
            {PRESET_CATEGORY_LABELS[category]}
          </h3>
          <div className={classes.grid}>
            {presets.map((preset) => (
              <motion.div
                key={preset.id}
                className={classes.cardWrap}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
              >
                <Link
                  to="/presets/$presetId"
                  params={{ presetId: preset.id }}
                  className={classes.card}
                >
                  <div className={classes.cardTop}>
                    <p className={classes.cardName}>
                      {preset.name || "Untitled"}
                    </p>
                    <div className={classes.cardActions}>
                      <ActionIcon
                        type="button"
                        variant={preset.is_default ? "light" : "ghost"}
                        className={
                          preset.is_default ? classes.starActive : undefined
                        }
                        aria-label={
                          preset.is_default
                            ? "Default preset"
                            : "Set as default"
                        }
                        disabled={
                          preset.is_default ||
                          (updateMutation.isPending &&
                            updateMutation.variables?.id === preset.id)
                        }
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleSetDefault(preset.id);
                        }}
                      >
                        {preset.is_default ? (
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
                          handleDuplicate(preset.id);
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
                            id: preset.id,
                            name: preset.name,
                          });
                        }}
                      >
                        <IconTrash size={15} />
                      </ActionIcon>
                    </div>
                  </div>
                  <p className={classes.cardDescription}>
                    {preset.description || "No description"}
                  </p>
                  <p className={classes.cardMeta}>
                    {preset.wrap_format} · {preset.sections_count} sections ·{" "}
                    {preset.variables_count} variables
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      ))}

      <CreatePresetModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <ImportPresetModal
        opened={importOpen}
        onClose={() => setImportOpen(false)}
      />

      <Modal
        opened={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete preset"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{deleteTarget?.name || "this preset"}</strong>? This
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
