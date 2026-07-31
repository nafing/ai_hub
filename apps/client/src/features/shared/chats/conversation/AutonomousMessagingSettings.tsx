import { useMemo, useRef, useState } from "react";
import {
  IconCurrentLocation,
  IconPencil,
  IconRefresh,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  emptyWeekSchedule,
  type Chat,
  type WeekSchedule,
} from "@ai-hub/shared";
import { Button, NumberInput, Select, Switch, notifications } from "@/components/ui";
import { useCharacters } from "@/features/api-queries/characters/queries";
import { api } from "@/lib/api";
import { chatKeys } from "@/features/api-queries/chats/queries";
import { Field } from "../shared/chatSettingsUi";
import type { PatchChatSettings } from "../shared/chatSettingsUi";
import { CharacterScheduleEditorModal } from "@/features/modals/chats/CharacterScheduleEditorModal";
import {
  detectConversationTimeZone,
  formatConversationTimeZone,
  listConversationTimeZones,
} from "./conversationTimeZone";
import classes from "./AutonomousMessagingSettings.module.css";

type AutonomousMessagingSettingsProps = {
  chat: Chat;
  isGroup: boolean;
  patchSettings: PatchChatSettings;
};

const CAP_MODE_OPTIONS = [
  { value: "default", label: "Default chat ceiling (talkativeness-based)" },
  { value: "numeric", label: "Numeric value" },
];

