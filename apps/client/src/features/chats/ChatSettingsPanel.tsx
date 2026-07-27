import { useMemo, useState, type ReactNode } from "react";
import {
  GROUP_CHAT_MODE_LABELS,
  GROUP_CHAT_MODES,
  GROUP_RESPONSE_ORDER_LABELS,
  GROUP_RESPONSE_ORDERS,
  selectedVariableValues,
  type Chat,
  type ChatSettings,
  type GroupChatMode,
  type GroupResponseOrder,
  type PresetVariableValues,
  type Variable,
} from "@ai-hub/shared";
import { Button, MultiSelect, NumberInput, Select, Textarea, TextInput, Switch, RuntimeText } from "@/components/ui";
import { useAgents } from "@/features/agents/queries";
import { useCharacters } from "@/features/characters/queries";
import { useConnections } from "@/features/connections/queries";
import { useLorebooks } from "@/features/lorebooks/queries";
import { usePersonas } from "@/features/personas/queries";
import { SetupVariablesModal } from "@/features/presets/SetupVariablesModal";
import {
  useDefaultPreset,
  usePreset,
  usePresets,
} from "@/features/presets/queries";
import { useUpdateChat } from "./queries";
import classes from "./ChatSettingsPanel.module.css";

type ChatSettingsPanelProps = {
  chat: Chat;
};

/** Merge preset defaults + chat overrides into Variable.selected for the modal. */
function variablesWithValues(
  variables: Variable[],
  values: PresetVariableValues,
): Variable[] {
  return variables.map((variable) => {
    const name = variable.variable_name.trim();
    if (!name) return { ...variable };
    const provided = values[name];
    if (provided == null) return { ...variable };
    const entries = Array.isArray(provided)
      ? provided.filter(Boolean)
      : provided
        ? [provided]
        : [];
    const selected = entries.map((entry) => {
      const match = variable.options.find(
        (option) =>
          option.id === entry ||
          option.value === entry ||
          option.id.endsWith(`:${entry}`),
      );
      return match?.id ?? entry;
    });
    return { ...variable, selected };
  });
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={classes.field}>
      <span className={classes.fieldLabel}>{label}</span>
      {hint ? <p className={classes.fieldHint}>{hint}</p> : null}
      {children}
    </div>
  );
}

