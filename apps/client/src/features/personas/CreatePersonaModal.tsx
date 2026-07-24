import { useState } from "react";
import { Button, Group, Modal, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "@tanstack/react-router";
import { defaultPersona } from "@ai-hub/shared";
import { useCreatePersona } from "./queries";

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
    <Modal opened={opened} onClose={handleClose} title="New persona" centered>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <TextInput
          label="Name"
          description="Player display name for `{{user}}`."
          placeholder="You"
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
