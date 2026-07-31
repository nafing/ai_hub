import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { defaultPersona } from "@ai-hub/shared";
import { Button, Modal, TextInput, notifications, RuntimeText } from "@/components/ui";
import { useCreatePersona } from "./queries";
import classes from "./CreatePersonaModal.module.css";

type CreatePersonaModalProps = {
  opened: boolean;
  onClose: () => void;
};

export function CreatePersonaModal({
  opened,
  onClose,
}: CreatePersonaModalProps) {
  const navigate = useNavigate();
  const createMutation = useCreatePersona();
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
        defaultPersona({ name: trimmedName }),
      );
      notifications.show({
        title: "Created",
        message: "Persona created.",
        color: "green",
      });
      handleClose();
      await navigate({
        to: "/personas/$personaId",
        params: { personaId: created.id },
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
    <Modal opened={opened} onClose={handleClose} title="New persona" size="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <label className={classes.field}>
          <span className={classes.fieldLabel}>Name</span>
          <p className={classes.fieldHint}>
            Player display name for <RuntimeText>{"{{user}}"}</RuntimeText>.
          </p>
          <TextInput
            placeholder="You"
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
