import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  nextCharacterVersionLabel,
  toCharacterCardV2,
  type CharacterVersion,
} from "@ai-hub/shared";
import { Button, Modal, notifications } from "@/components/ui";
import { api } from "@/lib/api";
import { CharacterForm } from "@/features/characters/CharacterForm";
import { characterAvatarSrc } from "@/features/characters/avatar-url";
import { LinkedLorebooksPanel } from "@/features/lorebooks/CharacterLinkedLorebooks";
import {
  useCharacter,
  useDeleteCharacter,
  useDeleteCharacterAvatar,
  useDeleteCharacterVersion,
  useUpdateCharacter,
  useUploadCharacterAvatar,
} from "@/features/characters/queries";
import classes from "./index.module.css";

const FORM_ID = "character-edit-form";

export const Route = createFileRoute("/_app/characters/$characterId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { characterId } = Route.useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteVersionOpen, setDeleteVersionOpen] = useState(false);
  const { data, isLoading, isError } = useCharacter(characterId);
  const updateMutation = useUpdateCharacter();
  const deleteMutation = useDeleteCharacter();
  const deleteVersionMutation = useDeleteCharacterVersion();
  const uploadAvatarMutation = useUploadCharacterAvatar();
  const deleteAvatarMutation = useDeleteCharacterAvatar();
  const saveModeRef = useRef<"update" | "new">("update");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!data) return;
    setSelectedVersionId((current) => {
      if (current && data.versions.some((version) => version.id === current)) {
        return current;
      }
      return data.active_version_id;
    });
  }, [data]);

  const selectedVersion: CharacterVersion | null = useMemo(() => {
    if (!data || !selectedVersionId) return null;
    return (
      data.versions.find((version) => version.id === selectedVersionId) ??
      data.versions.find((version) => version.id === data.active_version_id) ??
      data.versions[data.versions.length - 1] ??
      null
    );
  }, [data, selectedVersionId]);

  const versionOptions = useMemo(
    () =>
      (data?.versions ?? []).map((version) => ({
        value: version.id,
        label:
          version.id === data?.active_version_id
            ? `${version.label} (active)`
            : version.label,
      })),
    [data],
  );

  function handleConfirmDelete() {
    setDeleteOpen(false);
    deleteMutation.mutate(characterId, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Character removed.",
          color: "green",
        });
        void navigate({ to: "/characters" });
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

  function handleExport() {
    if (!data) return;
    const card = toCharacterCardV2(data);
    const blob = new Blob([JSON.stringify(card, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.data.name || "character"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleAvatarUpload(file: File | null) {
    if (!file) return;
    try {
      await uploadAvatarMutation.mutateAsync({ id: characterId, file });
      notifications.show({
        title: "Avatar updated",
        message: "PNG saved on the server.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Avatar upload failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  async function handleAvatarRemove() {
    try {
      await deleteAvatarMutation.mutateAsync(characterId);
      notifications.show({
        title: "Avatar removed",
        message: "PNG deleted from the server.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Remove failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  function handleVersionChange(versionId: string) {
    if (!data || versionId === selectedVersionId) return;
    setSelectedVersionId(versionId);
  }

  function handleConfirmDeleteVersion() {
    if (!data || !selectedVersion) return;
    const versionId = selectedVersion.id;
    const label = selectedVersion.label;
    setDeleteVersionOpen(false);
    deleteVersionMutation.mutate(
      { id: data.id, versionId },
      {
        onSuccess: (character) => {
          setSelectedVersionId(character.active_version_id);
          notifications.show({
            title: "Version deleted",
            message: `Removed version ${label}.`,
            color: "green",
          });
        },
        onError: (error) => {
          notifications.show({
            title: "Delete version failed",
            message: error instanceof Error ? error.message : "Unknown error",
            color: "red",
          });
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className={classes.loading}>
        <div className={classes.spinner} aria-label="Loading" />
      </div>
    );
  }

  if (isError || !data || !selectedVersion) {
    return <p className={classes.error}>Character not found.</p>;
  }

  const avatarSrc = characterAvatarSrc(data.avatar, String(api.defaults.baseURL));
  const formValues = {
    spec: data.spec,
    spec_version: data.spec_version,
    data: selectedVersion.data,
  };

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h2 className={classes.title}>
            {selectedVersion.data.name || "Edit character"}
          </h2>
          <p className={classes.subtitle}>
            Metadata, prompt fields, and version history (
            {data.versions.length}{" "}
            {data.versions.length === 1 ? "version" : "versions"}).
          </p>
        </div>
        <div className={classes.actions}>
          <Button variant="default" type="button" onClick={handleExport}>
            Export
          </Button>
          <Button
            variant="default"
            type="submit"
            form={FORM_ID}
            disabled={updateMutation.isPending}
            onClick={() => {
              saveModeRef.current = "new";
            }}
          >
            Save as new version
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={FORM_ID}
            disabled={updateMutation.isPending}
            onClick={() => {
              saveModeRef.current = "update";
            }}
          >
            {updateMutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="danger"
            type="button"
            onClick={() => setDeleteOpen(true)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </header>

      <CharacterForm
        key={`${data.id}:${selectedVersion.id}`}
        formId={FORM_ID}
        initialValues={formValues}
        versionSelect={{
          options: versionOptions,
          value: selectedVersion.id,
          onChange: (versionId) => {
            void handleVersionChange(versionId);
          },
          onDelete:
            data.versions.length > 1
              ? () => setDeleteVersionOpen(true)
              : undefined,
          deleteDisabled: data.versions.length <= 1,
          deletePending: deleteVersionMutation.isPending,
        }}
        lorebooksSection={
          <LinkedLorebooksPanel
            entityId={data.id}
            linkField="linked_characters"
            entityLabel="character"
          />
        }
        avatarSection={
          <div className={classes.avatarSection}>
            <div className={classes.avatarFrame}>
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className={classes.avatarImage} />
              ) : (
                <p className={classes.avatarPlaceholder}>No avatar</p>
              )}
            </div>
            <div className={classes.avatarMeta}>
              <p className={classes.avatarLabel}>Avatar</p>
              <p className={classes.avatarHint}>
                Stored as PNG on the server. Not part of the card JSON.
              </p>
              <div className={classes.avatarActions}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,.png"
                  className={classes.hiddenFileInput}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    event.currentTarget.value = "";
                    void handleAvatarUpload(file);
                  }}
                />
                <Button
                  variant="default"
                  size="sm"
                  type="button"
                  disabled={uploadAvatarMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadAvatarMutation.isPending
                    ? "Uploading…"
                    : "Upload PNG"}
                </Button>
                {data.avatar ? (
                  <Button
                    variant="subtle"
                    size="sm"
                    type="button"
                    disabled={deleteAvatarMutation.isPending}
                    onClick={() => void handleAvatarRemove()}
                  >
                    {deleteAvatarMutation.isPending ? "Removing…" : "Remove"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        }
        onSubmit={async (values) => {
          const createVersion = saveModeRef.current === "new";
          saveModeRef.current = "update";

          const versionLabel = createVersion
            ? nextCharacterVersionLabel(
                data.versions.map((version) => version.label),
              )
            : selectedVersion.label;

          try {
            const updated = await updateMutation.mutateAsync({
              id: data.id,
              input: {
                data: {
                  ...values.data,
                  character_version: versionLabel,
                },
                active_version_id: createVersion
                  ? undefined
                  : selectedVersion.id,
                create_version: createVersion,
                version_label: versionLabel,
              },
            });
            setSelectedVersionId(updated.active_version_id);
            notifications.show({
              title: createVersion ? "Version created" : "Saved",
              message: createVersion
                ? `Saved as version ${versionLabel}.`
                : "Character version updated.",
              color: "green",
            });
          } catch (error) {
            notifications.show({
              title: "Save failed",
              message:
                error instanceof Error ? error.message : "Unknown error",
              color: "red",
            });
          }
        }}
      />

      <Modal
        opened={deleteVersionOpen}
        onClose={() => setDeleteVersionOpen(false)}
        title="Delete version"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete version{" "}
          <strong>{selectedVersion.label || "this version"}</strong>? This
          cannot be undone.
          {selectedVersion.id === data.active_version_id
            ? " It is currently active — another version will become active."
            : null}
        </p>
        <div className={classes.modalActions}>
          <Button
            variant="default"
            type="button"
            onClick={() => setDeleteVersionOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="dangerSolid"
            type="button"
            onClick={handleConfirmDeleteVersion}
          >
            Delete version
          </Button>
        </div>
      </Modal>

      <Modal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete character"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{data.data.name || "this character"}</strong>? This
          cannot be undone.
        </p>
        <div className={classes.modalActions}>
          <Button
            variant="default"
            type="button"
            onClick={() => setDeleteOpen(false)}
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
