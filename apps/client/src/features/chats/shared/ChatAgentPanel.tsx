import { useMemo, useState } from "react";
import type { Chat, ChatAgentSettingsMap } from "@ai-hub/shared";
import { Button, Modal, Select, TextInput, notifications } from "@/components/ui";
import { useAgents } from "@/features/agents/queries";
import {
  applyAgentProposal,
  dismissAgentProposal,
  updateChat,
} from "./api";
import { chatKeys } from "./queries";
import { useQueryClient } from "@tanstack/react-query";
import classes from "./ChatAgentPanel.module.css";

type ChatAgentPanelProps = {
  chat: Chat;
  opened: boolean;
  onClose: () => void;
  disabled?: boolean;
  agentStatus?: { slug: string; name: string; phase: string } | null;
  onSendChoice?: (text: string) => void;
  onRunDirector?: () => void;
};

type CyoaChoice = { label?: string; text?: string };
type EchoReaction = { characterName?: string; reaction?: string };
type TrackerChar = {
  name?: string;
  emoji?: string;
  mood?: string;
  outfit?: string;
  thoughts?: string;
  stats?: Array<{ name?: string; value?: number; max?: number }>;
};
type CustomField = { name?: string; value?: string; locked?: boolean };
type CardProposal = {
  id?: string;
  status?: string;
  characterId?: string;
  field?: string;
  oldText?: string;
  newText?: string;
  reason?: string;
};

