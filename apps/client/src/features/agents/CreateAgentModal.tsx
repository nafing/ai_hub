import { useEffect, useState } from "react";
import { Button, Group, Modal, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "@tanstack/react-router";
import { defaultAgent, slugifyAgentName } from "@ai-hub/shared";
import { useCreateAgent } from "./queries";

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
    <Modal opened={opened} onClose={handleClose} title="New agent" centered>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <TextInput
          label="Name"
          description="Display name shown in the hub and chat settings."
          placeholder="My Agent"
          data-autofocus
          required
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          mb="sm"
        />
        <TextInput
          label="Slug"
          description="Stable kebab-case id. Must be unique."
          placeholder="my-agent"
          required
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.currentTarget.value);
          }}
          styles={{
            input: { fontFamily: "var(--mantine-font-family-monospace)" },
          }}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={createMutation.isPending}
            disabled={!name.trim() || !slug.trim()}
          >
            Create
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
