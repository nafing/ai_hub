import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  type ChatMode,
  type CreateChatInput,
} from "@ai-hub/shared";
import { Button,
  Modal,
  MultiSelect,
  Select,
  TextInput,
  notifications,
  RuntimeText,
} from "@/components/ui";
import { useCharacters } from "@/features/characters/queries";
import { useConnections } from "@/features/connections/queries";
import { usePersonas } from "@/features/personas/queries";
import { useDefaultPreset, usePresets } from "@/features/presets/queries";
import { useCreateChat } from "./queries";
import classes from "./CreateChatModal.module.css";

type CreateChatModalProps = {
  opened: boolean;
  onClose: () => void;
};

export function CreateChatModal({ opened, onClose }: CreateChatModalProps) {
  const navigate = useNavigate();
  const createMutation = useCreateChat();
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const connectionsQuery = useConnections();
  const presetsQuery = usePresets();

  const [mode, setMode] = useState<ChatMode>("roleplay");
  const [title, setTitle] = useState("");
  const [characterIds, setCharacterIds] = useState<string[]>([]);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);

  const presetCategory = mode;
  const defaultPresetQuery = useDefaultPreset(presetCategory);

  const defaultConnectionId =
    connectionsQuery.data?.find((c) => c.is_default)?.id ??
    connectionsQuery.data?.[0]?.id ??
    null;
  const defaultPersonaId =
    personasQuery.data?.find((p) => p.is_default)?.id ?? null;

  useEffect(() => {
    if (!opened) return;
    setMode("roleplay");
    setTitle("");
    setCharacterIds([]);
    setPersonaId(defaultPersonaId);
    setConnectionId(defaultConnectionId);
    setPresetId(null);
  }, [opened, defaultPersonaId, defaultConnectionId]);

  useEffect(() => {
    if (!opened) return;
    if (defaultPresetQuery.data?.id) {
      setPresetId(defaultPresetQuery.data.id);
      return;
    }
    const fallback = (presetsQuery.data ?? []).find(
      (p) => p.category === presetCategory,
    );
    if (fallback) setPresetId(fallback.id);
  }, [
    opened,
    mode,
    presetCategory,
    defaultPresetQuery.data?.id,
    presetsQuery.data,
  ]);

  const characterOptions = useMemo(
    () =>
      (charactersQuery.data ?? []).map((character) => ({
        value: character.id,
        label: character.name || "Unnamed",
      })),
    [charactersQuery.data],
  );

  const personaOptions = useMemo(
    () =>
      (personasQuery.data ?? []).map((persona) => ({
        value: persona.id,
        label: persona.name || "Unnamed",
      })),
    [personasQuery.data],
  );

  const connectionOptions = useMemo(
    () =>
      (connectionsQuery.data ?? []).map((connection) => ({
        value: connection.id,
        label: connection.name || "Unnamed",
      })),
    [connectionsQuery.data],
  );

  const presetOptions = useMemo(
    () =>
      (presetsQuery.data ?? [])
        .filter((preset) => preset.category === presetCategory)
        .map((preset) => ({
          value: preset.id,
          label: preset.name || "Unnamed",
        })),
    [presetsQuery.data, presetCategory],
  );

  async function handleCreate() {
    if (mode === "roleplay" && characterIds.length === 0) {
      notifications.show({
        title: "Character required",
        message: "Pick at least one character for roleplay chats.",
        color: "red",
      });
      return;
    }

    const input: CreateChatInput = {
      mode,
      title: title.trim() || undefined,
      settings: {
        character_ids: characterIds,
        persona_id: personaId,
        connection_id: connectionId,
        preset_id: presetId,
      },
    };

    try {
      const chat = await createMutation.mutateAsync(input);
      notifications.show({
        title: "Chat created",
        message: chat.title,
        color: "green",
      });
      onClose();
      void navigate({
        to: "/chats/$chatId",
        params: { chatId: chat.id },
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
    <Modal opened={opened} onClose={onClose} title="New chat" size="md">
      <div className={classes.stack}>
        <div className={classes.segmented} role="group" aria-label="Chat mode">
          <Button
            type="button"
            variant={mode === "roleplay" ? "light" : "ghost"}
            size="sm"
            className={`${classes.segment}${mode === "roleplay" ? ` ${classes.segmentActive}` : ""}`}
            onClick={() => setMode("roleplay")}
          >
            Roleplay
          </Button>
          <Button
            type="button"
            variant={mode === "conversation" ? "light" : "ghost"}
            size="sm"
            className={`${classes.segment}${mode === "conversation" ? ` ${classes.segmentActive}` : ""}`}
            onClick={() => setMode("conversation")}
          >
            Conversation
          </Button>
        </div>

        <label className={classes.field}>
          <span className={classes.fieldLabel}>Title</span>
          <TextInput
            placeholder={
              mode === "roleplay"
                ? "Defaults to character names"
                : "Conversation"
            }
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
        </label>

        <div className={classes.field}>
          <span className={classes.fieldLabel}>Characters</span>
          <p className={classes.fieldHint}>
            First selected is primary (
            <RuntimeText>{"{{char}}"}</RuntimeText>
            ). Each character opens with their greeting and alternate greetings
            as swipes.
          </p>
          <MultiSelect
            placeholder="Select characters"
            data={characterOptions}
            value={characterIds}
            onChange={setCharacterIds}
            searchable
            clearable
          />
        </div>

        <div className={classes.field}>
          <span className={classes.fieldLabel}>Persona</span>
          <Select
            placeholder="Default persona"
            data={personaOptions}
            value={personaId ?? ""}
            onChange={(value) => setPersonaId(value || null)}
            searchable
            clearable
          />
        </div>

        <div className={classes.field}>
          <span className={classes.fieldLabel}>Connection</span>
          <Select
            placeholder="Default connection"
            data={connectionOptions}
            value={connectionId ?? ""}
            onChange={(value) => setConnectionId(value || null)}
            searchable
            clearable
          />
        </div>

        <div className={classes.field}>
          <span className={classes.fieldLabel}>Preset</span>
          <Select
            placeholder={`Default ${mode} preset`}
            data={presetOptions}
            value={presetId ?? ""}
            onChange={(value) => setPresetId(value || null)}
            searchable
            clearable
          />
        </div>

        <div className={classes.actions}>
          <Button variant="default" type="button"
            onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="button"
            disabled={createMutation.isPending}
            onClick={() => void handleCreate()}
          >
            {createMutation.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
