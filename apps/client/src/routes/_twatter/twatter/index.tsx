import { useState } from "react";
import type { TwatterPost, TwatterTimelineTab } from "@ai-hub/shared";
import { createFileRoute } from "@tanstack/react-router";
import { ComposePost, useFilteredTwatterPosts } from "@/features/shared/twatter/ComposePost";
import { PostCard } from "@/features/shared/twatter/PostCard";
import { TwatterPageHeader } from "@/features/shared/twatter/TwatterPageHeader";
import { TwatterRefreshTimeline } from "@/features/shared/twatter/TwatterRefreshTimeline";
import { useTwatterPersona } from "@/features/shared/twatter/TwatterPersonaContext";
import { useTwatterBootstrap } from "@/features/api-queries/twatter/queries";
import classes from "@/features/shared/twatter/TwatterFeed.module.css";

export const Route = createFileRoute("/_twatter/twatter/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data, isLoading, isError } = useTwatterBootstrap();
  const { personaId, personaAccount } = useTwatterPersona();
  const [tab, setTab] = useState<TwatterTimelineTab>("main");
  const [replyTo, setReplyTo] = useState<TwatterPost | null>(null);

  const filteredPosts = useFilteredTwatterPosts({
    tab,
    personaAccount,
    posts: data?.posts ?? [],
  });

  return (
    <>
      <TwatterPageHeader
        tabs={[
          {
            id: "main",
            label: "For you",
            active: tab === "main",
            onClick: () => setTab("main"),
          },
          {
            id: "following",
            label: "Following",
            active: tab === "following",
            onClick: () => setTab("following"),
          },
        ]}
      />

      <div className={classes.mobileRefreshBar}>
        <TwatterRefreshTimeline />
      </div>

      <div className={classes.feed}>
        <ComposePost
          personaId={personaId}
          personaAccount={personaAccount}
          accounts={data?.accounts ?? []}
          replyToPost={replyTo}
          onPosted={() => setReplyTo(null)}
          onCancelReply={() => setReplyTo(null)}
        />

        {isLoading ? (
          <div className={classes.loading}>
            <div className={classes.spinner} aria-label="Loading" />
          </div>
        ) : null}

        {isError ? (
          <p className={classes.statusError}>Failed to load Twatter.</p>
        ) : null}

        {!isLoading && !isError && filteredPosts.length === 0 ? (
          <p className={classes.status}>
            {tab === "following"
              ? "Nothing from followed characters yet."
              : "The plate is empty. Invite characters in Settings, pick a connection, then refresh."}
          </p>
        ) : null}

        {!isLoading && !isError && filteredPosts.length > 0 ? (
          <div className={classes.postList}>
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                posts={data?.posts ?? []}
                accounts={data?.accounts ?? []}
                interactions={data?.interactions ?? []}
                personaId={personaId}
                personaAccount={personaAccount}
                onReply={setReplyTo}
              />
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
