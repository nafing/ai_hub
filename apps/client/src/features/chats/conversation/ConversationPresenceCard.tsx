import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Chat, ConversationPresenceStatus } from "@ai-hub/shared";
import { Button, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { CharacterScheduleEditorModal } from "./CharacterScheduleEditorModal";
import { chatKeys } from "../shared/queries";
import classes from "./ConversationPresenceCard.module.css";

type StatusEntry = {
  status: ConversationPresenceStatus;
  activity: string;
  characterName: string;
  talkativeness: number;
};

type StatusResponse = {
  timezone: string | null;
  statuses: Record<string, StatusEntry>;
};

type ConversationPresenceCardProps = {
  chat: Chat;
  /** When false, skip polling (e.g. modal closed). Default true. */
  active?: boolean;
  /** Drop outer card chrome when nested in a Modal. */
  embedded?: boolean;
};

const STATUS_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "idle", label: "Idle" },
  { value: "dnd", label: "DND" },
  { value: "offline", label: "Offline" },
];

export function ConversationPresenceCard({
  chat,
  active = true,
  embedded = false,
}: ConversationPresenceCardProps) {
  const queryClient = useQueryClient();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [scheduleCharacterId, setScheduleCharacterId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (chat.mode !== "conversation" || !active) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { data: response } = await api.get<StatusResponse>(
          `/conversation/status/${chat.id}`,
        );
        if (!cancelled) setData(response);
      } catch {
        if (!cancelled) setData(null);
      }
    };

    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void load();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    active,
    chat.id,
    chat.mode,
    chat.settings.conversation_status_overrides,
    chat.settings.character_schedules,
    chat.updated_at,
  ]);

  if (chat.mode !== "conversation") return null;
  if (!chat.settings.character_ids.length) {
    return <p className={classes.empty}>No characters in this chat.</p>;
  }

  const entries = Object.entries(data?.statuses ?? []);
  const editingId = scheduleCharacterId;
  const editingName = editingId
    ? (data?.statuses[editingId]?.characterName ?? "Character")
    : "";
  const editingSchedule = editingId
    ? (chat.settings.character_schedules[editingId] ?? null)
    : null;

  return (
    <div
      className={[classes.card, embedded ? classes.cardEmbedded : ""]
        .filter(Boolean)
        .join(" ")}
      {...(!embedded ? { "data-glass-surface": true } : {})}
    >
      {!embedded ? (
        <div className={classes.header}>
          <p className={classes.title}>Presence</p>
          {data?.timezone ? (
            <span className={classes.tz}>{data.timezone}</span>
          ) : null}
        </div>
      ) : data?.timezone ? (
        <p className={classes.tzLine}>Timezone · {data.timezone}</p>
      ) : null}

      {entries.length === 0 ? (
        <p className={classes.empty}>Loading status…</p>
      ) : (
        <ul className={classes.list}>
          {entries.map(([characterId, entry]) => (
            <li key={characterId} className={classes.row}>
              <span
                className={classes.dot}
                data-status={entry.status}
                aria-hidden
              />
              <div className={classes.meta}>
                <strong>{entry.characterName}</strong>
                <span>{entry.activity || entry.status}</span>
              </div>
              <Select
                data={STATUS_OPTIONS}
                value={entry.status}
                onChange={(value) => {
                  void api
                    .post("/conversation/status/override", {
                      chatId: chat.id,
                      characterId,
                      status: value,
                      activity: entry.activity,
                    })
                    .then(() =>
                      api.get<StatusResponse>(
                        `/conversation/status/${chat.id}`,
                      ),
                    )
                    .then((response) => {
                      setData(response.data);
                      void queryClient.invalidateQueries({
                        queryKey: chatKeys.detail(chat.id),
                      });
                    })
                    .catch(() => undefined);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setScheduleCharacterId(characterId)}
              >
                Schedule
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editingId ? (
        <CharacterScheduleEditorModal
          opened
          onClose={() => setScheduleCharacterId(null)}
          chatId={chat.id}
          characterId={editingId}
          characterName={editingName}
          schedule={editingSchedule}
          onSaved={() => {
            void queryClient.invalidateQueries({
              queryKey: chatKeys.detail(chat.id),
            });
            void api
              .get<StatusResponse>(`/conversation/status/${chat.id}`)
              .then((response) => setData(response.data))
              .catch(() => undefined);
          }}
        />
      ) : null}
    </div>
  );
}
