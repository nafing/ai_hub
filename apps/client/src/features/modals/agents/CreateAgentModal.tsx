import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { defaultAgent, slugifyAgentName } from "@ai-hub/shared";
import { Button, Modal, TextInput, notifications } from "@/components/ui";
import { useCreateAgent } from "@/features/api-queries/agents/queries";
import classes from "./CreateAgentModal.module.css";

type CreateAgentModalProps = {
  opened: boolean;
  onClose: () => void;
};

export function CreateAgentModal({ opened, onClose }: CreateAgentModalProps) {
  const navigate = useNavigate();
  const createMutation = useCreateAgent();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyAgentName(name));
    }
  }, [name, slugTouched]);

  function handleClose() {
    setName("");
    setSlug("");
    setSlugTouched(false);
    onClose();
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    if (!trimmedName || !trimmedSlug) return;

    try {
      const created = await createMutation.mutateAsync({
        ...defaultAgent(),
        name: trimmedName,
        slug: trimmedSlug,
      });
      notifications.show({
        title: "Created",
        message: "Agent created.",
        color: "green",
      });
      handleClose();
      await navigate({
        to: "/agents/$agentId",
        params: { agentId: created.id },
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
    <Modal opened={opened} onClose={handleClose} title="New agent" size="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <label className={classes.field}>
          <span className={classes.fieldLabel}>Name</span>
          <p className={classes.fieldHint}>
            Display name shown in the hub and chat settings.
          </p>
          <TextInput
            placeholder="My Agent"
            required
            autoFocus
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label className={classes.fieldSpaced}>
          <span className={classes.fieldLabel}>Slug</span>
          <p className={classes.fieldHint}>
            Stable kebab-case id. Must be unique.
          </p>
          <TextInput
            className={classes.mono}
            placeholder="my-agent"
            required
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.currentTarget.value);
            }}
          />
        </label>
        <div className={classes.actions}>
          <Button variant="default" type="button"
            onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit"
            disabled={
              !name.trim() || !slug.trim() || createMutation.isPending
            }>
            {createMutation.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
