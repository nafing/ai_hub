import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { defaultTool, type Tool } from "@ai-hub/shared";
import { Button, Modal, TextInput, notifications } from "@/components/ui";
import { useCreateTool } from "./queries";
import classes from "./CreateToolModal.module.css";

type CreateToolModalProps = {
  opened: boolean;
  onClose: () => void;
  /** When set, called instead of navigating to the tool editor. */
  onCreated?: (tool: Tool) => void;
};

export function CreateToolModal({
  opened,
  onClose,
  onCreated,
}: CreateToolModalProps) {
  const navigate = useNavigate();
  const createMutation = useCreateTool();
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
        ...defaultTool(),
        name: trimmed,
      });
      notifications.show({
        title: "Created",
        message: "Tool created.",
        color: "green",
      });
      handleClose();
      if (onCreated) {
        onCreated(created);
        return;
      }
      await navigate({
        to: "/tools/$toolId",
        params: { toolId: created.id },
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
    <Modal opened={opened} onClose={handleClose} title="New tool" size="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <label className={classes.field}>
          <span className={classes.fieldLabel}>Name</span>
          <p className={classes.fieldHint}>
            LLM function name (snake_case). Must be unique.
          </p>
          <TextInput
            className={classes.mono}
            placeholder="my_custom_tool"
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
