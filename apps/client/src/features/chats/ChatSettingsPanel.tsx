import { useMemo, useState, type ReactNode } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import {
  GROUP_CHAT_MODE_LABELS,
  GROUP_CHAT_MODES,
  GROUP_RESPONSE_ORDER_LABELS,
  GROUP_RESPONSE_ORDERS,
  isCharacterInactiveInChat,
  normalizeInactiveCharacterIds,
  selectedVariableValues,
  type Chat,
  type ChatSettings,
  type GroupChatMode,
  type GroupResponseOrder,
  type PresetVariableValues,
  type Variable,
} from "@ai-hub/shared";
import { ActionIcon, Button, MultiSelect, NumberInput, Select, Textarea, TextInput, Switch, RuntimeText } from "@/components/ui";
import { characterAvatarSrc } from "@/features/characters/avatar-url";
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
import { SummariesEditorModal } from "./SummariesEditorModal";
import { api } from "@/lib/api";
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
  const [summariesOpen, setSummariesOpen] = useState(false);
  const apiBase = String(api.defaults.baseURL ?? "/v1/api");

  const presetId = chat.settings.preset_id;
  const presetCategory = chat.mode;
  const selectedPresetQuery = usePreset(presetId ?? undefined);
  const defaultPresetQuery = useDefaultPreset(
    presetId ? undefined : presetCategory,
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
        .filter((item) => item.category === presetCategory)
        .map((item) => ({
          value: item.id,
          label: item.name || "Unnamed",
        })),
    [presetsQuery.data, presetCategory],
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
        label:
          value === "merged" && chat.mode === "conversation"
            ? "Grouped"
            : GROUP_CHAT_MODE_LABELS[value],
      })),
    [chat.mode],
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

  const rosterCharacters = useMemo(() => {
    const byId = new Map(
      (charactersQuery.data ?? []).map((character) => [character.id, character]),
    );
    return chat.settings.character_ids
      .map((id) => byId.get(id))
      .filter((character): character is NonNullable<typeof character> =>
        Boolean(character),
      );
  }, [charactersQuery.data, chat.settings.character_ids]);

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

  function toggleCharacterInChat(characterId: string) {
    const inactive = chat.settings.inactive_character_ids ?? [];
    const next = inactive.includes(characterId)
      ? inactive.filter((id) => id !== characterId)
      : [...inactive, characterId];
    patchSettings({
      inactive_character_ids: normalizeInactiveCharacterIds(
        chat.settings.character_ids,
        next,
      ),
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
          isGroup ? (
            <>
              First selected is primary (
              <RuntimeText>{"{{char}}"}</RuntimeText>
              ). Use the eye icon to disable a member without removing them.
            </>
          ) : (
            <>
              First selected is primary (
              <RuntimeText>{"{{char}}"}</RuntimeText>
              ).
            </>
          )
        }
      >
        <MultiSelect
          data={characterOptions}
          value={chat.settings.character_ids}
          onChange={(value) =>
            patchSettings({
              character_ids: value,
              inactive_character_ids: normalizeInactiveCharacterIds(
                value,
                chat.settings.inactive_character_ids,
              ),
            })
          }
          searchable
          clearable
          placeholder={chat.mode === "roleplay" ? "Required" : "Optional"}
        />
        {isGroup && rosterCharacters.length > 0 ? (
          <ul className={classes.memberList}>
            {rosterCharacters.map((character) => {
              const inactive = isCharacterInactiveInChat(
                chat.settings,
                character.id,
              );
              const avatarUrl = characterAvatarSrc(character.avatar, apiBase);
              return (
                <li
                  key={character.id}
                  className={[
                    classes.memberRow,
                    inactive ? classes.memberRowInactive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className={classes.memberAvatar}
                    />
                  ) : (
                    <span className={classes.memberAvatarFallback} aria-hidden />
                  )}
                  <span className={classes.memberName}>{character.name}</span>
                  <ActionIcon
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={
                      inactive ? "Enable in chat" : "Disable in chat"
                    }
                    title={inactive ? "Enable in chat" : "Disable in chat"}
                    onClick={() => toggleCharacterInChat(character.id)}
                  >
                    {inactive ? (
                      <IconEyeOff size={16} />
                    ) : (
                      <IconEye size={16} />
                    )}
                  </ActionIcon>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Field>

      {isGroup ? (
        <>
          <p className={classes.sectionLabel}>Group Chat</p>
          <Field
            label="Mode"
            hint={
              chat.mode === "conversation"
                ? "Grouped = one reply for all characters. Individual = a separate model request per responding character."
                : "Merged combines all characters into one narrator reply. Individual has each character respond separately."
            }
          >
            <Select
              data={groupModeOptions}
              value={chat.settings.group_mode}
              onChange={(value) => {
                if (!value) return;
                const nextMode = value as GroupChatMode;
                const patch: Partial<ChatSettings> = { group_mode: nextMode };
                if (
                  nextMode === "individual" &&
                  chat.mode === "conversation" &&
                  chat.settings.response_order === "manual"
                ) {
                  patch.response_order = "sequential";
                }
                patchSettings(patch);
              }}
            />
          </Field>
          {chat.settings.group_mode === "individual" ? (
            <>
              <Field
                label="Response order"
                hint={
                  chat.settings.response_order === "manual"
                    ? chat.mode === "conversation"
                      ? "No automatic responses — @mention one or more characters."
                      : "No automatic responses — use the character picker or @mention."
                    : chat.settings.response_order === "smart"
                      ? chat.mode === "conversation"
                        ? "Smart picks one or more characters from context and talkativeness."
                        : "An AI pass decides which characters should respond."
                      : chat.mode === "conversation"
                        ? "Characters respond one by one in list order."
                        : "Characters respond one by one in list order."
                }
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
                checked={chat.settings.add_turn_to_prompt !== false}
                onChange={(checked) =>
                  patchSettings({ add_turn_to_prompt: checked })
                }
                label="Add turn to prompt"
                description="Each individual turn includes a short responding-character instruction."
              />
              {chat.mode === "roleplay" ? (
                <Switch
                  variant="card"
                  checked={chat.settings.group_speaker_names_in_history}
                  onChange={(checked) =>
                    patchSettings({ group_speaker_names_in_history: checked })
                  }
                  label="Name prefix history"
                  description="Send chat history turns as Name: message before role merging."
                />
              ) : null}
            </>
          ) : null}
          {chat.settings.group_mode === "merged" ? (
            chat.mode === "roleplay" ? (
              <Switch
                variant="card"
                checked={chat.settings.group_speaker_tags}
                onChange={(checked) =>
                  patchSettings({ group_speaker_tags: checked })
                }
                label="Color dialogues"
                description='Wrap each character line in <speaker="name"> tags so dialogue can be split and styled per character.'
              />
            ) : (
              <p className={classes.fieldHint}>
                Speaker tags are enabled automatically for grouped conversation.
              </p>
            )
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
        description="Let timeline refreshes pull this chat's recent messages as context."
      />
      <Switch
        variant="card"
        checked={chat.settings.allow_character_dms}
        onChange={(allow_character_dms) =>
          patchSettings({ allow_character_dms })
        }
        label="Allow character DMs"
        description="Characters can send you private messages via hidden [dm] commands in roleplay replies. Opens side DM threads automatically; you can also open them manually from the composer."
      />

      {chat.mode === "conversation" ? (
        <>
          <p className={classes.sectionLabel}>Autonomous Messaging</p>
          <Switch
            variant="card"
            checked={chat.settings.autonomous_messages}
            onChange={(autonomous_messages) =>
              patchSettings({ autonomous_messages })
            }
            label="Autonomous Messages"
            description="Characters may message you while this chat is open and you are inactive."
          />
          {isGroup ? (
            <Switch
              variant="card"
              checked={chat.settings.character_exchanges}
              onChange={(character_exchanges) =>
                patchSettings({ character_exchanges })
              }
              label="Character Exchanges"
              description="After an autonomous reply, another character may respond to them."
            />
          ) : null}
          <Field
            label="Daily check-in cap"
            hint="Optional chat ceiling (0–8). Empty uses talkativeness defaults."
          >
            <NumberInput
              value={chat.settings.autonomous_daily_cap_override ?? ""}
              min={0}
              max={8}
              onChange={(value) => {
                patchSettings({
                  autonomous_daily_cap_override:
                    typeof value === "number" ? value : null,
                });
              }}
            />
          </Field>

          <p className={classes.sectionLabel}>Presence</p>
          <Switch
            variant="card"
            checked={chat.settings.conversation_schedules_enabled}
            onChange={(conversation_schedules_enabled) =>
              patchSettings({ conversation_schedules_enabled })
            }
            label="Use schedules"
            description="Derive online/idle/dnd/offline from weekly schedules."
          />
          <Field label="Conversation timezone" hint="IANA timezone, e.g. Europe/Warsaw.">
            <TextInput
              defaultValue={chat.settings.conversation_timezone ?? ""}
              placeholder={chat.settings.prompt_timezone ?? "Host default"}
              key={`tz-${chat.id}-${chat.settings.conversation_timezone ?? ""}`}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim();
                const next = value || null;
                if (next === (chat.settings.conversation_timezone ?? null)) {
                  return;
                }
                patchSettings({
                  conversation_timezone: next,
                });
              }}
            />
          </Field>

          <p className={classes.sectionLabel}>Conversation extras</p>
          <Switch
            variant="card"
            checked={chat.settings.cross_chat_awareness !== false}
            onChange={(cross_chat_awareness) =>
              patchSettings({ cross_chat_awareness })
            }
            label="Cross-chat awareness"
            description="Pull recent messages from other conversation chats that share characters."
          />
          <Switch
            variant="card"
            checked={chat.settings.conversation_about_me_inject !== false}
            onChange={(conversation_about_me_inject) =>
              patchSettings({ conversation_about_me_inject })
            }
            label="Inject About Me"
            description="Include character/persona About Me bios in the prompt."
          />
          <Switch
            variant="card"
            checked={chat.settings.character_commands !== false}
            onChange={(character_commands) =>
              patchSettings({ character_commands })
            }
            label="Conversation commands"
            description="Allow hidden [react], [schedule_update], [memory], and [cross_post] tags."
          />
          <Switch
            variant="card"
            checked={chat.settings.enable_memory_recall !== false}
            onChange={(enable_memory_recall) =>
              patchSettings({ enable_memory_recall })
            }
            label="Memory recall"
            description="Inject related earlier messages when relevant (lexical fallback)."
          />
        </>
      ) : null}

      <p className={classes.sectionLabel}>History</p>
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

      <p className={classes.sectionLabel}>Summary</p>
      {chat.mode === "conversation" ? (
        <>
          <Field
            label="Day rollover hour"
            hint="Messages before this hour count as the previous calendar day (0–11)."
          >
            <NumberInput
              value={chat.settings.day_rollover_hour}
              min={0}
              max={11}
              onChange={(value) => {
                if (typeof value === "number") {
                  patchSettings({ day_rollover_hour: value });
                }
              }}
            />
          </Field>
          <Field
            label="Summary tail messages"
            hint="Recent verbatim turns kept when older days are summarized."
          >
            <NumberInput
              value={chat.settings.summary_tail_messages}
              min={0}
              max={100}
              onChange={(value) => {
                if (typeof value === "number") {
                  patchSettings({ summary_tail_messages: value });
                }
              }}
            />
          </Field>
          <Button type="button" variant="default" onClick={() => setSummariesOpen(true)}>
            Edit day/week summaries
          </Button>
          <SummariesEditorModal
            chat={chat}
            opened={summariesOpen}
            onClose={() => setSummariesOpen(false)}
          />
        </>
      ) : (
        <p className={classes.summaryHint}>
          Use the scroll icon in the chat header to generate rolling summaries,
          manage entries, and configure automatic updates.
        </p>
      )}

      <SetupVariablesModal
        opened={variablesOpen}
        onClose={() => setVariablesOpen(false)}
        variables={setupVariables}
        onApply={handleApplyVariables}
      />
    </div>
  );
}
