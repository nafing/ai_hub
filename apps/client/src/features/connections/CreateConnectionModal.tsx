import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { defaultConnection } from "@ai-hub/shared";
import { Button, Modal, TextInput, notifications } from "@/components/ui";
import { useCreateConnection } from "./queries";
import classes from "./CreateConnectionModal.module.css";

type CreateConnectionModalProps = {
  opened: boolean;
  onClose: () => void;
};

export function CreateConnectionModal({
  opened,
  onClose,
}: CreateConnectionModalProps) {
  const navigate = useNavigate();
  const createMutation = useCreateConnection();
  const [name, setName] = useState("");

  function handleClose() {
    setName("");
    onClose();
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      const created = await createMutation.mutateAsync({
        ...defaultConnection(),
        name: trimmed,
      });
      notifications.show({
        title: "Created",
        message: "Connection created.",
        color: "green",
      });
      handleClose();
      await navigate({
        to: "/connections/$connectionId",
        params: { connectionId: created.id },
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
    <Modal
      opened={opened}
      onClose={handleClose}
      title="New connection"
      size="sm"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <label className={classes.field}>
          <span className={classes.fieldLabel}>Name</span>
          <p className={classes.fieldHint}>
            A friendly name like &apos;Claude Sonnet — RP&apos; or &apos;GPT-4o
            Main&apos;.
          </p>
          <TextInput
            placeholder="My connection"
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
