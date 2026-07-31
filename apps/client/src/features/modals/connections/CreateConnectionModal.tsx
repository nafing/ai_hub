import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CONNECTION_KIND_LABELS,
  defaultConnectionForKind,
  type ConnectionKind,
} from "@ai-hub/shared";
import { Button, Modal, TextInput, notifications } from "@/components/ui";
import { useCreateConnection } from "@/features/api-queries/connections/queries";
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
  const [kind, setKind] = useState<ConnectionKind>("llm");

  function handleClose() {
    setName("");
    setKind("llm");
    onClose();
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      const created = await createMutation.mutateAsync({
        ...defaultConnectionForKind(kind),
        name: trimmed,
        kind,
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
        <div className={classes.kindRow}>
          {(["llm", "image"] as const).map((option) => (
            <Button
              key={option}
              type="button"
              variant={kind === option ? "light" : "ghost"}
              size="sm"
              className={`${classes.kindSegment}${kind === option ? ` ${classes.kindSegmentActive}` : ""}`}
              onClick={() => setKind(option)}
            >
              {CONNECTION_KIND_LABELS[option]}
            </Button>
          ))}
        </div>

        <label className={classes.field}>
          <span className={classes.fieldLabel}>Name</span>
          <p className={classes.fieldHint}>
            {kind === "image"
              ? "A friendly name like 'Seedream — avatars'."
              : "A friendly name like 'Claude Sonnet — RP' or 'GPT-4o Main'."}
          </p>
          <TextInput
            placeholder={
              kind === "image" ? "My image connection" : "My connection"
            }
            required
            autoFocus
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <div className={classes.actions}>
          <Button variant="default" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!name.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
