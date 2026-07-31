import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  GENERATOR_CATEGORIES,
  PRESET_CATEGORY_LABELS,
  defaultGeneratorPreset,
  defaultPresetId,
  type GeneratorCategory,
} from "@ai-hub/shared";
import { Button, Modal, Select, TextInput, notifications } from "@/components/ui";
import { useCreateGeneratorPreset } from "./queries";
import classes from "./CreateGeneratorPresetModal.module.css";

type CreateGeneratorPresetModalProps = {
  opened: boolean;
  onClose: () => void;
  defaultCategory?: GeneratorCategory;
};

export function CreateGeneratorPresetModal({
  opened,
  onClose,
  defaultCategory = "character_generator",
}: CreateGeneratorPresetModalProps) {
  const navigate = useNavigate();
  const createMutation = useCreateGeneratorPreset();
  const [name, setName] = useState("");
  const [category, setCategory] =
    useState<GeneratorCategory>(defaultCategory);

  useEffect(() => {
    if (!opened) return;
    setName("");
    setCategory(defaultCategory);
  }, [opened, defaultCategory]);

  const categoryOptions = useMemo(
    () =>
      GENERATOR_CATEGORIES.map((value) => ({
        value,
        label: PRESET_CATEGORY_LABELS[value],
      })),
    [],
  );

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
        ...defaultGeneratorPreset(category),
        name: trimmed,
        category,
        preset_id: defaultPresetId(category),
      });
      notifications.show({
        title: "Created",
        message: "Generator preset created.",
        color: "green",
      });
      handleClose();
      await navigate({
        to: "/presets/generator/$generatorPresetId",
        params: { generatorPresetId: created.id },
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
      title="New generator preset"
      size="sm"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <label className={classes.field}>
          <span className={classes.fieldLabel}>Name</span>
          <p className={classes.fieldHint}>
            Display name for this generator prompt pack.
          </p>
          <TextInput
            placeholder="My generator"
            required
            autoFocus
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <div className={classes.fieldSpaced}>
          <span className={classes.fieldLabel}>Category</span>
          <p className={classes.fieldHint}>
            Which generator pipeline this prompt targets.
          </p>
          <Select
            data={categoryOptions}
            value={category}
            onChange={(value) => {
              if (value) setCategory(value as GeneratorCategory);
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
