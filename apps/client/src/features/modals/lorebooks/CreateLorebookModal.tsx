import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { defaultLorebook } from "@ai-hub/shared";
import { Button, Modal, TextInput, notifications } from "@/components/ui";
import { useCreateLorebook } from "@/features/api-queries/lorebooks/queries";
import classes from "./CreateLorebookModal.module.css";

type CreateLorebookModalProps = {
  opened: boolean;
  onClose: () => void;
};

export function CreateLorebookModal({
  opened,
  onClose,
}: CreateLorebookModalProps) {
  const navigate = useNavigate();
  const createMutation = useCreateLorebook();
  const [name, setName] = useState("");

  function handleClose() {
    setName("");
    onClose();
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      const created = await createMutation.mutateAsync(
        defaultLorebook({ name: trimmedName }),
      );
      notifications.show({
        title: "Created",
        message: "Lorebook created.",
        color: "green",
      });
      handleClose();
      await navigate({
        to: "/lorebooks/$lorebookId",
        params: { lorebookId: created.id },
      });
    } catch (error) {
      notifications.show({
        title: "Create failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="New lorebook" size="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <label className={classes.field}>
          <span className={classes.fieldLabel}>Name</span>
          <p className={classes.fieldHint}>
            Display name for this world / lore book.
          </p>
          <TextInput
            placeholder="World Lore"
            required
            autoFocus
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <div className={classes.actions}>
          <Button variant="default" type="button"
            onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit"
            disabled={!name.trim() || createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
