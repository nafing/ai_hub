import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { LlmChatMessage } from "@ai-hub/shared";
import { Accordion, Button } from "@/components/ui";
import { useCharacterImportSessionStore } from "@/features/characters/characterImportSessionStore";
import { chatKeys, useChatGenerationStore } from "@/features/chats/shared";
import {
  useGeneratorJobsStore,
  type GeneratorJob,
} from "@/features/generators/generatorJobsStore";
import { queryClient } from "@/lib/queryClient";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/activity/")({
  component: RouteComponent,
});

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString();
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function hasEntries(value: Record<string, unknown> | undefined): boolean {
  return Boolean(value && Object.keys(value).length > 0);
}

function MessageList({ messages }: { messages: LlmChatMessage[] }) {
  if (messages.length === 0) {
    return <p className={classes.emptyInline}>No prompt messages.</p>;
  }
  return (
    <div className={classes.messageList}>
      {messages.map((message, index) => (
        <div key={`${message.role}-${index}`} className={classes.message}>
          <span className={classes.messageRole}>{message.role}</span>
          <pre className={classes.code}>{message.content}</pre>
        </div>
      ))}
    </div>
  );
}

function GeneratorJobDetails({ job }: { job: GeneratorJob }) {
  const { request, result } = job;
  const promptMessages = result?.messages ?? [];

  return (
    <Accordion>
      <Accordion.Item value="request">
        <Accordion.Control>Request</Accordion.Control>
        <Accordion.Panel>
          <div className={classes.detailStack}>
            <dl className={classes.metaGrid}>
              <div>
                <dt>Category</dt>
                <dd>{job.category}</dd>
              </div>
              <div>
                <dt>Connection</dt>
                <dd>{request.connectionId || "(default)"}</dd>
              </div>
              <div>
                <dt>Preset</dt>
                <dd>{request.presetId || "(default / linked)"}</dd>
              </div>
              <div>
                <dt>Generator Preset</dt>
                <dd>{request.generatorPresetId || "(none)"}</dd>
              </div>
              {job.sessionType ? (
                <div>
                  <dt>Session</dt>
                  <dd>
                    {job.sessionType}
                    {job.sessionId ? ` · ${job.sessionId}` : ""}
                  </dd>
                </div>
              ) : null}
            </dl>

            {request.userMessage?.trim() ? (
              <div className={classes.block}>
                <span className={classes.blockTitle}>Extra user message</span>
                <pre className={classes.code}>{request.userMessage}</pre>
              </div>
            ) : null}

            {hasEntries(request.variables) ? (
              <div className={classes.block}>
                <span className={classes.blockTitle}>Variables</span>
                <pre className={classes.code}>{prettyJson(request.variables)}</pre>
              </div>
            ) : null}

            {hasEntries(request.markers) ? (
              <div className={classes.block}>
                <span className={classes.blockTitle}>Markers</span>
                <pre className={classes.code}>{prettyJson(request.markers)}</pre>
              </div>
            ) : null}
          </div>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="prompt">
        <Accordion.Control>
          Prompt ({promptMessages.length} messages)
          {job.status === "running" ? " · waiting for result…" : ""}
        </Accordion.Control>
        <Accordion.Panel>
          {job.status === "running" && promptMessages.length === 0 ? (
            <p className={classes.emptyInline}>
              Prompt messages appear when the run finishes.
            </p>
          ) : (
            <MessageList messages={promptMessages} />
          )}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="result">
        <Accordion.Control>
          Result
          {result?.model ? ` · ${result.model}` : ""}
          {job.error ? " · failed" : ""}
        </Accordion.Control>
        <Accordion.Panel>
          <div className={classes.detailStack}>
            {job.error ? (
              <div className={classes.block}>
                <span className={classes.blockTitle}>Error</span>
                <pre className={classes.code}>{job.error}</pre>
              </div>
            ) : null}

            {result?.thinking ? (
              <div className={classes.block}>
                <span className={classes.blockTitle}>Thinking</span>
                <pre className={classes.code}>{result.thinking}</pre>
              </div>
            ) : null}

            {result ? (
              <div className={classes.block}>
                <span className={classes.blockTitle}>Reply</span>
                <pre className={classes.code}>
                  {result.content || result.reply || "(empty)"}
                </pre>
              </div>
            ) : job.status === "running" ? (
              <p className={classes.emptyInline}>Still running…</p>
            ) : (
              <p className={classes.emptyInline}>No result payload.</p>
            )}

            {result?.finishReason ? (
              <p className={classes.finishReason}>
                finish_reason: {result.finishReason}
              </p>
            ) : null}
          </div>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}

function RouteComponent() {
  const navigate = useNavigate();
  const jobs = useGeneratorJobsStore((state) => state.jobs);
  const dismissJob = useGeneratorJobsStore((state) => state.dismissJob);
  const clearFinished = useGeneratorJobsStore((state) => state.clearFinished);
  const importSessions = useCharacterImportSessionStore(
    (state) => state.sessions,
  );
  const openReview = useCharacterImportSessionStore((state) => state.openReview);
  const dismissImport = useCharacterImportSessionStore((state) => state.dismiss);
  const chatJobs = useChatGenerationStore((state) => state.jobs);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const activeChatJobs = Object.entries(chatJobs).filter(
    ([, job]) => job.streaming,
  );

  return (
    <div className={classes.activityPage}>
      <header className={classes.header}>
        <h2 className={classes.title}>Activity</h2>
        <p className={classes.subtitle}>
          Background chat replies, generator runs, and AI character imports —
          including full prompts and results.
        </p>
      </header>

      <section className={classes.section} data-glass-surface>
        <h3 className={classes.sectionTitle}>Chat generations</h3>
        {activeChatJobs.length === 0 ? (
          <p className={classes.empty}>No active chat generations.</p>
        ) : (
          <div className={classes.list}>
            {activeChatJobs.map(([chatId, job]) => {
              const chat = queryClient.getQueryData<{ title?: string }>(
                chatKeys.detail(chatId),
              );
              return (
                <div key={chatId} className={classes.item}>
                  <div className={classes.itemMain}>
                    <p className={classes.itemTitle}>
                      {chat?.title || "Chat"}
                    </p>
                    <p
                      className={`${classes.itemMeta} ${classes.statusRunning}`}
                    >
                      Generating…
                      {job.streamSpeaker?.character_name
                        ? ` · ${job.streamSpeaker.character_name}`
                        : ""}
                      {job.agentStatus
                        ? ` · agent ${job.agentStatus.name}`
                        : ""}
                    </p>
                    {job.streamThinking ? (
                      <div className={classes.block}>
                        <span className={classes.blockTitle}>Thinking</span>
                        <pre className={classes.streamPreview}>
                          {job.streamThinking}
                        </pre>
                      </div>
                    ) : null}
                    {job.streamText ? (
                      <div className={classes.block}>
                        <span className={classes.blockTitle}>Stream</span>
                        <pre className={classes.streamPreview}>
                          {job.streamText}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                  <div className={classes.itemActions}>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        void navigate({
                          to: "/chats/$chatId",
                          params: { chatId },
                        })
                      }
                    >
                      Open chat
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={classes.section} data-glass-surface>
        <h3 className={classes.sectionTitle}>Character imports</h3>
        {importSessions.length === 0 ? (
          <p className={classes.empty}>No background character imports.</p>
        ) : (
          <div className={classes.list}>
            {importSessions.map((session) => {
              const brief = session.context?.generatorBrief?.trim() ?? "";
              const relatedJob = jobs.find((job) => job.id === session.jobId);
              return (
                <div key={session.id} className={classes.itemColumn}>
                  <div className={classes.itemHeader}>
                    <div className={classes.itemMain}>
                      <p className={classes.itemTitle}>{session.fileName}</p>
                      <p
                        className={`${classes.itemMeta} ${
                          session.status === "generating"
                            ? classes.statusRunning
                            : session.status === "ready"
                              ? classes.statusReady
                              : session.status === "failed"
                                ? classes.statusFailed
                                : ""
                        }`}
                      >
                        {session.status === "generating"
                          ? "Generating with AI…"
                          : session.status === "ready"
                            ? `Ready for review · ${session.cards.length} card${session.cards.length === 1 ? "" : "s"}`
                            : session.status === "failed"
                              ? session.error || "Failed"
                              : session.status}
                        {" · "}
                        {formatWhen(session.createdAt)}
                      </p>
                    </div>
                    <div className={classes.itemActions}>
                      {session.status === "ready" ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => openReview(session.id)}
                        >
                          Review
                        </Button>
                      ) : null}
                      {relatedJob ? (
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() =>
                            setExpandedJobId((current) =>
                              current === relatedJob.id ? null : relatedJob.id,
                            )
                          }
                        >
                          {expandedJobId === relatedJob.id
                            ? "Hide prompt"
                            : "Show prompt"}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => dismissImport(session.id)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>

                  {session.context ? (
                    <dl className={classes.metaGrid}>
                      <div>
                        <dt>Connection</dt>
                        <dd>{session.context.connectionId}</dd>
                      </div>
                      <div>
                        <dt>Preset</dt>
                        <dd>{session.context.presetId}</dd>
                      </div>
                      <div>
                        <dt>Generator Preset</dt>
                        <dd>{session.context.generatorPresetId}</dd>
                      </div>
                      {session.context.personaId ? (
                        <div>
                          <dt>Persona</dt>
                          <dd>{session.context.personaId}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}

                  {brief ? (
                    <div className={classes.block}>
                      <span className={classes.blockTitle}>Generator brief</span>
                      <pre className={classes.code}>{brief}</pre>
                    </div>
                  ) : null}

                  {relatedJob && expandedJobId === relatedJob.id ? (
                    <GeneratorJobDetails job={relatedJob} />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={classes.section} data-glass-surface>
        <div className={classes.sectionHeader}>
          <h3 className={classes.sectionTitle}>Generator jobs</h3>
          {jobs.some((job) => job.status !== "running") ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => clearFinished()}
            >
              Clear finished
            </Button>
          ) : null}
        </div>
        {jobs.length === 0 ? (
          <p className={classes.empty}>No generator jobs yet.</p>
        ) : (
          <div className={classes.list}>
            {jobs.map((job) => {
              const expanded = expandedJobId === job.id;
              return (
                <div key={job.id} className={classes.itemColumn}>
                  <div className={classes.itemHeader}>
                    <div className={classes.itemMain}>
                      <p className={classes.itemTitle}>{job.title}</p>
                      <p
                        className={`${classes.itemMeta} ${
                          job.status === "running"
                            ? classes.statusRunning
                            : job.status === "completed"
                              ? classes.statusReady
                              : classes.statusFailed
                        }`}
                      >
                        {job.status}
                        {" · "}
                        {job.category}
                        {" · "}
                        {formatWhen(job.createdAt)}
                        {job.result?.model ? ` · ${job.result.model}` : ""}
                        {job.error ? ` · ${job.error}` : ""}
                      </p>
                    </div>
                    <div className={classes.itemActions}>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() =>
                          setExpandedJobId((current) =>
                            current === job.id ? null : job.id,
                          )
                        }
                      >
                        {expanded ? "Hide details" : "Details"}
                      </Button>
                      {job.sessionType === "character_import" &&
                      job.sessionId ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => openReview(job.sessionId!)}
                        >
                          Review
                        </Button>
                      ) : null}
                      {job.status !== "running" ? (
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => dismissJob(job.id)}
                        >
                          Dismiss
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {expanded ? <GeneratorJobDetails job={job} /> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
