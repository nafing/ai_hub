import { useState } from "react";
import { IconAlertTriangle, IconPencil } from "@tabler/icons-react";
import type { Chat } from "@ai-hub/shared";
import { NumberInput, Select } from "@/components/ui";
import {
  SettingsSection,
  type PatchChatSettings,
} from "../shared/chatSettingsUi";
import { FunctionCallingSettings } from "../shared/FunctionCallingSettings";
import { MemoryRecallSettings } from "../shared/MemoryRecallSettings";
import { AutonomousMessagingSettings } from "./AutonomousMessagingSettings";
import { ConversationAgentsSettings } from "./ConversationAgentsSettings";
import classes from "./ChatSettingsConversation.module.css";

const DAY_ROLLOVER_OPTIONS = Array.from({ length: 12 }, (_, hour) => ({
  value: String(hour),
  label: hour === 0 ? "12 AM (midnight)" : `${hour} AM`,
}));

type ChatSettingsConversationProps = {
  chat: Chat;
  isGroup: boolean;
  patchSettings: PatchChatSettings;
  onEditSummaries: () => void;
};

export function ChatSettingsConversation({
  chat,
  isGroup,
  patchSettings,
  onEditSummaries,
}: ChatSettingsConversationProps) {
  const [rolloverTouched, setRolloverTouched] = useState(false);
  const hasExistingSummaries =
    Object.keys(chat.day_summaries ?? {}).length > 0 ||
    Object.keys(chat.week_summaries ?? {}).length > 0;

  return (
    <>
      <ConversationAgentsSettings chat={chat} patchSettings={patchSettings} />

      <MemoryRecallSettings chat={chat} patchSettings={patchSettings} />

      <FunctionCallingSettings
        settings={chat.settings}
        patchSettings={patchSettings}
      />

      <SettingsSection value="autonomous" label="Autonomous Messaging">
        <AutonomousMessagingSettings
          chat={chat}
          isGroup={isGroup}
          patchSettings={patchSettings}
        />
      </SettingsSection>

      <SettingsSection value="summary" label="Automatic Summarization">
        <button
          type="button"
          className={classes.editButton}
          onClick={onEditSummaries}
        >
          <span className={classes.editCopy}>
            <span className={classes.editTitle}>Edit Summaries</span>
            <p className={classes.editHint}>
              Review and edit what characters remember from this chat.
            </p>
          </span>
          <IconPencil size={14} className={classes.editIcon} />
        </button>

        <div className={classes.block}>
          <span className={classes.blockLabel}>Day Rollover Hour</span>
          <Select
            data={DAY_ROLLOVER_OPTIONS}
            value={String(chat.settings.day_rollover_hour ?? 4)}
            onChange={(value) => {
              if (!value) return;
              setRolloverTouched(true);
              patchSettings({ day_rollover_hour: Number(value) });
            }}
          />
          <p className={classes.blockHint}>
            Messages sent before this hour count as part of the previous day.
            Pick a time you&apos;re never chatting, so a late-night session
            doesn&apos;t get cut off mid-conversation.
          </p>
          {rolloverTouched && hasExistingSummaries ? (
            <div className={classes.warning}>
              <IconAlertTriangle size={12} className={classes.warningIcon} />
              <p className={classes.warningText}>
                Existing summaries were built with the previous setting. For
                today, messages near the rollover hour may be duplicated or
                missing from the prompt. From tomorrow onward, new day summaries
                will line up correctly. To adjust an older summary, use{" "}
                <strong>Edit Summaries</strong> above.
              </p>
            </div>
          ) : null}
        </div>

        <div className={classes.block}>
          <span className={classes.blockLabel}>Recent Message Tail</span>
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
          <p className={classes.blockHint}>
            How many recent messages to keep word-for-word, even once
            they&apos;re summarized. Helps characters pick up the actual flow of
            last night&apos;s conversation instead of just the gist. Set to{" "}
            <strong>0</strong> to disable. Higher values increase prompt size
            and model cost.
          </p>
        </div>
      </SettingsSection>
    </>
  );
}
