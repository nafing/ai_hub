import type { Chat } from "@ai-hub/shared";
import { MultiSelect, Switch } from "@/components/ui";
import {
  Field,
  SettingsSection,
  type PatchChatSettings,
} from "../shared/chatSettingsUi";
import { FunctionCallingSettings } from "../shared/FunctionCallingSettings";
import { MemoryRecallSettings } from "../shared/MemoryRecallSettings";
import classes from "../shared/ChatSettingsPanel.module.css";

type ChatSettingsRoleplayProps = {
  chat: Chat;
  agentOptions: { value: string; label: string }[];
  connectionOptions: { value: string; label: string }[];
  patchSettings: PatchChatSettings;
};

export function ChatSettingsRoleplay({
  chat,
  agentOptions,
  patchSettings,
}: ChatSettingsRoleplayProps) {
  return (
    <>
      <SettingsSection value="agents" label="Agents">
        <Switch
          variant="card"
          checked={chat.settings.enable_agents}
          onChange={(enable_agents) => patchSettings({ enable_agents })}
          label="Enable Agents"
          description="Run AI agents during generation (world state, expressions, etc.)"
        />
        {chat.settings.enable_agents ? (
          <>
            <Field
              label="Active agents"
              hint="Pre/parallel/post agents run around each reply. Open Agents from the header to view results and templates."
            >
              <MultiSelect
                data={agentOptions}
                value={chat.settings.agent_ids}
                onChange={(value) => patchSettings({ agent_ids: value })}
                searchable
                clearable
              />
            </Field>
            <Switch
              variant="card"
              checked={chat.settings.agent_write_approval_required}
              onChange={(agent_write_approval_required) =>
                patchSettings({ agent_write_approval_required })
              }
              label="Review Agent Outputs"
              description="Lorebook and summary updates can be committed automatically. Character card edits still ask first."
            />
            <Switch
              variant="card"
              checked={chat.settings.manual_trackers}
              onChange={(manual_trackers) => patchSettings({ manual_trackers })}
              label="Manual Trackers"
              description="When enabled, tracker agents do not auto-run after every generation."
            />
          </>
        ) : null}
      </SettingsSection>

      <MemoryRecallSettings chat={chat} patchSettings={patchSettings} />

      <FunctionCallingSettings
        settings={chat.settings}
        patchSettings={patchSettings}
      />

      <SettingsSection value="summary" label="Summary">
        <p className={classes.summaryHint}>
          Use the scroll icon in the chat header to generate rolling summaries,
          manage entries, and configure automatic updates.
        </p>
      </SettingsSection>
    </>
  );
}
