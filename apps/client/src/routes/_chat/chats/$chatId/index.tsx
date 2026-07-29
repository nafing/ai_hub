import { useEffect, useState } from "react";
import {
  IconArrowLeft,
  IconNotebook,
  IconRobot,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ActionIcon } from "@/components/ui";
import { ConversationPresenceModal } from "@/features/chats/conversation";
import { SummaryPopover } from "@/features/chats/roleplay";
import {
  chatAgentPanelHasActivity,
  ChatSession,
  ChatSettingsPanel,
  useChat,
  useChatGeneration,
} from "@/features/chats/shared";
import classes from "./index.module.css";

export const Route = createFileRoute("/_chat/chats/$chatId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { chatId } = Route.useParams();
  const { data: chat, isLoading, isError } = useChat(chatId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const { agentStatus } = useChatGeneration(chatId);
  const hasActiveAgents = (chat?.settings.agent_ids ?? []).length > 0;
  const isConversation = chat?.mode === "conversation";

  useEffect(() => {
    if (!hasActiveAgents) {
      setAgentsOpen(false);
    }
  }, [hasActiveAgents]);

  useEffect(() => {
    if (isConversation) {
      setSummaryOpen(false);
    }
  }, [isConversation]);

  if (isLoading) {
    return (
      <div className={classes.loading}>
        <div className={classes.spinner} aria-label="Loading" />
      </div>
    );
  }

  if (isError || !chat) {
    return (
      <div className={classes.errorWrap}>
        <p className={classes.error}>Failed to load chat.</p>
      </div>
    );
  }

  const agentsHaveActivity =
    Boolean(agentStatus) || chatAgentPanelHasActivity(chat);

  return (
    <div
      className={`${classes.shell}${settingsOpen ? ` ${classes.shellAsideOpen}` : ""}`}
    >
      <header className={classes.header}>
        <div className={classes.headerLeft}>
          <ActionIcon
            type="button"
            variant="ghost"
            aria-label={
              chat.parent_chat_id ? "Back to parent chat" : "Back to chats"
            }
            onClick={() => {
              if (chat.parent_chat_id) {
                void navigate({
                  to: "/chats/$chatId",
                  params: { chatId: chat.parent_chat_id },
                });
                return;
              }
              void navigate({ to: "/chats" });
            }}
          >
            <IconArrowLeft size={18} />
          </ActionIcon>
          <div className={classes.headerMeta}>
            <h1 className={classes.title}>{chat.title || "Untitled"}</h1>
            <p className={classes.mode}>
              {chat.parent_chat_id ? "DM · conversation" : chat.mode}
            </p>
          </div>
        </div>
        <div className={classes.headerActions}>
          {hasActiveAgents ? (
            <ActionIcon
              type="button"
              variant={agentsOpen ? "primary" : "default"}
              aria-label="Agents"
              aria-pressed={agentsOpen}
              title="Agents"
              className={
                agentsHaveActivity ? classes.agentsButtonActive : undefined
              }
              onClick={() => setAgentsOpen((open) => !open)}
            >
              <IconRobot size={18} />
              {agentsHaveActivity ? (
                <span className={classes.agentsBadge} aria-hidden />
              ) : null}
            </ActionIcon>
          ) : null}
          {isConversation ? (
            <ActionIcon
              type="button"
              variant={presenceOpen ? "primary" : "default"}
              aria-label="Presence"
              aria-pressed={presenceOpen}
              onClick={() => setPresenceOpen(true)}
            >
              <IconUsers size={18} />
            </ActionIcon>
          ) : null}
          {!isConversation ? (
            <ActionIcon
              type="button"
              variant={summaryOpen ? "primary" : "default"}
              aria-label="Chat summary"
              aria-pressed={summaryOpen}
              onClick={() => setSummaryOpen(true)}
            >
              <IconNotebook size={18} />
            </ActionIcon>
          ) : null}
          <ActionIcon
            type="button"
            variant={settingsOpen ? "primary" : "default"}
            aria-label="Toggle settings"
            aria-pressed={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <IconSettings size={18} />
          </ActionIcon>
        </div>
      </header>

      <main className={classes.main}>
        <ChatSession
          chat={chat}
          agentsOpen={agentsOpen}
          onAgentsOpenChange={setAgentsOpen}
        />
      </main>

      <aside className={classes.aside} data-glass-surface>
        <div className={classes.asideHeader}>
          <p className={classes.asideTitle}>Chat Settings</p>
        </div>
        <ChatSettingsPanel chat={chat} />
      </aside>

      {!isConversation ? (
        <SummaryPopover
          chat={chat}
          opened={summaryOpen}
          onClose={() => setSummaryOpen(false)}
        />
      ) : null}

      <ConversationPresenceModal
        chat={chat}
        opened={presenceOpen}
        onClose={() => setPresenceOpen(false)}
      />
    </div>
  );
}
