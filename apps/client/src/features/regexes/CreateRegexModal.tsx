import { useState } from "react";
import { Button, Group, Modal, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "@tanstack/react-router";
import { defaultRegexScript } from "@ai-hub/shared";
import { useCreateRegex } from "./queries";

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
    <Modal opened={opened} onClose={handleClose} title="New regex" centered>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <TextInput
          label="Name"
          description="e.g. Strip markdown italics, Remove OOC, Censor list."
          placeholder="My regex script"
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
