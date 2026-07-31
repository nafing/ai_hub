import { useState } from "react";
import type { TwatterAccount, TwatterBootstrap } from "@ai-hub/shared";
import { useNavigate } from "@tanstack/react-router";
import { Button, TextInput } from "@/components/ui";
import { PostCard } from "./PostCard";
import { useTwatterSearch } from "./queries";
import classes from "./TwatterFeed.module.css";

type TwatterSearchProps = {
  bootstrap: TwatterBootstrap | undefined;
  personaId: string | null;
  personaAccount: TwatterAccount | null;
};

export function TwatterSearch({
  bootstrap,
  personaId,
  personaAccount,
}: TwatterSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const searchQuery = useTwatterSearch(submitted);

  const results = searchQuery.data ?? { accounts: [], posts: [] };

  function openProfile(accountId: string) {
    void navigate({
      to: "/twatter/profile/$accountId",
      params: { accountId },
    });
  }

  return (
    <div className={classes.panel}>
      <form
        className={classes.searchForm}
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Twatter accounts and posts"
        />
        <Button type="submit" variant="primary" disabled={!query.trim()}>
          Search
        </Button>
      </form>

      {submitted && searchQuery.isLoading ? (
        <p className={classes.status}>Searching…</p>
      ) : null}

      {submitted && !searchQuery.isLoading ? (
        <>
          <section className={classes.searchSection}>
            <h3 className={classes.panelHeading}>Accounts</h3>
            {results.accounts.length === 0 ? (
              <p className={classes.status}>No matching accounts.</p>
            ) : (
              <div className={classes.searchAccountList}>
                {results.accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    className={classes.searchAccountRow}
                    onClick={() => openProfile(account.id)}
                  >
                    <span className={classes.searchAccountName}>
                      {account.display_name}
                    </span>
                    <span className={classes.searchAccountHandle}>
                      {account.handle}
                    </span>
                    {account.bio ? (
                      <span className={classes.searchAccountBio}>{account.bio}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={classes.searchSection}>
            <h3 className={classes.panelHeading}>Posts</h3>
            {results.posts.length === 0 ? (
              <p className={classes.status}>No matching posts.</p>
            ) : (
              <div className={classes.postList}>
                {results.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    posts={bootstrap?.posts ?? results.posts}
                    accounts={bootstrap?.accounts ?? []}
                    interactions={bootstrap?.interactions ?? []}
                    personaId={personaId}
                    personaAccount={personaAccount}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {!submitted ? (
        <p className={classes.status}>Search by handle, name, bio, or post text.</p>
      ) : null}
    </div>
  );
}
