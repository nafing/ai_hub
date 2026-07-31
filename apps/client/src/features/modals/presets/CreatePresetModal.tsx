import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  PRESET_CATEGORIES,
  PRESET_CATEGORY_LABELS,
  defaultPreset,
  type PresetCategory,
} from "@ai-hub/shared";
import { Button, Modal, Select, TextInput, notifications } from "@/components/ui";
import { useCreatePreset } from "@/features/api-queries/presets/queries";
import classes from "./CreatePresetModal.module.css";

type CreatePresetModalProps = {
  opened: boolean;
  onClose: () => void;
  defaultCategory?: PresetCategory;
};

export function CreatePresetModal({
  opened,
  onClose,
  defaultCategory = "roleplay",
}: CreatePresetModalProps) {
  const navigate = useNavigate();
  const createMutation = useCreatePreset();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PresetCategory>(defaultCategory);

  useEffect(() => {
    if (!opened) return;
    setName("");
    setCategory(defaultCategory);
  }, [opened, defaultCategory]);

  function handleClose() {
    setName("");
    setCategory(defaultCategory);
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
    <Modal opened={opened} onClose={handleClose} title="New preset" size="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <label className={classes.field}>
          <span className={classes.fieldLabel}>Name</span>
          <p className={classes.fieldHint}>
            The display name for this preset.
          </p>
          <TextInput
            placeholder="My preset"
            required
            autoFocus
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <div className={classes.fieldSpaced}>
          <span className={classes.fieldLabel}>Category</span>
          <p className={classes.fieldHint}>
            Where this preset is intended to be used.
          </p>
          <Select
            data={PRESET_CATEGORIES.map((value) => ({
              value,
              label: PRESET_CATEGORY_LABELS[value],
            }))}
            value={category}
            onChange={(value) => {
              if (value) setCategory(value as PresetCategory);
            }}
          />
        </div>
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
