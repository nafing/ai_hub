import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  TextInput,
  SegmentedControl,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "@tanstack/react-router";
import type { ChatMode, CreateChatInput } from "@ai-hub/shared";
import { useCharacters } from "@/features/characters/queries";
import { useConnections } from "@/features/connections/queries";
import { usePersonas } from "@/features/personas/queries";
import { useDefaultPreset, usePresets } from "@/features/presets/queries";
import { useCreateChat } from "./queries";

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

  const defaultPresetQuery = useDefaultPreset(mode);

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
    const fallback = (presetsQuery.data ?? []).find((p) => p.category === mode);
    if (fallback) setPresetId(fallback.id);
  }, [opened, mode, defaultPresetQuery.data?.id, presetsQuery.data]);

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
        .filter((preset) => preset.category === mode)
        .map((preset) => ({
          value: preset.id,
          label: preset.name || "Unnamed",
        })),
    [presetsQuery.data, mode],
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
      <Stack>
        <SegmentedControl
          value={mode}
          onChange={(value) => setMode(value as ChatMode)}
          data={[
            { label: "Roleplay", value: "roleplay" },
            { label: "Conversation", value: "conversation" },
          ]}
        />
        <TextInput
          label="Title"
          placeholder={
            mode === "roleplay"
              ? "Defaults to character names"
              : "Conversation"
          }
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
        <MultiSelect
          label="Characters"
          description="First selected is primary ({{char}}). Each character opens with their greeting and alternate greetings as swipes."
          placeholder="Select characters"
          data={characterOptions}
          value={characterIds}
          onChange={setCharacterIds}
          searchable
          clearable
          required
        />
        <Select
          label="Persona"
          placeholder="Default persona"
          data={personaOptions}
          value={personaId}
          onChange={setPersonaId}
          searchable
          clearable
        />
        <Select
          label="Connection"
          placeholder="Default connection"
          data={connectionOptions}
          value={connectionId}
          onChange={setConnectionId}
          searchable
          clearable
        />
        <Select
          label="Preset"
          placeholder={`Default ${mode} preset`}
          data={presetOptions}
          value={presetId}
          onChange={setPresetId}
          searchable
          clearable
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleCreate()}
            loading={createMutation.isPending}
          >
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