export function ChatSettingsPanel({ chat }: ChatSettingsPanelProps) {
  const updateMutation = useUpdateChat();
  const connectionsQuery = useConnections();
  const presetsQuery = usePresets();
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const lorebooksQuery = useLorebooks();
  const agentsQuery = useAgents();
  const [variablesOpen, setVariablesOpen] = useState(false);

  const presetId = chat.settings.preset_id;
  const selectedPresetQuery = usePreset(presetId ?? undefined);
  const defaultPresetQuery = useDefaultPreset(
    presetId ? undefined : chat.mode,
  );
  const activePreset = presetId
    ? selectedPresetQuery.data
    : defaultPresetQuery.data;
  const presetLoading = presetId
    ? selectedPresetQuery.isLoading
    : defaultPresetQuery.isLoading;

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

  const setupVariables = useMemo(() => {
    if (!activePreset) return [];
    return variablesWithValues(activePreset.variables, {
      ...selectedVariableValues(activePreset.variables),
      ...chat.settings.variables,
    });
  }, [activePreset, chat.settings.variables]);

  function handleApplyVariables(variables: Variable[]) {
    patchSettings({ variables: selectedVariableValues(variables) });
    setVariablesOpen(false);
  }

  return (
    <div className={classes.stack}>
      <Field label="Title">
        <TextInput
          defaultValue={chat.title}
          key={`title-${chat.id}-${chat.updated_at}`}
          onBlur={(event) => {
            const title = event.currentTarget.value.trim();
            if (title !== chat.title) {
              updateMutation.mutate({ id: chat.id, input: { title } });
            }
          }}
        />
      </Field>

      <Field label="Connection">
        <Select
          data={connectionOptions}
          value={chat.settings.connection_id ?? ""}
          onChange={(value) => patchSettings({ connection_id: value || null })}
          clearable
          searchable
          placeholder="Default connection"
        />
      </Field>

      <Field label="Preset">
        <Select
          data={presetOptions}
          value={chat.settings.preset_id ?? ""}
          onChange={(value) => patchSettings({ preset_id: value || null })}
          clearable
          searchable
          placeholder={`Default ${chat.mode} preset`}
        />
      </Field>

      <Field
        label="Setup variables"
        hint="Values for this chat's preset placeholders. Does not change the preset itself."
      >
        <Button
          type="button"
          variant="default"
          disabled={presetLoading || !activePreset}
          onClick={() => setVariablesOpen(true)}
        >
          Setup Variables
        </Button>
      </Field>

      <Field
        label="Characters"
        hint={
          <>
            First selected is primary (
            <RuntimeText>{"{{char}}"}</RuntimeText>).
          </>
        }
      >
        <MultiSelect
          data={characterOptions}
          value={chat.settings.character_ids}
          onChange={(value) => patchSettings({ character_ids: value })}
          searchable
          clearable
          placeholder={chat.mode === "roleplay" ? "Required" : "Optional"}
        />
      </Field>

      {isGroup ? (
        <>
          <p className={classes.sectionLabel}>Group Chat</p>
          <Field
            label="Group mode"
            hint="Merged = one reply for all. Individual = separate reply per character."
          >
            <Select
              data={groupModeOptions}
              value={chat.settings.group_mode}
              onChange={(value) => {
                if (!value) return;
                patchSettings({ group_mode: value as GroupChatMode });
              }}
            />
          </Field>
          {chat.settings.group_mode === "individual" ? (
            <>
              <Field
                label="Response order"
                hint="Sequential = all members. Smart = model picks. Manual = picker / @mention only."
              >
                <Select
                  data={responseOrderOptions}
                  value={chat.settings.response_order}
                  onChange={(value) => {
                    if (!value) return;
                    patchSettings({
                      response_order: value as GroupResponseOrder,
                    });
                  }}
                />
              </Field>
              <Switch
                variant="card"
                checked={chat.settings.add_turn_to_prompt}
                onChange={(checked) =>
                  patchSettings({ add_turn_to_prompt: checked })
                }
                label="Add turn to prompt"
                description='Append "Respond ONLY as {name}." for each Individual turn.'
              />
            </>
          ) : null}
          <Field
            label="Scenario override"
            hint="Replaces each character's card scenario in the prompt when non-empty."
          >
            <Textarea
              className={classes.textarea}
              defaultValue={chat.settings.scenario_override}
              key={`scenario-override-${chat.id}-${chat.updated_at}`}
              onBlur={(event) => {
                const scenario_override = event.currentTarget.value;
                if (scenario_override !== chat.settings.scenario_override) {
                  patchSettings({ scenario_override });
                }
              }}
            />
          </Field>
        </>
      ) : null}

      <Field label="Persona">
        <Select
          data={personaOptions}
          value={chat.settings.persona_id ?? ""}
          onChange={(value) => patchSettings({ persona_id: value || null })}
          clearable
          searchable
          placeholder="Default persona"
        />
      </Field>

      <Field label="Lorebooks">
        <MultiSelect
          data={lorebookOptions}
          value={chat.settings.lorebook_ids}
          onChange={(value) => patchSettings({ lorebook_ids: value })}
          searchable
          clearable
        />
      </Field>

      <p className={classes.sectionLabel}>Agents</p>
      <Field
        label="Active agents"
        hint="Pre/parallel/post agents run around each reply. Open Agents from the composer to view results and templates."
      >
        <MultiSelect
          data={agentOptions}
          value={chat.settings.agent_ids}
          onChange={(value) => patchSettings({ agent_ids: value })}
          searchable
          clearable
        />
      </Field>

      <p className={classes.sectionLabel}>Connected chats</p>
      <Switch
        variant="card"
        checked={chat.settings.allow_twatter_references}
        onChange={(allow_twatter_references) =>
          patchSettings({ allow_twatter_references })
        }
        label="Allow Twatter references"
        description="Let this chat use Twatter posts and feeds as context."
      />
      <Switch
        variant="card"
        checked={chat.settings.allow_character_dms}
        onChange={(allow_character_dms) => {
          const characterDmId =
            agentsQuery.data?.find((agent) => agent.slug === "character-dm")
              ?.id ?? "default:character-dm";
          const ids = chat.settings.agent_ids ?? [];
          if (allow_character_dms && !ids.includes(characterDmId)) {
            patchSettings({
              allow_character_dms,
              agent_ids: [...ids, characterDmId],
            });
            return;
          }
          patchSettings({ allow_character_dms });
        }}
        label="Allow character DMs"
        description="Side DMs for cast members. Enables the Character DM agent (auto-added) so private chats can open after replies; you can also open them manually from the composer."
      />

      <p className={classes.sectionLabel}>Memory</p>
      <Field
        label="Semantic memory"
        hint="Older messages beyond history depth are retrieved into chat_summary."
      >
        <Switch
          checked={chat.settings.memory_enabled}
          onChange={(memory_enabled) => patchSettings({ memory_enabled })}
          label={chat.settings.memory_enabled ? "Enabled" : "Disabled"}
        />
      </Field>
      <Field
        label="History depth"
        hint="Recent messages kept in full chat_history."
      >
        <NumberInput
          value={chat.settings.history_depth}
          min={1}
          max={200}
          onChange={(value) => {
            if (typeof value === "number") {
              patchSettings({ history_depth: value });
            }
          }}
        />
      </Field>
      <Field label="Memory top-k" hint="Max retrieved older messages.">
        <NumberInput
          value={chat.settings.memory_top_k}
          min={1}
          max={50}
          disabled={!chat.settings.memory_enabled}
          onChange={(value) => {
            if (typeof value === "number") {
              patchSettings({ memory_top_k: value });
            }
          }}
        />
      </Field>
      <Field label="Memory token budget" hint="Soft cap for retrieved text.">
        <NumberInput
          value={chat.settings.memory_token_budget}
          min={64}
          max={8000}
          step={64}
          disabled={!chat.settings.memory_enabled}
          onChange={(value) => {
            if (typeof value === "number") {
              patchSettings({ memory_token_budget: value });
            }
          }}
        />
      </Field>

      <Field label="Summary" hint="Injected into chat_summary marker (before retrieved memories)">
        <Textarea
          className={classes.textarea}
          defaultValue={chat.summary}
          key={`summary-${chat.id}-${chat.updated_at}`}
          onBlur={(event) => {
            const summary = event.currentTarget.value;
            if (summary !== chat.summary) {
              updateMutation.mutate({ id: chat.id, input: { summary } });
            }
          }}
        />
      </Field>

      <SetupVariablesModal
        opened={variablesOpen}
        onClose={() => setVariablesOpen(false)}
        variables={setupVariables}
        onApply={handleApplyVariables}
      />
    </div>
  );
}
