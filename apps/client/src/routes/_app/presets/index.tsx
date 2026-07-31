import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  IconCopy,
  IconPlus,
  IconSparkles,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  GENERATOR_CATEGORIES,
  PRESET_CATEGORIES,
  PRESET_CATEGORY_LABELS,
  type GeneratorCategory,
  type GeneratorPresetListItem,
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
import { CreateGeneratorPresetModal } from "@/features/generator-presets/CreateGeneratorPresetModal";
import {
  useDeleteGeneratorPreset,
  useDuplicateGeneratorPreset,
  useGeneratorPresets,
  useUpdateGeneratorPreset,
} from "@/features/generator-presets/queries";
import { CreatePresetModal } from "@/features/presets/CreatePresetModal";
import { ImportPresetModal } from "@/features/presets/ImportPresetModal";
import {
  useDeletePreset,
  useDuplicatePreset,
  usePresets,
  useUpdatePreset,
} from "@/features/presets/queries";
import classes from "./index.module.css";

type PresetsSearch = {
  category?: PresetCategory;
};

function parsePresetsSearch(search: Record<string, unknown>): PresetsSearch {
  const raw = search.category;
  if (
    typeof raw === "string" &&
    (PRESET_CATEGORIES as readonly string[]).includes(raw)
  ) {
    return { category: raw as PresetCategory };
  }
  return {};
}

function isGeneratorCategory(
  category: PresetCategory,
): category is GeneratorCategory {
  return (GENERATOR_CATEGORIES as readonly string[]).includes(category);
}

export const Route = createFileRoute("/_app/presets/")({
  validateSearch: parsePresetsSearch,
  component: RouteComponent,
});

type DeleteTarget =
  | { kind: "preset"; id: string; name: string }
  | { kind: "generator"; id: string; name: string };

