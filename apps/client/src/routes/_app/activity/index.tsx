import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui";
import { useCharacterImportSessionStore } from "@/features/characters/characterImportSessionStore";
import { chatKeys, useChatGenerationStore } from "@/features/chats/shared";
import { useGeneratorJobsStore } from "@/features/generators/generatorJobsStore";
import { queryClient } from "@/lib/queryClient";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/activity/")({
  component: RouteComponent,
});

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString();
}

function RouteComponent() {
  const navigate = useNavigate();
  const jobs = useGeneratorJobsStore((state) => state.jobs);
  const dismissJob = useGeneratorJobsStore((state) => state.dismissJob);
  const importSessions = useCharacterImportSessionStore((state) => state.sessions);
  const openReview = useCharacterImportSessionStore((state) => state.openReview);
  const dismissImport = useCharacterImportSessionStore((state) => state.dismiss);
  const chatJobs = useChatGenerationStore((state) => state.jobs);

  const activeChatJobs = Object.entries(chatJobs).filter(
    ([, job]) => job.streaming,
  );

  return (
    <div className={classes.activityPage}>
      <header className={classes.header}>
        <h2 className={classes.title}>Activity</h2>
        <p className={classes.subtitle}>
          Background chat replies, generator runs, and AI character imports.
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
                    <p className={`${classes.itemMeta} ${classes.statusRunning}`}>
                      Generating…
                      {job.streamSpeaker?.character_name
                        ? ` · ${job.streamSpeaker.character_name}`
                        : ""}
                    </p>
                    {job.streamText ? (
                      <p className={classes.streamPreview}>{job.streamText}</p>
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
            {importSessions.map((session) => (
              <div key={session.id} className={classes.item}>
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
            ))}
          </div>
        )}
      </section>

      <section className={classes.section} data-glass-surface>
        <h3 className={classes.sectionTitle}>Generator jobs</h3>
        {jobs.length === 0 ? (
          <p className={classes.empty}>No generator jobs yet.</p>
        ) : (
          <div className={classes.list}>
            {jobs.map((job) => (
              <div key={job.id} className={classes.item}>
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
                    {job.error ? ` · ${job.error}` : ""}
                  </p>
                </div>
                <div className={classes.itemActions}>
                  {job.sessionType === "character_import" && job.sessionId ? (
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
