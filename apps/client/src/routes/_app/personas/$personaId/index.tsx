import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toPersonaExport } from "@ai-hub/shared";
import { Button, Modal, notifications } from "@/components/ui";
import { api } from "@/lib/api";
import { PersonaForm } from "@/features/personas/PersonaForm";
import { personaAvatarSrc } from "@/features/personas/avatar-url";
import { LinkedLorebooksPanel } from "@/features/lorebooks/CharacterLinkedLorebooks";
import {
  useDeletePersona,
  useDeletePersonaAvatar,
  usePersona,
  useUpdatePersona,
  useUploadPersonaAvatar,
} from "@/features/personas/queries";
import classes from "./index.module.css";

const FORM_ID = "persona-edit-form";

export const Route = createFileRoute("/_app/personas/$personaId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { personaId } = Route.useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data, isLoading, isError } = usePersona(personaId);
  const updateMutation = useUpdatePersona();
  const deleteMutation = useDeletePersona();
  const uploadAvatarMutation = useUploadPersonaAvatar();
  const deleteAvatarMutation = useDeletePersonaAvatar();

  function handleConfirmDelete() {
    setDeleteOpen(false);
    deleteMutation.mutate(personaId, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Persona removed.",
          color: "green",
        });
        void navigate({ to: "/personas" });
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
    const payload = toPersonaExport(data);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.name || "persona"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleAvatarUpload(file: File | null) {
    if (!file) return;
    try {
      await uploadAvatarMutation.mutateAsync({ id: personaId, file });
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
      await deleteAvatarMutation.mutateAsync(personaId);
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

  if (isLoading) {
    return (
      <div className={classes.loading}>
        <div className={classes.spinner} aria-label="Loading" />
      </div>
    );
  }

  if (isError || !data) {
    return <p className={classes.error}>Persona not found.</p>;
  }

  const { id, avatar, ...formValues } = data;
  const avatarSrc = personaAvatarSrc(avatar, String(api.defaults.baseURL));

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h2 className={classes.title}>{data.name || "Edit persona"}</h2>
          <p className={classes.subtitle}>Player persona.</p>
        </div>
        <div className={classes.actions}>
          <Button variant="default" type="button" onClick={handleExport}>
            Export
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={FORM_ID}
            disabled={updateMutation.isPending}
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

      <PersonaForm
        key={id}
        formId={FORM_ID}
        initialValues={formValues}
        lorebooksSection={
          <LinkedLorebooksPanel
            entityId={id}
            linkField="linked_personas"
            entityLabel="persona"
          />
        }
        avatarSection={
          <div className={classes.avatarSection}>
            <div className={classes.avatarFrame}>
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt=""
                  className={classes.avatarImage}
                />
              ) : (
                <p className={classes.avatarPlaceholder}>No avatar</p>
              )}
            </div>
            <div className={classes.avatarMeta}>
              <p className={classes.avatarLabel}>Avatar</p>
              <p className={classes.avatarHint}>
                Stored as PNG on the server. Not part of the persona JSON.
              </p>
              <div className={classes.avatarActions}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,.png"
                  className={classes.hiddenFileInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    void handleAvatarUpload(file);
                  }}
                />
                <Button variant="default" size="sm" type="button"
                  disabled={uploadAvatarMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadAvatarMutation.isPending
                    ? "Uploading…"
                    : "Upload PNG"}
                </Button>
                {avatar ? (
                  <Button variant="subtle" size="sm" type="button"
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
          try {
            await updateMutation.mutateAsync({ id, input: values });
            notifications.show({
              title: "Saved",
              message: "Persona updated.",
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
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete persona"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{data.name || "this persona"}</strong>? This cannot be
          undone.
        </p>
        <div className={classes.modalActions}>
          <Button variant="default" type="button"
            onClick={() => setDeleteOpen(false)}
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
