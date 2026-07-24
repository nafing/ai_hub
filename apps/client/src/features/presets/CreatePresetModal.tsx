import { useState } from "react";
import { Button, Group, Modal, Select, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "@tanstack/react-router";
import {
  PRESET_CATEGORIES,
  PRESET_CATEGORY_LABELS,
  defaultPreset,
  type PresetCategory,
} from "@ai-hub/shared";
import { useCreatePreset } from "./queries";

type CreatePresetModalProps = {
  opened: boolean;
  onClose: () => void;
};

export function CreatePresetModal({
  opened,
  onClose,
}: CreatePresetModalProps) {
  const navigate = useNavigate();
  const createMutation = useCreatePreset();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PresetCategory>("roleplay");

  function handleClose() {
    setName("");
    setCategory("roleplay");
    onClose();
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      const created = await createMutation.mutateAsync({
        ...defaultPreset(),
        name: trimmed,
        category,
      });
      notifications.show({
        title: "Created",
        message: "Preset created.",
        color: "green",
      });
      handleClose();
      await navigate({
        to: "/presets/$presetId",
        params: { presetId: created.id },
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
    <Modal opened={opened} onClose={handleClose} title="New preset" centered>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <TextInput
          label="Name"
          description="The display name for this preset."
          placeholder="My preset"
          data-autofocus
          required
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Select
          mt="md"
          label="Category"
          description="Where this preset is intended to be used."
          data={PRESET_CATEGORIES.map((value) => ({
            value,
            label: PRESET_CATEGORY_LABELS[value],
          }))}
          value={category}
          allowDeselect={false}
          onChange={(value) => {
            if (value) setCategory(value as PresetCategory);
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
