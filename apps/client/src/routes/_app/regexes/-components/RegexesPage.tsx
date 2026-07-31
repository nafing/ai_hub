import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { IconCopy, IconPlus, IconTrash } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import {
  REGEX_APPLY_TO,
  REGEX_APPLY_TO_LABELS,
  REGEX_SCOPES,
  REGEX_SCOPE_LABELS,
  REGEX_TARGETS,
  REGEX_TARGET_LABELS,
  type RegexApplyTo,
  type RegexScope,
  type RegexScriptListItem,
  type RegexTarget,
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
import { CreateRegexModal } from "@/features/modals/regexes/CreateRegexModal";
import {
  useDeleteRegex,
  useDuplicateRegex,
  useRegexes,
} from "@/features/api-queries/regexes/queries";
import classes from "./RegexesPage.module.css";

type DeleteTarget = {
  id: string;
  name: string;
};

export function RegexesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<RegexScope[]>([]);
  const [applyToFilter, setApplyToFilter] = useState<RegexApplyTo[]>([]);
  const [targetFilter, setTargetFilter] = useState<RegexTarget[]>([]);
  const [enabledOnly, setEnabledOnly] = useState(false);

  const { data, isLoading, isError } = useRegexes();
  const deleteMutation = useDeleteRegex();
  const duplicateMutation = useDuplicateRegex();

  const scopeOptions = useMemo(
    () =>
      REGEX_SCOPES.map((scope) => ({
        value: scope,
        label: REGEX_SCOPE_LABELS[scope],
      })),
    [],
  );

  const applyToOptions = useMemo(
    () =>
      REGEX_APPLY_TO.map((applyTo) => ({
        value: applyTo,
        label: REGEX_APPLY_TO_LABELS[applyTo],
      })),
    [],
  );

  const targetOptions = useMemo(
    () =>
      REGEX_TARGETS.map((target) => ({
        value: target,
        label: REGEX_TARGET_LABELS[target],
      })),
    [],
  );

  const hasActiveFilters =
    query.trim().length > 0 ||
    scopeFilter.length > 0 ||
    applyToFilter.length > 0 ||
    targetFilter.length > 0 ||
    enabledOnly;

  const filteredScripts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data ?? []).filter((script) => {
      if (enabledOnly && !script.enabled) return false;
      if (scopeFilter.length > 0 && !scopeFilter.includes(script.scope)) {
        return false;
      }
      if (
        applyToFilter.length > 0 &&
        !applyToFilter.includes(script.apply_to as RegexApplyTo)
      ) {
        return false;
      }
      if (
        targetFilter.length > 0 &&
        !script.targets.some((target) =>
          targetFilter.includes(target as RegexTarget),
        )
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        script.name.toLowerCase().includes(normalizedQuery) ||
        script.find_regex.toLowerCase().includes(normalizedQuery) ||
        script.replace_with.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [applyToFilter, data, enabledOnly, query, scopeFilter, targetFilter]);

  const grouped = useMemo(() => {
    const byScope = new Map<RegexScope, RegexScriptListItem[]>();
    for (const scope of REGEX_SCOPES) {
      byScope.set(scope, []);
    }
    for (const script of filteredScripts) {
      const list = byScope.get(script.scope) ?? [];
      list.push(script);
      byScope.set(script.scope, list);
    }
    return REGEX_SCOPES.map((scope) => ({
      scope,
      scripts: byScope.get(scope) ?? [],
    })).filter((group) => group.scripts.length > 0);
  }, [filteredScripts]);

  function clearFilters() {
    setQuery("");
    setScopeFilter([]);
    setApplyToFilter([]);
    setTargetFilter([]);
    setEnabledOnly(false);
  }

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
          <ActionIcon
            type="button"
            variant="default"
            aria-label="New regex"
            onClick={() => setCreateOpen(true)}
          >
            <IconPlus size={16} />
          </ActionIcon>
        </div>
        <p className={classes.subtitle}>
          Find/replace scripts for AI output and user input (display and/or
          prompt).
          {!isLoading && !isError && hasActiveFilters
            ? ` Showing ${filteredScripts.length} of ${data?.length ?? 0}.`
            : null}
        </p>
      </header>

      {!isLoading && !isError && (data?.length ?? 0) > 0 ? (
        <div className={classes.filters}>
          <TextInput
            className={classes.searchInput}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search name, pattern, replacement…"
            aria-label="Search regexes"
          />
          <MultiSelect
            className={classes.categoryFilter}
            searchable
            clearable
            data={scopeOptions}
            value={scopeFilter}
            onChange={(value) => setScopeFilter(value as RegexScope[])}
            placeholder="All scopes"
            searchPlaceholder="Filter scopes…"
          />
          <MultiSelect
            className={classes.categoryFilter}
            searchable
            clearable
            data={applyToOptions}
            value={applyToFilter}
            onChange={(value) => setApplyToFilter(value as RegexApplyTo[])}
            placeholder="All apply modes"
            searchPlaceholder="Filter apply modes…"
          />
          <MultiSelect
            className={classes.categoryFilter}
            searchable
            clearable
            data={targetOptions}
            value={targetFilter}
            onChange={(value) => setTargetFilter(value as RegexTarget[])}
            placeholder="All targets"
            searchPlaceholder="Filter targets…"
          />
          <Switch
            className={classes.defaultsSwitch}
            checked={enabledOnly}
            onChange={setEnabledOnly}
            label="Enabled only"
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
        <p className={classes.statusError}>Failed to load regexes.</p>
      ) : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <p className={classes.status}>
          No regex scripts yet. Create one to get started.
        </p>
      ) : null}

      {!isLoading &&
      !isError &&
      (data?.length ?? 0) > 0 &&
      grouped.length === 0 ? (
        <p className={classes.status}>
          No regex scripts match your filters.{" "}
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

      {grouped.map(({ scope, scripts }) => (
        <section key={scope} className={classes.group}>
          <h3 className={classes.groupTitle}>{REGEX_SCOPE_LABELS[scope]}</h3>
          <div className={classes.grid}>
            {scripts.map((script) => (
              <motion.div
                key={script.id}
                className={classes.cardWrap}
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
                      <ActionIcon
                        type="button"
                        variant="ghost"
                        aria-label="Duplicate"
                        disabled={duplicateMutation.isPending}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleDuplicate(script.id);
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
                      {
                        REGEX_APPLY_TO_LABELS[
                          script.apply_to as RegexApplyTo
                        ]
                      }
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
        </section>
      ))}

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
