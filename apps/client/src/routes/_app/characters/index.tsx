import { useState } from "react";
import { motion } from "motion/react";
import {
  IconCopy,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { CharacterListItem } from "@ai-hub/shared";
import { api } from "@/lib/api";
import { ActionIcon, Button, Modal, notifications, RuntimeText } from "@/components/ui";
import { CreateCharacterModal } from "@/features/characters/CreateCharacterModal";
import { ImportCharacterModal } from "@/features/characters/ImportCharacterModal";
import { RegenerateCharactersModal } from "@/features/characters/RegenerateCharactersModal";
import { characterAvatarSrc } from "@/features/characters/avatar-url";
import {
  useCharacters,
  useDeleteCharacter,
  useDuplicateCharacter,
} from "@/features/characters/queries";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/characters/")({
  component: RouteComponent,
});

type DeleteTarget = {
  id: string;
  name: string;
};

function RouteComponent() {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const { data, isLoading, isError } = useCharacters();
  const deleteMutation = useDeleteCharacter();
  const duplicateMutation = useDuplicateCharacter();

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
            <ActionIcon type="button" variant="default" aria-label="Regenerate characters" onClick={() => setRegenerateOpen(true)}
            >
              <IconRefresh size={16} />
            </ActionIcon>
            <ActionIcon type="button" variant="default" aria-label="Import character card" onClick={() => setImportOpen(true)}
            >
              <IconUpload size={16} />
            </ActionIcon>
            <ActionIcon type="button" variant="default" aria-label="New character" onClick={() => setCreateOpen(true)}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </div>
        </div>
        <p className={classes.subtitle}>
          Characters. Create, edit, duplicate, regenerate, or import JSON/PNG.
        </p>
      </header>

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

      {!isLoading && !isError && (data?.length ?? 0) > 0 ? (
        <div className={classes.grid}>
          {(data ?? []).map((character, index) => (
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
  const avatarSrc = characterAvatarSrc(
    character.avatar,
    String(api.defaults.baseURL),
  );

  return (
    <motion.div
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
            {avatarSrc ? (
              <span className={classes.avatar}>
                <img src={avatarSrc} alt="" width={48} height={48} />
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
            <ActionIcon type="button" variant="ghost" aria-label="Duplicate" disabled={duplicatePending} onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDuplicate(character.id);
              }}
            >
              <IconCopy size={15} />
            </ActionIcon>
            <ActionIcon type="button" variant="ghostDanger" aria-label="Delete" disabled={deletePending} onClick={(event) => {
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
