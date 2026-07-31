import { useEffect, useMemo, useState } from "react";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import type { CharacterFolder, CharacterListItem } from "@ai-hub/shared";
import {
  ActionIcon,
  Button,
  Modal,
  MultiSelect,
  TextInput,
  notifications,
} from "@/components/ui";
import {
  useCreateCharacterFolder,
  useDeleteCharacterFolder,
  useUpdateCharacterFolder,
} from "@/features/api-queries/characters/foldersQueries";
import classes from "./ManageCharacterFoldersModal.module.css";

type ManageCharacterFoldersModalProps = {
  opened: boolean;
  onClose: () => void;
  folders: CharacterFolder[];
  characters: CharacterListItem[];
};

type EditorState = {
  id: string | null;
  name: string;
  characterIds: string[];
};

const emptyEditor = (): EditorState => ({
  id: null,
  name: "",
  characterIds: [],
});

export function ManageCharacterFoldersModal({
  opened,
  onClose,
  folders,
  characters,
}: ManageCharacterFoldersModalProps) {
  const createMutation = useCreateCharacterFolder();
  const updateMutation = useUpdateCharacterFolder();
  const deleteMutation = useDeleteCharacterFolder();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CharacterFolder | null>(
    null,
  );

  useEffect(() => {
    if (!opened) {
      setEditor(null);
      setDeleteTarget(null);
    }
  }, [opened]);

  const characterOptions = useMemo(
    () =>
      characters.map((character) => ({
        value: character.id,
        label: character.name || "Unnamed",
      })),
    [characters],
  );

  const characterNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const character of characters) {
      map.set(character.id, character.name || "Unnamed");
    }
    return map;
  }, [characters]);

  const saving = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setEditor(emptyEditor());
  }

  function openEdit(folder: CharacterFolder) {
    setEditor({
      id: folder.id,
      name: folder.name,
      characterIds: [...folder.character_ids],
    });
  }

  async function handleSave() {
    if (!editor) return;
    const name = editor.name.trim();
    if (!name) {
      notifications.show({
        title: "Name required",
        message: "Give the folder a name.",
        color: "red",
      });
      return;
    }

    try {
      if (editor.id) {
        await updateMutation.mutateAsync({
          id: editor.id,
          input: {
            name,
            character_ids: editor.characterIds,
          },
        });
        notifications.show({
          title: "Folder updated",
          message: name,
          color: "green",
        });
      } else {
        await createMutation.mutateAsync({
          name,
          character_ids: editor.characterIds,
        });
        notifications.show({
          title: "Folder created",
          message: name,
          color: "green",
        });
      }
      setEditor(null);
    } catch (error) {
      notifications.show({
        title: "Save failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setDeleteTarget(null);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        notifications.show({
          title: "Folder deleted",
          message: name,
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

  return (
    <>
      <Modal
        opened={opened && editor == null && deleteTarget == null}
        onClose={onClose}
        title="Character folders"
        size="md"
      >
        <p className={classes.intro}>
          Group characters into folders, then add a whole folder to a chat in
          one click.
        </p>

        {folders.length === 0 ? (
          <p className={classes.empty}>No folders yet.</p>
        ) : (
          <ul className={classes.list}>
            {folders.map((folder) => (
              <li key={folder.id} className={classes.row}>
                <div className={classes.rowText}>
                  <p className={classes.rowName}>{folder.name}</p>
                  <p className={classes.rowMeta}>
                    {folder.character_ids.length === 0
                      ? "Empty"
                      : folder.character_ids
                          .map(
                            (id) =>
                              characterNameById.get(id) ?? "Missing character",
                          )
                          .join(", ")}
                  </p>
                </div>
                <div className={classes.rowActions}>
                  <ActionIcon
                    type="button"
                    variant="ghost"
                    aria-label={`Edit ${folder.name}`}
                    onClick={() => openEdit(folder)}
                  >
                    <IconPencil size={15} />
                  </ActionIcon>
                  <ActionIcon
                    type="button"
                    variant="ghostDanger"
                    aria-label={`Delete ${folder.name}`}
                    disabled={deleteMutation.isPending}
                    onClick={() => setDeleteTarget(folder)}
                  >
                    <IconTrash size={15} />
                  </ActionIcon>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className={classes.footer}>
          <Button type="button" variant="default" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="primary"
            leftSection={<IconPlus size={14} />}
            onClick={openCreate}
          >
            New folder
          </Button>
        </div>
      </Modal>

      <Modal
        opened={editor != null}
        onClose={() => setEditor(null)}
        title={editor?.id ? "Edit folder" : "New folder"}
        size="md"
      >
        {editor ? (
          <div className={classes.editor}>
            <label className={classes.field}>
              <span className={classes.fieldLabel}>Name</span>
              <TextInput
                value={editor.name}
                onChange={(event) =>
                  setEditor({ ...editor, name: event.currentTarget.value })
                }
                placeholder="e.g. Main cast"
                autoFocus
              />
            </label>
            <div className={classes.field}>
              <span className={classes.fieldLabel}>Characters</span>
              <MultiSelect
                data={characterOptions}
                value={editor.characterIds}
                onChange={(characterIds) =>
                  setEditor({ ...editor, characterIds })
                }
                searchable
                clearable
                placeholder="Pick characters for this folder"
              />
            </div>
            <div className={classes.footer}>
              <Button
                type="button"
                variant="default"
                onClick={() => setEditor(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        opened={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete folder"
        size="sm"
      >
        <p className={classes.intro}>
          Delete <strong>{deleteTarget?.name || "this folder"}</strong>? Characters
          stay — only the folder is removed.
        </p>
        <div className={classes.footer}>
          <Button
            type="button"
            variant="default"
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="dangerSolid"
            onClick={handleConfirmDelete}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