export function AutonomousMessagingSettings({
  chat,
  isGroup,
  patchSettings,
}: AutonomousMessagingSettingsProps) {
  const queryClient = useQueryClient();
  const charactersQuery = useCharacters();
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);
  const [scheduleCharacterId, setScheduleCharacterId] = useState<string | null>(
    null,
  );

  const characterIds = chat.settings.character_ids;
  const schedules = chat.settings.character_schedules ?? {};
  const schedulesEnabled = chat.settings.conversation_schedules_enabled;
  const hasGeneratedSchedules = characterIds.some((id) => Boolean(schedules[id]));
  const capOverride = chat.settings.autonomous_daily_cap_override;
  const detectedTimeZone = useMemo(() => detectConversationTimeZone(), []);
  const selectedTimeZone =
    chat.settings.conversation_timezone?.trim() ||
    chat.settings.prompt_timezone?.trim() ||
    detectedTimeZone;

  const timeZoneOptions = useMemo(
    () =>
      listConversationTimeZones(selectedTimeZone).map((timeZone) => ({
        value: timeZone,
        label: formatConversationTimeZone(timeZone),
      })),
    [selectedTimeZone],
  );

  const characterNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const character of charactersQuery.data ?? []) {
      map.set(character.id, character.name || "Unnamed");
    }
    return map;
  }, [charactersQuery.data]);

  const editingSchedule = scheduleCharacterId
    ? (schedules[scheduleCharacterId] ?? null)
    : null;

  async function generateSchedules(forceRefresh: boolean) {
    if (generatingRef.current || characterIds.length === 0) return;
    generatingRef.current = true;
    setGenerating(true);
    try {
      if (forceRefresh) {
        const nextSchedules: Record<string, WeekSchedule> = {};
        for (const characterId of characterIds) {
          nextSchedules[characterId] = emptyWeekSchedule(50);
        }
        const { data: updated } = await api.post<Chat>(
          `/conversation/schedules/${chat.id}`,
          {
            character_schedules: nextSchedules,
            conversation_schedules_enabled: true,
          },
        );
        queryClient.setQueryData(chatKeys.detail(updated.id), updated);
      } else {
        await api.post(`/conversation/schedules/${chat.id}/ensure`);
        const { data: updated } = await api.post<Chat>(
          `/conversation/schedules/${chat.id}`,
          { conversation_schedules_enabled: true },
        );
        queryClient.setQueryData(chatKeys.detail(updated.id), updated);
      }

      notifications.show({
        title: forceRefresh ? "Schedules regenerated" : "Schedules ready",
        message: forceRefresh
          ? "Default weekly routines were rebuilt for this chat."
          : "Default weekly routines are available to edit.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Schedule generation failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }

  function handleSchedulesToggle(nextEnabled: boolean) {
    if (nextEnabled && !hasGeneratedSchedules) {
      if (characterIds.length === 0) {
        patchSettings({ conversation_schedules_enabled: true });
        return;
      }
      void generateSchedules(false);
      return;
    }
    patchSettings({ conversation_schedules_enabled: nextEnabled });
  }

  function scheduledDayCount(schedule?: WeekSchedule | null): number {
    if (!schedule?.days) return 0;
    return Object.values(schedule.days).filter(
      (blocks) => Array.isArray(blocks) && blocks.length > 0,
    ).length;
  }

  const scheduleStatus = !schedulesEnabled
    ? "Schedules are off — autonomy uses talkativeness and your status."
    : hasGeneratedSchedules
      ? "Schedules generated — status is derived from character routines."
      : "Schedules enabled — generate routines when you're ready.";

  return (
    <>
      <Switch
        variant="card"
        checked={chat.settings.autonomous_messages}
        onChange={(autonomous_messages) =>
          patchSettings({ autonomous_messages })
        }
        label="Autonomous Messages"
        description="Characters message you when you're inactive, even without schedules"
      />

      {chat.settings.autonomous_messages ? (
        <Field
          label="Chat check-in cap"
          hint="Sets the chat-wide ceiling; character caps can only lower it. Higher ceilings may create many model requests and notifications."
        >
          <Select
            data={CAP_MODE_OPTIONS}
            value={capOverride == null ? "default" : "numeric"}
            onChange={(value) => {
              if (value === "numeric") {
                patchSettings({
                  autonomous_daily_cap_override: capOverride ?? 8,
                });
                return;
              }
              patchSettings({ autonomous_daily_cap_override: null });
            }}
          />
          {capOverride != null ? (
            <NumberInput
              value={capOverride}
              min={0}
              max={8}
              onChange={(value) => {
                if (typeof value === "number") {
                  patchSettings({ autonomous_daily_cap_override: value });
                }
              }}
            />
          ) : null}
        </Field>
      ) : null}

      {isGroup ? (
        <Switch
          variant="card"
          checked={chat.settings.character_exchanges}
          onChange={(character_exchanges) =>
            patchSettings({ character_exchanges })
          }
          label="Character Exchanges"
          description="Characters chat with each other in group chats"
        />
      ) : null}

      <Switch
        variant="card"
        checked={schedulesEnabled}
        onChange={handleSchedulesToggle}
        label="Schedules"
        description="Optional character routines for availability and delays"
      />

      <div className={classes.statusRow}>
        <p className={classes.statusText}>{scheduleStatus}</p>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={generating || characterIds.length === 0}
          leftSection={
            <IconRefresh
              size={14}
              className={generating ? classes.spin : undefined}
            />
          }
          onClick={() => void generateSchedules(hasGeneratedSchedules)}
        >
          {generating
            ? "Generating…"
            : hasGeneratedSchedules
              ? "Regenerate"
              : "Generate"}
        </Button>
      </div>

      <Field
        label="Schedule timezone"
        hint={`Availability and autonomous messages follow this timezone. Your device currently reports ${detectedTimeZone}.`}
      >
        <div className={classes.timezoneRow}>
          <Select
            data={timeZoneOptions}
            value={selectedTimeZone}
            searchable
            onChange={(value) => {
              if (!value) return;
              patchSettings({ conversation_timezone: value });
            }}
          />
          {selectedTimeZone !== detectedTimeZone ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              leftSection={<IconCurrentLocation size={14} />}
              onClick={() =>
                patchSettings({ conversation_timezone: detectedTimeZone })
              }
            >
              Use device
            </Button>
          ) : null}
        </div>
      </Field>

      {hasGeneratedSchedules ? (
        <div className={classes.editList}>
          <span className={classes.editListLabel}>Edit schedules</span>
          {characterIds.map((characterId) => {
            const schedule = schedules[characterId];
            const days = scheduledDayCount(schedule);
            return (
              <button
                key={characterId}
                type="button"
                className={classes.editRow}
                onClick={() => setScheduleCharacterId(characterId)}
              >
                <span className={classes.editCopy}>
                  <span className={classes.editName}>
                    {characterNameById.get(characterId) ?? "Unknown"}
                  </span>
                  <span className={classes.editMeta}>
                    {schedule
                      ? `${days} day${days === 1 ? "" : "s"} scheduled`
                      : "Create schedule"}
                  </span>
                </span>
                <IconPencil size={14} className={classes.editIcon} />
              </button>
            );
          })}
        </div>
      ) : null}

      {scheduleCharacterId ? (
        <CharacterScheduleEditorModal
          opened
          onClose={() => setScheduleCharacterId(null)}
          chatId={chat.id}
          characterId={scheduleCharacterId}
          characterName={
            characterNameById.get(scheduleCharacterId) ?? "Character"
          }
          schedule={editingSchedule}
          onSaved={(schedule) => {
            patchSettings({
              character_schedules: {
                ...schedules,
                [scheduleCharacterId]: schedule,
              },
              conversation_schedules_enabled: true,
            });
            setScheduleCharacterId(null);
          }}
        />
      ) : null}
    </>
  );
}
