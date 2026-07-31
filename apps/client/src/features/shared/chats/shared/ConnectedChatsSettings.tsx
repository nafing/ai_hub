import { useMemo, useState } from "react";
import { IconLink, IconUnlink } from "@tabler/icons-react";
import type { Chat } from "@ai-hub/shared";
import { Select, Switch } from "@/components/ui";
import {
  SettingsSection,
  type PatchChatSettings,
} from "./chatSettingsUi";
import { useChats, useConnectChat, useDisconnectChat } from "./queries";
import classes from "./ConnectedChatsSettings.module.css";

type ConnectedChatsSettingsProps = {
  chat: Chat;
  patchSettings: PatchChatSettings;
};

export function ConnectedChatsSettings({
  chat,
  patchSettings,
}: ConnectedChatsSettingsProps) {
  const isConversation = chat.mode === "conversation";
  const isRoleplay = chat.mode === "roleplay";
  const chatsQuery = useChats();
  const connectMutation = useConnectChat();
  const disconnectMutation = useDisconnectChat();
  const [pickerId, setPickerId] = useState<string | null>(null);

  const linkedIds = chat.connected_chat_ids ?? [];
  const chats = chatsQuery.data ?? [];
  const linkedChats = useMemo(
    () =>
      linkedIds.map((id) => ({
        id,
        item: chats.find((entry) => entry.id === id) ?? null,
      })),
    [linkedIds, chats],
  );

  const linkCandidates = useMemo(() => {
    const wantMode = isConversation ? "roleplay" : "conversation";
    const linkedSet = new Set(linkedIds);
    return chats
      .filter((item) => {
        if (item.id === chat.id) return false;
        if (item.mode !== wantMode) return false;
        if (item.parent_chat_id) return false;
        if (linkedSet.has(item.id)) return false;
        return true;
      })
      .map((item) => ({
        value: item.id,
        label: item.title || (item.mode === "roleplay" ? "Roleplay" : "Conversation"),
      }));
  }, [chats, chat.id, isConversation, linkedIds]);

  const canLink = !chat.parent_chat_id;
  const busy = connectMutation.isPending || disconnectMutation.isPending;

  return (
    <SettingsSection value="connected" label="Connected Chats">
      {isConversation ? (
        <Switch
          variant="card"
          checked={chat.settings.cross_chat_awareness !== false}
          onChange={(cross_chat_awareness) =>
            patchSettings({ cross_chat_awareness })
          }
          label="Cross-chat awareness"
          description="Characters know recent messages from other conversation chats that share them."
        />
      ) : null}

      {!chat.parent_chat_id ? (
        <div className={classes.linkBlock}>
          <span className={classes.linkLabel}>Linked chats</span>
          {linkedChats.length > 0 ? (
            <div className={classes.linkedList}>
              {linkedChats.map(({ id, item }) => (
                <div key={id} className={classes.linkedRow}>
                  <div className={classes.linkedMeta}>
                    <IconLink size={14} className={classes.linkIcon} />
                    <div className={classes.linkedText}>
                      <span className={classes.linkedTitle}>
                        {item?.title ||
                          (isConversation
                            ? "Linked roleplay"
                            : "Linked conversation")}
                      </span>
                      <span className={classes.linkedHint}>
                        {isConversation
                          ? "Conversation pulls story context; characters can send influences and notes."
                          : "Roleplay receives influences/notes; replies may post OOC into the conversation."}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={classes.unlinkButton}
                    disabled={busy}
                    onClick={() =>
                      disconnectMutation.mutate({
                        chatId: chat.id,
                        targetChatId: id,
                      })
                    }
                  >
                    <IconUnlink size={12} /> Unlink
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {canLink ? (
            <div className={classes.pickerRow}>
              <Select
                data={linkCandidates}
                value={pickerId ?? ""}
                onChange={(value) => setPickerId(value || null)}
                searchable
                clearable
                placeholder={
                  isConversation
                    ? "Add a roleplay chat…"
                    : "Add a conversation…"
                }
                disabled={busy || chatsQuery.isLoading || linkCandidates.length === 0}
              />
              <button
                type="button"
                className={classes.linkButton}
                disabled={!pickerId || busy}
                onClick={() => {
                  if (!pickerId) return;
                  connectMutation.mutate(
                    { chatId: chat.id, targetChatId: pickerId },
                    { onSuccess: () => setPickerId(null) },
                  );
                }}
              >
                <IconLink size={12} /> Link
              </button>
            </div>
          ) : null}

          {canLink && linkCandidates.length === 0 && !chatsQuery.isLoading ? (
            <p className={classes.emptyHint}>
              {linkedIds.length > 0
                ? isConversation
                  ? "No more roleplay chats to link."
                  : "No more conversation chats to link."
                : isConversation
                  ? "No roleplay chats to link. Create one first."
                  : "No conversation chats to link."}
            </p>
          ) : null}
        </div>
      ) : null}

      <Switch
        variant="card"
        checked={chat.settings.allow_twatter_references}
        onChange={(allow_twatter_references) =>
          patchSettings({ allow_twatter_references })
        }
        label="Allow Twatter references"
        description="Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt."
      />

      {isRoleplay ? (
        <Switch
          variant="card"
          checked={chat.settings.allow_character_dms}
          onChange={(allow_character_dms) =>
            patchSettings({ allow_character_dms })
          }
          label="Allow character DMs"
          description="Adds a short hidden command reminder so characters can open a new DM conversation when they text the user in-world."
        />
      ) : null}
    </SettingsSection>
  );
}
