import { useState } from "react";
import { Button, Group, Modal, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "@tanstack/react-router";
import { defaultTool } from "@ai-hub/shared";
import { useCreateTool } from "./queries";

type CreateToolModalProps = {
  opened: boolean;
  onClose: () => void;
};

export function CreateToolModal({ opened, onClose }: CreateToolModalProps) {
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
    <Modal opened={opened} onClose={handleClose} title="New tool" centered>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <TextInput
          label="Name"
          description="LLM function name (snake_case). Must be unique."
          placeholder="my_custom_tool"
          data-autofocus
          required
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
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
            disabled={!name.trim()}
          >
            Create
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
