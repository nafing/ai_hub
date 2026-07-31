import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  IconCopy,
  IconFolder,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUpload,
  IconWorldDownload,
} from "@tabler/icons-react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { CharacterListItem } from "@ai-hub/shared";
import { api } from "@/lib/api";
import {
  ActionIcon,
  Button,
  Modal,
  MultiSelect,
  notifications,
  RuntimeText,
  TextInput,
} from "@/components/ui";
import { CreateCharacterModal } from "@/features/modals/characters/CreateCharacterModal";
import { ImportCharacterModal } from "@/features/modals/characters/ImportCharacterModal";
import { ManageCharacterFoldersModal } from "@/features/modals/characters/ManageCharacterFoldersModal";
import { RegenerateCharactersModal } from "@/features/modals/characters/RegenerateCharactersModal";
import { avatarSrc } from "@/lib/avatar-url";
import { useCharacterFolders } from "@/features/api-queries/characters/foldersQueries";
import {
  useCharacters,
  useDeleteCharacter,
  useDuplicateCharacter,
} from "@/features/api-queries/characters/queries";
import classes from "./CharactersPage.module.css";

type DeleteTarget = {
  id: string;
  name: string;
};

export function CharactersPage() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [folderFilter, setFolderFilter] = useState<string[]>([]);

  const { data, isLoading, isError } = useCharacters();
  const foldersQuery = useCharacterFolders();
  const deleteMutation = useDeleteCharacter();
  const duplicateMutation = useDuplicateCharacter();

  const folders = foldersQuery.data ?? [];

  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    for (const character of data ?? []) {
      for (const tag of character.tags) {
        if (tag.trim()) tags.add(tag);
      }
    }
    return [...tags]
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ value: tag, label: tag }));
  }, [data]);

  const folderOptions = useMemo(
    () =>
      folders.map((folder) => ({
        value: folder.id,
        label: `${folder.name} (${folder.character_ids.length})`,
      })),
    [folders],
  );

  const folderMemberIds = useMemo(() => {
    if (folderFilter.length === 0) return null;
    const ids = new Set<string>();
    for (const folder of folders) {
      if (!folderFilter.includes(folder.id)) continue;
      for (const id of folder.character_ids) ids.add(id);
    }
    return ids;
  }, [folders, folderFilter]);

  const hasActiveFilters =
    query.trim().length > 0 ||
    tagFilter.length > 0 ||
    folderFilter.length > 0;

  const filteredCharacters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data ?? []).filter((character) => {
      if (folderMemberIds && !folderMemberIds.has(character.id)) {
        return false;
      }
      if (
        tagFilter.length > 0 &&
        !tagFilter.some((tag) => character.tags.includes(tag))
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        character.name.toLowerCase().includes(normalizedQuery) ||
        character.description.toLowerCase().includes(normalizedQuery) ||
        character.creator.toLowerCase().includes(normalizedQuery) ||
        character.tags.some((tag) =>
          tag.toLowerCase().includes(normalizedQuery),
        )
      );
    });
  }, [data, query, tagFilter, folderMemberIds]);

  function clearFilters() {
    setQuery("");
    setTagFilter([]);
    setFolderFilter([]);
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Character removed.",
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
      onSuccess: (character) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${character.data.name}`,
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
          <h2 className={classes.title}>Characters</h2>
          <div className={classes.headerActions}>
            <ActionIcon
              type="button"
              variant="default"
              aria-label="Manage character folders"
              onClick={() => setFoldersOpen(true)}
            >
              <IconFolder size={16} />
            </ActionIcon>
            <ActionIcon
              type="button"
              variant="default"
              aria-label="Regenerate characters"
              onClick={() => setRegenerateOpen(true)}
            >
              <IconRefresh size={16} />
            </ActionIcon>
            <ActionIcon
              type="button"
              variant="default"
              aria-label="Import from website"
              onClick={() => void navigate({ to: "/characters/import" })}
            >
              <IconWorldDownload size={16} />
            </ActionIcon>
            <ActionIcon
              type="button"
              variant="default"
              aria-label="Import character card"
              onClick={() => setImportOpen(true)}
            >
              <IconUpload size={16} />
            </ActionIcon>
            <ActionIcon
              type="button"
              variant="default"
              aria-label="New character"
              onClick={() => setCreateOpen(true)}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </div>
        </div>
        <p className={classes.subtitle}>
          Characters. Create, edit, duplicate, regenerate, or import JSON/PNG /
          Botbooru. Use folders to quickly add a cast to a chat.
          {!isLoading && !isError && hasActiveFilters
            ? ` Showing ${filteredCharacters.length} of ${data?.length ?? 0}.`
            : null}
        </p>
      </header>

      {!isLoading && !isError && (data?.length ?? 0) > 0 ? (
        <div className={classes.filters}>
          <TextInput
            className={classes.searchInput}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search name, description, creator, tags…"
            aria-label="Search characters"
          />
          {folderOptions.length > 0 ? (
            <MultiSelect
              className={classes.categoryFilter}
              searchable
              clearable
              data={folderOptions}
              value={folderFilter}
              onChange={setFolderFilter}
              placeholder="All folders"
              searchPlaceholder="Filter folders…"
            />
          ) : null}
          {tagOptions.length > 0 ? (
            <MultiSelect
              className={classes.categoryFilter}
              searchable
              clearable
              data={tagOptions}
              value={tagFilter}
              onChange={setTagFilter}
              placeholder="All tags"
              searchPlaceholder="Filter tags…"
            />
          ) : null}
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
        <p className={classes.statusError}>Failed to load characters.</p>
      ) : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <p className={classes.status}>No characters yet. Create one with +.</p>
      ) : null}

      {!isLoading &&
      !isError &&
      (data?.length ?? 0) > 0 &&
      filteredCharacters.length === 0 ? (
        <p className={classes.status}>
          No characters match your filters.{" "}
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

      {!isLoading && !isError && filteredCharacters.length > 0 ? (
        <div className={classes.grid}>
          {filteredCharacters.map((character, index) => (
            <CharacterCard
              key={character.id}
              character={character}
              index={index}
              onDuplicate={handleDuplicate}
              onDelete={(id, name) => setDeleteTarget({ id, name })}
              duplicatePending={duplicateMutation.isPending}
              deletePending={deleteMutation.isPending}
            />
          ))}
        </div>
      ) : null}

      <CreateCharacterModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <ImportCharacterModal
        opened={importOpen}
        onClose={() => setImportOpen(false)}
      />
      <RegenerateCharactersModal
        opened={regenerateOpen}
        onClose={() => setRegenerateOpen(false)}
      />
      <ManageCharacterFoldersModal
        opened={foldersOpen}
        onClose={() => setFoldersOpen(false)}
        folders={folders}
        characters={data ?? []}
      />

      <Modal
        opened={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete character"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{deleteTarget?.name || "this character"}</strong>? This
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

function CharacterCard({
  character,
  index,
  onDuplicate,
  onDelete,
  duplicatePending,
  deletePending,
}: {
  character: CharacterListItem;
  index: number;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  duplicatePending: boolean;
  deletePending: boolean;
}) {
  const avatarUrl = avatarSrc(
    character.avatar,
    String(api.defaults.baseURL),
  );

  return (
    <motion.div
      className={classes.cardWrap}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, delay: Math.min(index, 12) * 0.02 }}
    >
      <Link
        to="/characters/$characterId"
        params={{ characterId: character.id }}
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
                {(character.name || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className={classes.cardText}>
              <p className={classes.cardName}>
                {character.name || "untitled"}
              </p>
              {character.creator ? (
                <p className={classes.cardCreator}>by {character.creator}</p>
              ) : null}
              <p className={classes.cardDescription}>
                {character.description ? (
                  <RuntimeText
                    values={{ char: character.name || "untitled" }}
                    highlightUnresolved={false}
                  >
                    {character.description}
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
                onDuplicate(character.id);
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
                onDelete(character.id, character.name);
              }}
            >
              <IconTrash size={15} />
            </ActionIcon>
          </div>
        </div>
        <div className={classes.badges}>
          {character.character_version ? (
            <span className={classes.badgeOutline}>
              v{character.character_version}
            </span>
          ) : null}
          {character.tags.slice(0, 4).map((tag) => (
            <span key={tag} className={classes.badgeSoft}>
              {tag}
            </span>
          ))}
          {character.tags.length > 4 ? (
            <span className={classes.badgeSoft}>
              +{character.tags.length - 4}
            </span>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}