export function ChatAgentPanel({
  chat,
  opened,
  onClose,
  disabled,
  agentStatus,
  onSendChoice,
  onRunDirector,
}: ChatAgentPanelProps) {
  const queryClient = useQueryClient();
  const agentsQuery = useAgents();
  const [busyId, setBusyId] = useState<string | null>(null);

  const selectedAgents = useMemo(() => {
    const ids = new Set(chat.settings.agent_ids ?? []);
    return (agentsQuery.data ?? []).filter((agent) => ids.has(agent.id));
  }, [agentsQuery.data, chat.settings.agent_ids]);

  const state = chat.agent_state ?? {};
  const cyoa = state.cyoa as { choices?: CyoaChoice[] } | undefined;
  const echo = state["echo-chamber"] as
    | { reactions?: EchoReaction[] }
    | undefined;
  const tracker = state["character-tracker"] as
    | { presentCharacters?: TrackerChar[] }
    | undefined;
  const custom = state["custom-tracker"] as { fields?: CustomField[] } | undefined;
  const cardEvo = state["card-evolution-auditor"] as
    | { updates?: CardProposal[] }
    | undefined;
  const knowledge = state["knowledge-retrieval"] as
    | { extracted?: string; error?: string }
    | undefined;
  const keeper = state["lorebook-keeper"] as
    | { applied?: string[]; warning?: string; error?: string }
    | undefined;

  const echoAgent = selectedAgents.find((agent) => agent.slug === "echo-chamber");
  const proseAgent = selectedAgents.find((agent) => agent.slug === "prose-guardian");
  const directorAgent = selectedAgents.find((agent) => agent.slug === "director");

  async function patchAgentSettings(
    key: string,
    patch: ChatAgentSettingsMap[string],
  ) {
    const next: ChatAgentSettingsMap = {
      ...(chat.settings.agent_settings ?? {}),
      [key]: {
        ...(chat.settings.agent_settings?.[key] ?? {}),
        ...patch,
        settings: {
          ...(chat.settings.agent_settings?.[key]?.settings ?? {}),
          ...(patch.settings ?? {}),
        },
      },
    };
    const updated = await updateChat(chat.id, {
      settings: { agent_settings: next },
    });
    queryClient.setQueryData(chatKeys.detail(chat.id), updated);
  }

  async function handleProposal(
    proposalId: string,
    action: "apply" | "dismiss",
  ) {
    setBusyId(proposalId);
    try {
      const updated =
        action === "apply"
          ? await applyAgentProposal(chat.id, {
              slug: "card-evolution-auditor",
              proposalId,
            })
          : await dismissAgentProposal(chat.id, {
              slug: "card-evolution-auditor",
              proposalId,
            });
      queryClient.setQueryData(chatKeys.detail(chat.id), updated);
      notifications.show({
        title: action === "apply" ? "Applied" : "Dismissed",
        message:
          action === "apply"
            ? "Character card updated."
            : "Proposal dismissed.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function saveCustomFields(fields: CustomField[]) {
    const updated = await updateChat(chat.id, {
      agent_state: {
        ...chat.agent_state,
        "custom-tracker": { fields },
      },
    });
    queryClient.setQueryData(chatKeys.detail(chat.id), updated);
  }

  const title = agentStatus ? (
    <span className={classes.modalTitle}>
      Agents
      <span className={classes.status}>Running {agentStatus.name}…</span>
    </span>
  ) : (
    "Agents"
  );

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="md">
      <div className={classes.stack}>
        {!selectedAgents.length ? (
          <p className={classes.empty}>
            No agents active. Enable them in Chat Settings → Agents.
          </p>
        ) : null}

        {directorAgent && onRunDirector ? (
          <section className={classes.section}>
            <div className={classes.sectionHead}>
              <span className={classes.sectionTitle}>Narrative Director</span>
              <Button
                type="button"
                variant="default"
                disabled={disabled}
                onClick={onRunDirector}
              >
                Run director
              </Button>
            </div>
          </section>
        ) : null}

        {cyoa?.choices?.length ? (
          <section className={classes.section}>
            <p className={classes.sectionTitle}>CYOA</p>
            <div className={classes.choices}>
              {cyoa.choices.map((choice, index) => (
                <button
                  key={`${choice.label}-${index}`}
                  type="button"
                  className={classes.choice}
                  disabled={disabled || !choice.text}
                  onClick={() => {
                    if (!choice.text) return;
                    onSendChoice?.(choice.text);
                    onClose();
                  }}
                >
                  <strong>{choice.label || `Choice ${index + 1}`}</strong>
                  <span>{choice.text}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {tracker?.presentCharacters?.length ? (
          <section className={classes.section}>
            <p className={classes.sectionTitle}>Character tracker</p>
            <ul className={classes.list}>
              {tracker.presentCharacters.map((character, index) => (
                <li key={`${character.name}-${index}`} className={classes.card}>
                  <div className={classes.cardTop}>
                    <span>
                      {character.emoji ? `${character.emoji} ` : ""}
                      {character.name || "Unknown"}
                    </span>
                    {character.mood ? (
                      <span className={classes.meta}>{character.mood}</span>
                    ) : null}
                  </div>
                  {character.outfit ? (
                    <p className={classes.muted}>{character.outfit}</p>
                  ) : null}
                  {character.thoughts ? (
                    <p className={classes.muted}>💭 {character.thoughts}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {custom?.fields?.length ? (
          <section className={classes.section}>
            <p className={classes.sectionTitle}>Custom tracker</p>
            <div className={classes.fields}>
              {custom.fields.map((field, index) => (
                <label
                  key={`${field.name}-${index}`}
                  className={classes.fieldRow}
                >
                  <span>{field.name}</span>
                  <TextInput
                    key={`${field.name}-${chat.updated_at}-${index}`}
                    defaultValue={field.value ?? ""}
                    disabled={disabled || field.locked}
                    onBlur={(event) => {
                      const value = event.currentTarget.value;
                      if (value === (field.value ?? "")) return;
                      const next = custom.fields!.map((item, i) =>
                        i === index ? { ...item, value } : item,
                      );
                      void saveCustomFields(next);
                    }}
                  />
                </label>
              ))}
            </div>
          </section>
        ) : null}

        {echo?.reactions?.length ? (
          <section className={classes.section}>
            <p className={classes.sectionTitle}>Echo Chamber</p>
            {echoAgent?.prompt_templates?.length ? (
              <Select
                data={echoAgent.prompt_templates.map((template) => ({
                  value: template.id,
                  label: template.name,
                }))}
                value={
                  chat.settings.agent_settings?.[echoAgent.id]
                    ?.prompt_template_id ??
                  chat.settings.agent_settings?.[echoAgent.slug]
                    ?.prompt_template_id ??
                  ""
                }
                onChange={(value) => {
                  void patchAgentSettings(echoAgent.id, {
                    prompt_template_id: value || null,
                  });
                }}
                clearable
                searchable
              />
            ) : null}
            <ul className={classes.echoList}>
              {echo.reactions.map((reaction, index) => (
                <li key={`${reaction.characterName}-${index}`}>
                  <strong>{reaction.characterName || "anon"}</strong>
                  <span>{reaction.reaction}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {cardEvo?.updates?.some(
          (item) => item.status !== "dismissed" && item.status !== "approved",
        ) ? (
          <section className={classes.section}>
            <p className={classes.sectionTitle}>Card evolution</p>
            <ul className={classes.list}>
              {cardEvo.updates
                ?.filter((item) => item.status === "pending" || !item.status)
                .map((proposal) => (
                  <li key={proposal.id} className={classes.card}>
                    <p className={classes.meta}>
                      {proposal.field} · {proposal.characterId}
                    </p>
                    {proposal.reason ? (
                      <p className={classes.muted}>{proposal.reason}</p>
                    ) : null}
                    <pre className={classes.diff}>{proposal.newText}</pre>
                    <div className={classes.actions}>
                      <Button
                        type="button"
                        variant="primary"
                        disabled={disabled || busyId === proposal.id}
                        onClick={() =>
                          void handleProposal(proposal.id || "", "apply")
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        disabled={disabled || busyId === proposal.id}
                        onClick={() =>
                          void handleProposal(proposal.id || "", "dismiss")
                        }
                      >
                        Dismiss
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ) : null}

        {knowledge?.extracted ||
        knowledge?.error ||
        keeper?.applied?.length ||
        keeper?.warning ||
        keeper?.error ? (
          <section className={classes.section}>
            <p className={classes.sectionTitle}>Knowledge / Lore</p>
            {knowledge?.extracted ? (
              <pre className={classes.diff}>
                {knowledge.extracted.slice(0, 600)}
              </pre>
            ) : null}
            {knowledge?.error ? (
              <p className={classes.error}>{knowledge.error}</p>
            ) : null}
            {keeper?.applied?.length ? (
              <p className={classes.muted}>
                Keeper applied: {keeper.applied.join(", ")}
              </p>
            ) : null}
            {keeper?.warning ? (
              <p className={classes.muted}>{keeper.warning}</p>
            ) : null}
            {keeper?.error ? (
              <p className={classes.error}>{keeper.error}</p>
            ) : null}
          </section>
        ) : null}

        {proseAgent ? (
          <section className={classes.section}>
            <p className={classes.sectionTitle}>Prose Guardian</p>
            <TextInput
              value={String(
                chat.settings.agent_settings?.[proseAgent.id]?.settings
                  ?.banned ??
                  proseAgent.default_settings?.banned ??
                  "",
              )}
              disabled={disabled}
              onChange={(event) => {
                void patchAgentSettings(proseAgent.id, {
                  settings: { banned: event.currentTarget.value },
                });
              }}
            />
          </section>
        ) : null}
      </div>
    </Modal>
  );
}

/** Whether the agents button should show an activity badge. */
export function chatAgentPanelHasActivity(chat: Chat): boolean {
  const state = chat.agent_state ?? {};
  const cyoa = state.cyoa as { choices?: unknown[] } | undefined;
  if (cyoa?.choices?.length) return true;
  const cardEvo = state["card-evolution-auditor"] as
    | { updates?: Array<{ status?: string }> }
    | undefined;
  if (
    cardEvo?.updates?.some(
      (item) => item.status === "pending" || !item.status,
    )
  ) {
    return true;
  }
  return false;
}
