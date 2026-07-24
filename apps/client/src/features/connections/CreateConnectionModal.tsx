import { useState } from "react";
import { Button, Group, Modal, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "@tanstack/react-router";
import { defaultConnection } from "@ai-hub/shared";
import { useCreateConnection } from "./queries";

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
      centered
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <TextInput
          label="Name"
          description="A friendly name like 'Claude Sonnet — RP' or 'GPT-4o Main'."
          placeholder="My connection"
          data-autofocus
          required
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={createMutation.isPending}
            disabled={!name.trim()}
          >
            Create
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
