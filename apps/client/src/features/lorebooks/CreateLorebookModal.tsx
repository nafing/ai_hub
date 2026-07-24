import { useState } from "react";
import { Button, Group, Modal, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "@tanstack/react-router";
import { defaultLorebook } from "@ai-hub/shared";
import { useCreateLorebook } from "./queries";

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
    <Modal opened={opened} onClose={handleClose} title="New lorebook" centered>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <TextInput
          label="Name"
          description="Display name for this world / lore book."
          placeholder="World Lore"
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
