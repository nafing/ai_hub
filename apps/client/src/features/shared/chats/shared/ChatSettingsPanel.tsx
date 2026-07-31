import { useMemo, useState } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import {
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
import {
  ActionIcon,
  Accordion,
  Button,
  MultiSelect,
  Select,
  Textarea,
  TextInput,
  Switch,
  RuntimeText,
} from "@/components/ui";
import { characterAvatarSrc } from "@/features/characters/avatar-url";
import { CharacterFolderQuickPick } from "@/features/characters/CharacterFolderQuickPick";
import { useCharacterFolders } from "@/features/characters/foldersQueries";
import { useAgents } from "@/features/agents/queries";
import { useCharacters } from "@/features/characters/queries";
import { useConnectionSelectOptions } from "@/features/connections/queries";
import { usePersonas } from "@/features/personas/queries";
import { SetupVariablesModal } from "@/features/presets/SetupVariablesModal";
import {
  useDefaultPreset,
  usePreset,
  usePresets,
} from "@/features/presets/queries";
import { ChatSettingsConversation } from "../conversation/ChatSettingsConversation";
import { SummariesEditorModal } from "../conversation/SummariesEditorModal";
import { ChatSettingsRoleplay } from "../roleplay/ChatSettingsRoleplay";
import { api } from "@/lib/api";
import { ChatBackgroundPicker } from "./ChatBackgroundPicker";
import { ChatLorebooksSettings } from "./ChatLorebooksSettings";
import { AdvancedParametersFields } from "./AdvancedParametersFields";
import { Field, SettingsSection } from "./chatSettingsUi";
import { useUpdateChat } from "./queries";
import classes from "./ChatSettingsPanel.module.css";
import { ConnectedChatsSettings } from "./ConnectedChatsSettings";

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

export function ChatSettingsPanel({ chat }: ChatSettingsPanelProps) {
  const updateMutation = useUpdateChat();
  const connectionsQuery = useConnectionSelectOptions("llm");
  const presetsQuery = usePresets();
  const charactersQuery = useCharacters();
  const foldersQuery = useCharacterFolders();
  const personasQuery = usePersonas();
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

  const connectionOptions = connectionsQuery.options;

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

  const isGroup = chat.settings.character_ids.length > 1;
  const isRoleplay = chat.mode === "roleplay";
  const isConversation = chat.mode === "conversation";

  function setGroupMode(nextMode: GroupChatMode) {
    if (nextMode === chat.settings.group_mode) return;
    const patch: Partial<ChatSettings> = { group_mode: nextMode };
    if (
      nextMode === "individual" &&
      isConversation &&
      chat.settings.response_order === "manual"
    ) {
      patch.response_order = "sequential";
    }
    patchSettings(patch);
  }

  function responseOrderHint(order: GroupResponseOrder): string {
    if (order === "manual") {
      return isConversation
        ? "No automatic responses — @mention one or more characters to call them into the conversation."
        : "No automatic responses — use the character picker in the input bar to trigger responses one at a time.";
    }
    if (order === "smart") {
      return isConversation
        ? "Smart chooses one or more available characters using the conversation, schedule status, and talkativeness."
        : "An AI agent decides which characters should respond based on the scene context.";
    }
    return isConversation
      ? "Available characters respond one by one in their listed order; offline characters are skipped."
      : "Characters respond one by one in their listed order.";
  }

  const rosterCharacters = useMemo(() => {
    const byId = new Map(
      (charactersQuery.data ?? []).map((character) => [
        character.id,
        character,
      ]),
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
      <Accordion
        multiple
        defaultValue={["general"]}
        className={classes.accordion}
      >
        <SettingsSection value="general" label="General">
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
              onChange={(value) =>
                patchSettings({ connection_id: value || null })
              }
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
        </SettingsSection>

        <SettingsSection value="advanced" label="Advanced Parameters">
          <AdvancedParametersFields
            chat={chat}
            connectionOptions={connectionOptions}
            patchSettings={patchSettings}
          />
        </SettingsSection>

        <SettingsSection value="background" label="Background">
          <Field
            label="Background image"
            hint="Pick a gallery image from any character in this chat. Manage images on each character's Gallery tab."
          >
            <ChatBackgroundPicker
              characterIds={chat.settings.character_ids}
              value={chat.settings.background_image_url}
              onChange={(background_image_url) =>
                patchSettings({ background_image_url })
              }
            />
          </Field>
        </SettingsSection>

        {isGroup ? (
          <SettingsSection value="group" label="Group Chat">
            <Field label="Mode">
              <div
                className={classes.segmented}
                role="group"
                aria-label="Group chat mode"
              >
                <button
                  type="button"
                  className={`${classes.segment}${
                    chat.settings.group_mode === "merged"
                      ? ` ${classes.segmentActive}`
                      : ""
                  }`}
                  onClick={() => setGroupMode("merged")}
                >
                  {isConversation ? "Grouped" : "Merged (Narrator)"}
                </button>
                <button
                  type="button"
                  className={`${classes.segment}${
                    chat.settings.group_mode === "individual"
                      ? ` ${classes.segmentActive}`
                      : ""
                  }`}
                  onClick={() => setGroupMode("individual")}
                >
                  Individual
                </button>
              </div>
            </Field>
            {chat.settings.group_mode === "individual" ? (
              <>
                <Field
                  label="Response Order"
                  hint={responseOrderHint(chat.settings.response_order)}
                >
                  <div
                    className={classes.segmented}
                    role="group"
                    aria-label="Response order"
                  >
                    {GROUP_RESPONSE_ORDERS.map((order) => (
                      <button
                        key={order}
                        type="button"
                        className={`${classes.segment}${
                          chat.settings.response_order === order
                            ? ` ${classes.segmentActive}`
                            : ""
                        }`}
                        onClick={() =>
                          patchSettings({ response_order: order })
                        }
                      >
                        {GROUP_RESPONSE_ORDER_LABELS[order]}
                      </button>
                    ))}
                  </div>
                </Field>
                <Switch
                  variant="card"
                  checked={chat.settings.add_turn_to_prompt !== false}
                  onChange={(checked) =>
                    patchSettings({ add_turn_to_prompt: checked })
                  }
                  label="Add Turn To Prompt"
                  description="Each individual turn includes a short responding-character instruction."
                />
                {isRoleplay ? (
                  <Switch
                    variant="card"
                    checked={chat.settings.group_speaker_names_in_history}
                    onChange={(checked) =>
                      patchSettings({
                        group_speaker_names_in_history: checked,
                      })
                    }
                    label="Name Prefix History"
                    description="History turns keep their stored text before role merging."
                  />
                ) : null}
              </>
            ) : null}
            {chat.settings.group_mode === "merged" ? (
              isRoleplay ? (
                <Switch
                  variant="card"
                  checked={chat.settings.group_speaker_tags}
                  onChange={(checked) =>
                    patchSettings({ group_speaker_tags: checked })
                  }
                  label="Color Dialogues"
                  description="Color character dialogues differently using the special tags. The colors are assigned based on what you chose in the Color tab for your Character."
                />
              ) : (
                <p className={classes.fieldHint}>
                  Speaker tags are enabled automatically for grouped
                  conversation.
                </p>
              )
            ) : null}
            {isRoleplay ? (
              <Field label="Scenario Override">
                <Textarea
                  className={classes.scenarioOverride}
                  defaultValue={chat.settings.scenario_override}
                  key={`scenario-override-${chat.id}-${chat.updated_at}`}
                  placeholder="Replace individual character scenarios with a shared scenario for this group chat or leave empty to keep them…"
                  onBlur={(event) => {
                    const scenario_override = event.currentTarget.value;
                    if (scenario_override !== chat.settings.scenario_override) {
                      patchSettings({ scenario_override });
                    }
                  }}
                />
              </Field>
            ) : null}
          </SettingsSection>
        ) : null}

        <SettingsSection value="persona" label="Persona">
          <Field label="Persona">
            <Select
              data={personaOptions}
              value={chat.settings.persona_id ?? ""}
              onChange={(value) => patchSettings({ persona_id: value || null })}
              clearable
              searchable
              placeholder="None"
            />
          </Field>
        </SettingsSection>

        <SettingsSection value="characters" label="Characters">
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
            <CharacterFolderQuickPick
              folders={foldersQuery.data ?? []}
              selectedIds={chat.settings.character_ids}
              onChange={(value) =>
                patchSettings({
                  character_ids: value,
                  inactive_character_ids: normalizeInactiveCharacterIds(
                    value,
                    chat.settings.inactive_character_ids,
                  ),
                })
              }
            />
            {isGroup && rosterCharacters.length > 0 ? (
              <ul className={classes.memberList}>
                {rosterCharacters.map((character) => {
                  const inactive = isCharacterInactiveInChat(
                    chat.settings,
                    character.id,
                  );
                  const avatarUrl = characterAvatarSrc(
                    character.avatar,
                    apiBase,
                  );
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
                        <span
                          className={classes.memberAvatarFallback}
                          aria-hidden
                        />
                      )}
                      <span className={classes.memberName}>
                        {character.name}
                      </span>
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
        </SettingsSection>

        <ConnectedChatsSettings chat={chat} patchSettings={patchSettings} />

        <ChatLorebooksSettings chat={chat} patchSettings={patchSettings} />

        {isRoleplay ? (
          <ChatSettingsRoleplay
            chat={chat}
            agentOptions={agentOptions}
            connectionOptions={connectionOptions}
            presetOptions={presetOptions}
            patchSettings={patchSettings}
          />
        ) : (
          <ChatSettingsConversation
            chat={chat}
            isGroup={isGroup}
            patchSettings={patchSettings}
            onEditSummaries={() => setSummariesOpen(true)}
          />
        )}
      </Accordion>

      {!isRoleplay ? (
        <SummariesEditorModal
          chat={chat}
          opened={summariesOpen}
          onClose={() => setSummariesOpen(false)}
        />
      ) : null}

      <SetupVariablesModal
        opened={variablesOpen}
        onClose={() => setVariablesOpen(false)}
        variables={setupVariables}
        onApply={handleApplyVariables}
      />
    </div>
  );
}
