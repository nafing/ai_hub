import { useEffect, useMemo, useState } from "react";
import {
  CONVERSATION_SCHEDULE_DAYS,
  emptyWeekSchedule,
  normalizeWeekSchedule,
  type ConversationPresenceStatus,
  type ScheduleBlock,
  type WeekSchedule,
} from "@ai-hub/shared";
import { Button, Modal, Select, TextInput } from "@/components/ui";
import { api } from "@/lib/api";
import classes from "./CharacterScheduleEditorModal.module.css";

type CharacterScheduleEditorModalProps = {
  opened: boolean;
  onClose: () => void;
  chatId: string;
  characterId: string;
  characterName: string;
  schedule?: WeekSchedule | null;
  onSaved: (schedule: WeekSchedule) => void;
};

const STATUS_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "idle", label: "Idle" },
  { value: "dnd", label: "DND" },
  { value: "offline", label: "Offline" },
];

function cloneSchedule(schedule?: WeekSchedule | null): WeekSchedule {
  const base = normalizeWeekSchedule(schedule) ?? emptyWeekSchedule();
  const days: Record<string, ScheduleBlock[]> = {};
  for (const day of CONVERSATION_SCHEDULE_DAYS) {
    days[day] = (base.days[day] ?? []).map((block) => ({ ...block }));
  }
  return { ...base, days };
}

export function CharacterScheduleEditorModal({
  opened,
  onClose,
  chatId,
  characterId,
  characterName,
  schedule,
  onSaved,
}: CharacterScheduleEditorModalProps) {
  const [draft, setDraft] = useState<WeekSchedule>(() => cloneSchedule(schedule));
  const [day, setDay] = useState<string>(CONVERSATION_SCHEDULE_DAYS[0] ?? "monday");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setDraft(cloneSchedule(schedule));
    setDay(CONVERSATION_SCHEDULE_DAYS[0] ?? "monday");
  }, [opened, schedule, characterId]);

  const blocks = draft.days[day] ?? [];

  const dayOptions = useMemo(
    () =>
      CONVERSATION_SCHEDULE_DAYS.map((value) => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1),
      })),
    [],
  );

  function updateBlock(index: number, patch: Partial<ScheduleBlock>) {
    setDraft((current) => {
      const nextDays = { ...current.days };
      const list = [...(nextDays[day] ?? [])];
      const existing = list[index];
      if (!existing) return current;
      list[index] = { ...existing, ...patch };
      nextDays[day] = list;
      return { ...current, days: nextDays };
    });
  }

  function addBlock() {
    setDraft((current) => {
      const nextDays = { ...current.days };
      const list = [...(nextDays[day] ?? [])];
      list.push({
        time: "09:00-17:00",
        activity: "free time",
        status: "online",
      });
      nextDays[day] = list;
      return { ...current, days: nextDays };
    });
  }

  function removeBlock(index: number) {
    setDraft((current) => {
      const nextDays = { ...current.days };
      nextDays[day] = (nextDays[day] ?? []).filter((_, i) => i !== index);
      return { ...current, days: nextDays };
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await api.post<{
        settings?: { character_schedules?: Record<string, WeekSchedule> };
      }>(`/conversation/schedules/${chatId}`, {
        conversation_schedules_enabled: true,
        character_schedules: {
          [characterId]: draft,
        },
      });
      const saved =
        data.settings?.character_schedules?.[characterId] ??
        normalizeWeekSchedule(draft) ??
        draft;
      onSaved(saved);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Schedule · ${characterName}`}
      size="lg"
    >
      <div className={classes.root}>
        <label className={classes.field}>
          <span className={classes.fieldLabel}>Day</span>
          <Select data={dayOptions} value={day} onChange={setDay} />
        </label>

        <div className={classes.blocks}>
          {blocks.length === 0 ? (
            <p className={classes.empty}>No blocks for this day.</p>
          ) : (
            blocks.map((block, index) => (
              <div key={`${day}-${index}`} className={classes.block}>
                <label className={classes.field}>
                  <span className={classes.fieldLabel}>Time</span>
                  <TextInput
                    value={block.time}
                    placeholder="09:00-17:00"
                    onChange={(event) =>
                      updateBlock(index, { time: event.currentTarget.value })
                    }
                  />
                </label>
                <label className={classes.field}>
                  <span className={classes.fieldLabel}>Activity</span>
                  <TextInput
                    value={block.activity}
                    onChange={(event) =>
                      updateBlock(index, {
                        activity: event.currentTarget.value,
                      })
                    }
                  />
                </label>
                <label className={classes.field}>
                  <span className={classes.fieldLabel}>Status</span>
                  <Select
                    data={STATUS_OPTIONS}
                    value={block.status}
                    onChange={(value) =>
                      updateBlock(index, {
                        status: value as ConversationPresenceStatus,
                      })
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => removeBlock(index)}
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>

        <div className={classes.actions}>
          <Button type="button" variant="default" onClick={addBlock}>
            Add block
          </Button>
          <div className={classes.spacer} />
          <Button type="button" variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={saving}
            onClick={() => void handleSave()}
          >
            Save schedule
          </Button>
        </div>
      </div>
    </Modal>
  );
}
