import { useMemo } from "react";
import {
  Divider,
  MultiSelect,
  Select,
  Stack,
  Switch,
  TextInput,
  Textarea,
} from "@mantine/core";
import {
  GROUP_CHAT_MODE_LABELS,
  GROUP_CHAT_MODES,
  GROUP_RESPONSE_ORDER_LABELS,
  GROUP_RESPONSE_ORDERS,
  type Chat,
  type ChatSettings,
  type GroupChatMode,
  type GroupResponseOrder,
} from "@ai-hub/shared";
import { useAgents } from "@/features/agents/queries";
import { useCharacters } from "@/features/characters/queries";
import { useConnections } from "@/features/connections/queries";
import { useLorebooks } from "@/features/lorebooks/queries";
import { usePersonas } from "@/features/personas/queries";
import { usePresets } from "@/features/presets/queries";
import { useUpdateChat } from "./queries";

type ChatSettingsPanelProps = {
  chat: Chat;
};

export function ChatSettingsPanel({ chat }: ChatSettingsPanelProps) {
  const updateMutation = useUpdateChat();
  const connectionsQuery = useConnections();
  const presetsQuery = usePresets();
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const lorebooksQuery = useLorebooks();
  const agentsQuery = useAgents();

  const connectionOptions = useMemo(
    () =>
      (connectionsQuery.data ?? []).map((item) => ({
        value: item.id,
        label: item.name || "Unnamed",
      })),
    [connectionsQuery.data],
  );

  const presetOptions = useMemo(
    () =>
      (presetsQuery.data ?? [])
        .filter((item) => item.category === chat.mode)
        .map((item) => ({
          value: item.id,
          label: item.name || "Unnamed",
        })),
    [presetsQuery.data, chat.mode],
  );

  const characterOptions = useMemo(
    () =>
      (charactersQuery.data ?? []).map((item) => ({
        value: item.id,
        label: item.name || "Unnamed",
      })),
    [charactersQuery.data],
  );

  const personaOptions = useMemo(
    () =>
      (personasQuery.data ?? []).map((item) => ({
        value: item.id,
        label: item.name || "Unnamed",
      })),
    [personasQuery.data],
  );

  const lorebookOptions = useMemo(
    () =>
      (lorebooksQuery.data ?? []).map((item) => ({
        value: item.id,
        label: item.name || "Unnamed",
      })),
    [lorebooksQuery.data],
  );

  const agentOptions = useMemo(() => {
    const groups = ["writer", "tracker", "misc"] as const;
    const agents = agentsQuery.data ?? [];
    return groups.flatMap((category) =>
      agents
        .filter((agent) => agent.category === category)
        .map((agent) => ({
          value: agent.id,
          label: `${agent.name} (${category})`,
        })),
    );
  }, [agentsQuery.data]);

  const groupModeOptions = useMemo(
    () =>
      GROUP_CHAT_MODES.map((value) => ({
        value,
        label: GROUP_CHAT_MODE_LABELS[value],
      })),
    [],
  );

  const responseOrderOptions = useMemo(
    () =>
      GROUP_RESPONSE_ORDERS.map((value) => ({
        value,
        label: GROUP_RESPONSE_ORDER_LABELS[value],
      })),
    [],
  );

  const isGroup = chat.settings.character_ids.length > 1;

  function patchSettings(partial: Partial<ChatSettings>) {
    updateMutation.mutate({
      id: chat.id,
      input: {
        settings: {
          ...chat.settings,
          ...partial,
        },
      },
    });
  }

  return (
    <Stack gap="sm">
      <TextInput
        label="Title"
        defaultValue={chat.title}
        key={`title-${chat.id}-${chat.updated_at}`}
        onBlur={(event) => {
          const title = event.currentTarget.value.trim();
          if (title !== chat.title) {
            updateMutation.mutate({ id: chat.id, input: { title } });
          }
        }}
      />
      <Select
        label="Connection"
        data={connectionOptions}
        value={chat.settings.connection_id}
        onChange={(value) => patchSettings({ connection_id: value })}
        clearable
        searchable
        placeholder="Default connection"
      />
      <Select
        label="Preset"
        data={presetOptions}
        value={chat.settings.preset_id}
        onChange={(value) => patchSettings({ preset_id: value })}
        clearable
        searchable
        placeholder={`Default ${chat.mode} preset`}
      />
      <MultiSelect
        label="Characters"
        description="First selected is primary ({{char}})."
        data={characterOptions}
        value={chat.settings.character_ids}
        onChange={(value) => patchSettings({ character_ids: value })}
        searchable
        clearable
        placeholder={chat.mode === "roleplay" ? "Required" : "Optional"}
      />

      {isGroup ? (
        <>
          <Divider label="Group Chat" labelPosition="left" />
          <Select
            label="Group mode"
            description="Merged = one reply for all. Individual = separate reply per character."
            data={groupModeOptions}
            value={chat.settings.group_mode}
            onChange={(value) => {
              if (!value) return;
              patchSettings({ group_mode: value as GroupChatMode });
            }}
          />
          {chat.settings.group_mode === "individual" ? (
            <>
              <Select
                label="Response order"
                description="Sequential = all members. Smart = model picks. Manual = picker / @mention only."
                data={responseOrderOptions}
                value={chat.settings.response_order}
                onChange={(value) => {
                  if (!value) return;
                  patchSettings({
                    response_order: value as GroupResponseOrder,
                  });
                }}
              />
              <Switch
                label="Add turn to prompt"
                description='Append "Respond ONLY as {name}." for each Individual turn.'
                checked={chat.settings.add_turn_to_prompt}
                onChange={(event) =>
                  patchSettings({
                    add_turn_to_prompt: event.currentTarget.checked,
                  })
                }
              />
            </>
          ) : null}
          <Textarea
            label="Scenario override"
            description="Replaces each character's card scenario in the prompt when non-empty."
            minRows={3}
            autosize
            defaultValue={chat.settings.scenario_override}
            key={`scenario-override-${chat.id}-${chat.updated_at}`}
            onBlur={(event) => {
              const scenario_override = event.currentTarget.value;
              if (scenario_override !== chat.settings.scenario_override) {
                patchSettings({ scenario_override });
              }
            }}
          />
        </>
      ) : null}

      <Select
        label="Persona"
        data={personaOptions}
        value={chat.settings.persona_id}
        onChange={(value) => patchSettings({ persona_id: value })}
        clearable
        searchable
        placeholder="Default persona"
      />
      <MultiSelect
        label="Lorebooks"
        data={lorebookOptions}
        value={chat.settings.lorebook_ids}
        onChange={(value) => patchSettings({ lorebook_ids: value })}
        searchable
        clearable
      />
      <Divider label="Agents" labelPosition="left" />
      <MultiSelect
        label="Active agents"
        description="Post-processing rewriters and trackers run after each reply."
        data={agentOptions}
        value={chat.settings.agent_ids}
        onChange={(value) => patchSettings({ agent_ids: value })}
        searchable
        clearable
      />
      <Textarea
        label="Summary"
        description="Injected into chat_summary marker"
        minRows={3}
        defaultValue={chat.summary}
        key={`summary-${chat.id}-${chat.updated_at}`}
        onBlur={(event) => {
          const summary = event.currentTarget.value;
          if (summary !== chat.summary) {
            updateMutation.mutate({ id: chat.id, input: { summary } });
          }
        }}
      />
    </Stack>
  );
}