function RouteComponent() {
  const { category: navCategory } = Route.useSearch();
  const [createOpen, setCreateOpen] = useState(false);
  const [createGeneratorOpen, setCreateGeneratorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PresetCategory[]>(
    navCategory ? [navCategory] : [],
  );
  const [defaultsOnly, setDefaultsOnly] = useState(false);

  useEffect(() => {
    setCategoryFilter(navCategory ? [navCategory] : []);
  }, [navCategory]);

  const presetsQuery = usePresets();
  const generatorPresetsQuery = useGeneratorPresets();
  const deletePresetMutation = useDeletePreset();
  const duplicatePresetMutation = useDuplicatePreset();
  const updatePresetMutation = useUpdatePreset();
  const deleteGeneratorMutation = useDeleteGeneratorPreset();
  const duplicateGeneratorMutation = useDuplicateGeneratorPreset();
  const updateGeneratorMutation = useUpdateGeneratorPreset();

  const isLoading = presetsQuery.isLoading || generatorPresetsQuery.isLoading;
  const isError = presetsQuery.isError || generatorPresetsQuery.isError;

  const categoryOptions = useMemo(
    () =>
      PRESET_CATEGORIES.map((category) => ({
        value: category,
        label: PRESET_CATEGORY_LABELS[category],
      })),
    [],
  );

  const effectiveCategoryFilter =
    navCategory != null ? [navCategory] : categoryFilter;

  const filteredPresets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (presetsQuery.data ?? []).filter((preset) => {
      if (defaultsOnly && !preset.is_default) return false;
      if (
        effectiveCategoryFilter.length > 0 &&
        !effectiveCategoryFilter.includes(preset.category)
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
  }, [defaultsOnly, effectiveCategoryFilter, presetsQuery.data, query]);

  const filteredGeneratorPresets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (generatorPresetsQuery.data ?? []).filter((preset) => {
      if (defaultsOnly && !preset.is_default) return false;
      if (
        effectiveCategoryFilter.length > 0 &&
        !effectiveCategoryFilter.includes(preset.category)
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
  }, [
    defaultsOnly,
    effectiveCategoryFilter,
    generatorPresetsQuery.data,
    query,
  ]);

  const grouped = useMemo(() => {
    const presetsByCategory = new Map<PresetCategory, PresetListItem[]>();
    const generatorsByCategory = new Map<
      GeneratorCategory,
      GeneratorPresetListItem[]
    >();

    for (const category of PRESET_CATEGORIES) {
      presetsByCategory.set(category, []);
    }
    for (const category of GENERATOR_CATEGORIES) {
      generatorsByCategory.set(category, []);
    }

    for (const preset of filteredPresets) {
      presetsByCategory.get(preset.category)?.push(preset);
    }
    for (const preset of filteredGeneratorPresets) {
      generatorsByCategory.get(preset.category)?.push(preset);
    }

    const order =
      navCategory != null
        ? PRESET_CATEGORIES.filter((category) => category === navCategory)
        : PRESET_CATEGORIES;

    return order
      .map((category) => ({
        category,
        presets: presetsByCategory.get(category) ?? [],
        generatorPresets: isGeneratorCategory(category)
          ? (generatorsByCategory.get(category) ?? [])
          : [],
      }))
      .filter(
        (group) =>
          group.presets.length > 0 || group.generatorPresets.length > 0,
      );
  }, [filteredGeneratorPresets, filteredPresets, navCategory]);

  const totalVisible =
    filteredPresets.length + filteredGeneratorPresets.length;
  const totalAll =
    (presetsQuery.data?.length ?? 0) +
    (generatorPresetsQuery.data?.length ?? 0);

  const hasActiveFilters =
    query.trim().length > 0 ||
    effectiveCategoryFilter.length > 0 ||
    defaultsOnly;

  const showGeneratorCreate =
    navCategory == null || isGeneratorCategory(navCategory);

  const createPresetDefault: PresetCategory = navCategory ?? "roleplay";
  const createGeneratorDefault: GeneratorCategory =
    navCategory && isGeneratorCategory(navCategory)
      ? navCategory
      : "character_generator";

  function clearFilters() {
    setQuery("");
    setCategoryFilter([]);
    setDefaultsOnly(false);
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);

    if (target.kind === "preset") {
      deletePresetMutation.mutate(target.id, {
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
      return;
    }

    deleteGeneratorMutation.mutate(target.id, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Generator preset removed.",
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

  const pageTitle =
    navCategory != null
      ? PRESET_CATEGORY_LABELS[navCategory]
      : "Presets";

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.headerRow}>
          <h2 className={classes.title}>{pageTitle}</h2>
          <div className={classes.headerActions}>
            <ActionIcon
              type="button"
              variant="default"
              aria-label="Import preset"
              onClick={() => setImportOpen(true)}
            >
              <IconUpload size={16} />
            </ActionIcon>
            {showGeneratorCreate ? (
              <ActionIcon
                type="button"
                variant="default"
                aria-label="New generator preset"
                title="New generator preset"
                onClick={() => setCreateGeneratorOpen(true)}
              >
                <IconSparkles size={16} />
              </ActionIcon>
            ) : null}
            <ActionIcon
              type="button"
              variant="default"
              aria-label="New preset"
              title="New preset"
              onClick={() => setCreateOpen(true)}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </div>
        </div>
        <p className={classes.subtitle}>
          {navCategory != null && isGeneratorCategory(navCategory)
            ? "Generator prompts and structural presets for this category."
            : navCategory != null
              ? `Presets for ${PRESET_CATEGORY_LABELS[navCategory]}.`
              : "Prompt templates and generator prompts by category."}
          {!isLoading && !isError && hasActiveFilters
            ? ` Showing ${totalVisible} of ${totalAll}.`
            : null}
        </p>
      </header>

      {!isLoading && !isError && totalAll > 0 ? (
        <div className={classes.filters}>
          <TextInput
            className={classes.searchInput}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search name, description, author…"
            aria-label="Search presets"
          />
          {navCategory == null ? (
            <MultiSelect
              className={classes.categoryFilter}
              searchable
              clearable
              data={categoryOptions}
              value={categoryFilter}
              onChange={(value) =>
                setCategoryFilter(value as PresetCategory[])
              }
              placeholder="All categories"
              searchPlaceholder="Filter categories…"
            />
          ) : null}
          <Switch
            className={classes.defaultsSwitch}
            checked={defaultsOnly}
            onChange={setDefaultsOnly}
            label="Defaults only"
          />
          {hasActiveFilters && navCategory == null ? (
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

      {!isLoading && !isError && totalAll === 0 ? (
        <p className={classes.status}>
          No presets yet. Create one to get started.
        </p>
      ) : null}

      {!isLoading && !isError && totalAll > 0 && grouped.length === 0 ? (
        <p className={classes.status}>
          No presets match your filters.{" "}
          {hasActiveFilters && navCategory == null ? (
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

      {grouped.map(({ category, presets, generatorPresets }) => (
        <section key={category} className={classes.group}>
          {navCategory == null ? (
            <h3 className={classes.groupTitle}>
              {PRESET_CATEGORY_LABELS[category]}
            </h3>
          ) : null}

          {generatorPresets.length > 0 ? (
            <div className={classes.subGroup}>
              <h4 className={classes.subGroupTitle}>Generator Presets</h4>
              <p className={classes.subGroupHint}>
                Main prompts injected via the Generator Prompt marker.
              </p>
              <div className={classes.grid}>
                {generatorPresets.map((preset) => (
                  <motion.div
                    key={`gp-${preset.id}`}
                    className={classes.cardWrap}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16 }}
                  >
                    <Link
                      to="/presets/generator/$generatorPresetId"
                      params={{ generatorPresetId: preset.id }}
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
                              preset.is_default
                                ? classes.starActive
                                : undefined
                            }
                            aria-label={
                              preset.is_default
                                ? "Default generator preset"
                                : "Set as default"
                            }
                            disabled={
                              preset.is_default ||
                              (updateGeneratorMutation.isPending &&
                                updateGeneratorMutation.variables?.id ===
                                  preset.id)
                            }
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              updateGeneratorMutation.mutate(
                                { id: preset.id, input: { is_default: true } },
                                {
                                  onError: (error) => {
                                    notifications.show({
                                      title: "Set default failed",
                                      message:
                                        error instanceof Error
                                          ? error.message
                                          : "Unknown error",
                                      color: "red",
                                    });
                                  },
                                },
                              );
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
                            disabled={duplicateGeneratorMutation.isPending}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              duplicateGeneratorMutation.mutate(preset.id, {
                                onSuccess: (created) => {
                                  notifications.show({
                                    title: "Duplicated",
                                    message: `Created ${created.name}`,
                                    color: "green",
                                  });
                                },
                                onError: (error) => {
                                  notifications.show({
                                    title: "Duplicate failed",
                                    message:
                                      error instanceof Error
                                        ? error.message
                                        : "Unknown error",
                                    color: "red",
                                  });
                                },
                              });
                            }}
                          >
                            <IconCopy size={15} />
                          </ActionIcon>
                          <ActionIcon
                            type="button"
                            variant="ghostDanger"
                            aria-label="Delete"
                            disabled={deleteGeneratorMutation.isPending}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setDeleteTarget({
                                kind: "generator",
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
                        Generator prompt
                        {preset.author ? ` · ${preset.author}` : ""}
                      </p>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : null}

          {presets.length > 0 ? (
            <div className={classes.subGroup}>
              {isGeneratorCategory(category) ? (
                <>
                  <h4 className={classes.subGroupTitle}>Presets</h4>
                  <p className={classes.subGroupHint}>
                    Structural templates (sections, markers, variables).
                  </p>
                </>
              ) : null}
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
                              preset.is_default
                                ? classes.starActive
                                : undefined
                            }
                            aria-label={
                              preset.is_default
                                ? "Default preset"
                                : "Set as default"
                            }
                            disabled={
                              preset.is_default ||
                              (updatePresetMutation.isPending &&
                                updatePresetMutation.variables?.id ===
                                  preset.id)
                            }
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              updatePresetMutation.mutate(
                                { id: preset.id, input: { is_default: true } },
                                {
                                  onError: (error) => {
                                    notifications.show({
                                      title: "Set default failed",
                                      message:
                                        error instanceof Error
                                          ? error.message
                                          : "Unknown error",
                                      color: "red",
                                    });
                                  },
                                },
                              );
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
                            disabled={duplicatePresetMutation.isPending}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              duplicatePresetMutation.mutate(preset.id, {
                                onSuccess: (created) => {
                                  notifications.show({
                                    title: "Duplicated",
                                    message: `Created ${created.name}`,
                                    color: "green",
                                  });
                                },
                                onError: (error) => {
                                  notifications.show({
                                    title: "Duplicate failed",
                                    message:
                                      error instanceof Error
                                        ? error.message
                                        : "Unknown error",
                                    color: "red",
                                  });
                                },
                              });
                            }}
                          >
                            <IconCopy size={15} />
                          </ActionIcon>
                          <ActionIcon
                            type="button"
                            variant="ghostDanger"
                            aria-label="Delete"
                            disabled={deletePresetMutation.isPending}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setDeleteTarget({
                                kind: "preset",
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
                        {preset.wrap_format} · {preset.sections_count} sections
                        · {preset.variables_count} variables
                      </p>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ))}

      <CreatePresetModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultCategory={createPresetDefault}
      />

      <CreateGeneratorPresetModal
        opened={createGeneratorOpen}
        onClose={() => setCreateGeneratorOpen(false)}
        defaultCategory={createGeneratorDefault}
      />

      <ImportPresetModal
        opened={importOpen}
        onClose={() => setImportOpen(false)}
      />

      <Modal
        opened={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title={
          deleteTarget?.kind === "generator"
            ? "Delete generator preset"
            : "Delete preset"
        }
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete{" "}
          <strong>
            {deleteTarget?.name ||
              (deleteTarget?.kind === "generator"
                ? "this generator preset"
                : "this preset")}
          </strong>
          ? This cannot be undone.
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
