import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { IconCopy, IconPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { PersonaListItem } from "@ai-hub/shared";
import {
  ActionIcon,
  Button,
  Modal,
  notifications,
  RuntimeText,
  Switch,
  TextInput,
} from "@/components/ui";
import { api } from "@/lib/api";
import { CreatePersonaModal } from "@/features/modals/personas/CreatePersonaModal";
import { ImportPersonaModal } from "@/features/modals/personas/ImportPersonaModal";
import { avatarSrc } from "@/lib/avatar-url";
import {
  useDeletePersona,
  useDuplicatePersona,
  usePersonas,
} from "@/features/api-queries/personas/queries";
import classes from "./PersonasPage.module.css";

type DeleteTarget = {
  id: string;
  name: string;
};

export function PersonasPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [query, setQuery] = useState("");
  const [defaultsOnly, setDefaultsOnly] = useState(false);

  const { data, isLoading, isError } = usePersonas();
  const deleteMutation = useDeletePersona();
  const duplicateMutation = useDuplicatePersona();

  const hasActiveFilters = query.trim().length > 0 || defaultsOnly;

  const filteredPersonas = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data ?? []).filter((persona) => {
      if (defaultsOnly && !persona.is_default) return false;
      if (!normalizedQuery) return true;
      return (
        persona.name.toLowerCase().includes(normalizedQuery) ||
        persona.description.toLowerCase().includes(normalizedQuery) ||
        persona.appearance.toLowerCase().includes(normalizedQuery) ||
        persona.personality.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [data, defaultsOnly, query]);

  function clearFilters() {
    setQuery("");
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
          message: "Persona removed.",
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
      onSuccess: (persona) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${persona.name}`,
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
          <h2 className={classes.title}>Personas</h2>
          <div className={classes.headerActions}>
            <ActionIcon
              type="button"
              variant="default"
              aria-label="Import persona"
              onClick={() => setImportOpen(true)}
            >
              <IconUpload size={16} />
            </ActionIcon>
            <ActionIcon
              type="button"
              variant="default"
              aria-label="New persona"
              onClick={() => setCreateOpen(true)}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </div>
        </div>
        <p className={classes.subtitle}>
          Player personas for <RuntimeText>{"{{user}}"}</RuntimeText>. One can
          be marked as default.
          {!isLoading && !isError && hasActiveFilters
            ? ` Showing ${filteredPersonas.length} of ${data?.length ?? 0}.`
            : null}
        </p>
      </header>

      {!isLoading && !isError && (data?.length ?? 0) > 0 ? (
        <div className={classes.filters}>
          <TextInput
            className={classes.searchInput}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search name, description, appearance, personality…"
            aria-label="Search personas"
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
        <p className={classes.statusError}>Failed to load personas.</p>
      ) : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <p className={classes.status}>No personas yet. Create one with +.</p>
      ) : null}

      {!isLoading &&
      !isError &&
      (data?.length ?? 0) > 0 &&
      filteredPersonas.length === 0 ? (
        <p className={classes.status}>
          No personas match your filters.{" "}
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

      {!isLoading && !isError && filteredPersonas.length > 0 ? (
        <div className={classes.grid}>
          {filteredPersonas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              onDuplicate={handleDuplicate}
              onDelete={(id, name) => setDeleteTarget({ id, name })}
              duplicatePending={duplicateMutation.isPending}
              deletePending={deleteMutation.isPending}
            />
          ))}
        </div>
      ) : null}

      <CreatePersonaModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <ImportPersonaModal
        opened={importOpen}
        onClose={() => setImportOpen(false)}
      />

      <Modal
        opened={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete persona"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{deleteTarget?.name || "this persona"}</strong>? This
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

function PersonaCard({
  persona,
  onDuplicate,
  onDelete,
  duplicatePending,
  deletePending,
}: {
  persona: PersonaListItem;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  duplicatePending: boolean;
  deletePending: boolean;
}) {
  const avatarUrl = avatarSrc(
    persona.avatar,
    String(api.defaults.baseURL),
  );

  return (
    <motion.div
      className={classes.cardWrap}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
    >
      <Link
        to="/personas/$personaId"
        params={{ personaId: persona.id }}
        className={classes.card}
      >
        <div className={classes.cardTop}>
          <div className={classes.cardIdentity}>
            {avatarUrl ? (
              <span className={classes.avatar}>
                <img src={avatarUrl} alt="" width={48} height={48} />
              </span>
            ) : (
              <span className={classes.avatarFallback} aria-hidden>
                {(persona.name || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className={classes.cardText}>
              <p className={classes.cardName}>{persona.name || "untitled"}</p>
              <p className={classes.cardDescription}>
                {persona.description ? (
                  <RuntimeText
                    values={{ user: persona.name || "untitled" }}
                    highlightUnresolved={false}
                  >
                    {persona.description}
                  </RuntimeText>
                ) : (
                  "No description"
                )}
              </p>
            </div>
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
                onDuplicate(persona.id);
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
                onDelete(persona.id, persona.name);
              }}
            >
              <IconTrash size={15} />
            </ActionIcon>
          </div>
        </div>
        {persona.is_default ? (
          <div className={classes.badges}>
            <span className={classes.badgeSoft}>default</span>
          </div>
        ) : null}
      </Link>
    </motion.div>
  );
}
