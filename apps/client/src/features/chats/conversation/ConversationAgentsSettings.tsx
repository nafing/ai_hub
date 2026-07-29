import {
  CONVERSATION_COMMAND_KEYS,
  IMAGE_ASPECT_RATIO_LABELS,
  IMAGE_ASPECT_RATIOS,
  IMAGE_RESOLUTION_LABELS,
  IMAGE_RESOLUTIONS,
  type Chat,
  type ConversationCommandKey,
} from "@ai-hub/shared";
import { Select, Switch } from "@/components/ui";
import {
  Field,
  SettingsSection,
  type PatchChatSettings,
} from "../shared/chatSettingsUi";

const COMMAND_OPTIONS: Array<{
  id: ConversationCommandKey;
  label: string;
  description: string;
}> = [
  {
    id: "schedule_update",
    label: "Schedule Updates",
    description: "Let characters change their current status and activity.",
  },
  {
    id: "cross_post",
    label: "Cross-Post",
    description: "Let characters redirect a message into another shared chat.",
  },
  {
    id: "send_image",
    label: "Selfies",
    description: "Let characters request a generated selfie.",
  },
  {
    id: "memory",
    label: "Memories",
    description: "Let characters create memories for other characters.",
  },
  {
    id: "influence",
    label: "Influence",
    description:
      "When linked to a roleplay, let characters push one-shot story influences.",
  },
  {
    id: "note",
    label: "Notes",
    description:
      "When linked to a roleplay, let characters store durable facts for that story.",
  },
  {
    id: "react",
    label: "Reactions",
    description: "Let characters react to messages with emoji badges.",
  },
];

type ConversationAgentsSettingsProps = {
  chat: Chat;
  patchSettings: PatchChatSettings;
};

export function ConversationAgentsSettings({
  chat,
  patchSettings,
}: ConversationAgentsSettingsProps) {
  const commandsEnabled = chat.settings.character_commands !== false;
  const toggles = chat.settings.conversation_command_toggles ?? {};
  const selfiesEnabled = commandsEnabled && toggles.send_image !== false;

  function setCommandToggle(key: ConversationCommandKey, enabled: boolean) {
    const patch: Parameters<PatchChatSettings>[0] = {
      conversation_command_toggles: {
        ...toggles,
        [key]: enabled,
      },
    };
    if (enabled && !commandsEnabled) {
      patch.character_commands = true;
    }
    patchSettings(patch);
  }

  return (
    <SettingsSection value="agents" label="Agents">
      <Switch
        variant="card"
        checked={commandsEnabled}
        onChange={(character_commands) =>
          patchSettings({ character_commands })
        }
        label="Commands"
        description="Allow models to interact with you through installed commands, including schedules, media, reactions, and memories."
      />

      {commandsEnabled
        ? COMMAND_OPTIONS.filter((option) =>
            CONVERSATION_COMMAND_KEYS.includes(option.id),
          ).map((option) => {
            const enabled = toggles[option.id] !== false;
            return (
              <Switch
                key={option.id}
                variant="card"
                checked={enabled}
                onChange={(next) => setCommandToggle(option.id, next)}
                label={option.label}
                description={option.description}
              />
            );
          })
        : null}

      {selfiesEnabled ? (
        <>
          <Field
            label="Photo aspect ratio"
            hint="Used when a character sends a photo via the Selfies command."
          >
            <Select
              data={IMAGE_ASPECT_RATIOS.map((value) => ({
                value,
                label: IMAGE_ASPECT_RATIO_LABELS[value],
              }))}
              value={chat.settings.image_aspect_ratio || "3:4"}
              onChange={(value) => {
                if (!value) return;
                patchSettings({ image_aspect_ratio: value });
              }}
            />
          </Field>
          <Field label="Photo resolution">
            <Select
              data={IMAGE_RESOLUTIONS.map((value) => ({
                value,
                label: IMAGE_RESOLUTION_LABELS[value],
              }))}
              value={chat.settings.image_resolution || "1K"}
              onChange={(value) => {
                if (!value) return;
                patchSettings({ image_resolution: value });
              }}
            />
          </Field>
        </>
      ) : null}
    </SettingsSection>
  );
}
