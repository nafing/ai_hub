import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { defaultRegexScript } from "@ai-hub/shared";
import { Button, Modal, TextInput, notifications } from "@/components/ui";
import { useCreateRegex } from "@/features/api-queries/regexes/queries";
import classes from "./CreateRegexModal.module.css";

type CreateRegexModalProps = {
  opened: boolean;
  onClose: () => void;
};

export function CreateRegexModal({ opened, onClose }: CreateRegexModalProps) {
  const navigate = useNavigate();
  const createMutation = useCreateRegex();
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
        ...defaultRegexScript(),
        name: trimmed,
      });
      notifications.show({
        title: "Created",
        message: "Regex script created.",
        color: "green",
      });
      handleClose();
      await navigate({
        to: "/regexes/$regexId",
        params: { regexId: created.id },
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
    <Modal opened={opened} onClose={handleClose} title="New regex" size="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <label className={classes.field}>
          <span className={classes.fieldLabel}>Name</span>
          <p className={classes.fieldHint}>
            e.g. Strip markdown italics, Remove OOC, Censor list.
          </p>
          <TextInput
            placeholder="My regex script"
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
