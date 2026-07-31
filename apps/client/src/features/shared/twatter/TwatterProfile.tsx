import { useMemo, useState } from "react";
import type { TwatterAccount, TwatterInteraction } from "@ai-hub/shared";
import { Button, TextInput, Textarea } from "@/components/ui";
import { characterAvatarSrc } from "@/features/characters/avatar-url";
import { personaAvatarSrc } from "@/features/personas/avatar-url";
import { api } from "@/lib/api";
import { PostCard } from "./PostCard";
import {
  useSetTwatterFollow,
  useTwatterAccountProfile,
  useUpdateTwatterProfile,
} from "./queries";
import classes from "./TwatterFeed.module.css";

type TwatterProfileProps = {
  accountId: string | null;
  personaId: string | null;
  personaAccount: TwatterAccount | null;
  accounts: TwatterAccount[];
  interactions: TwatterInteraction[];
};

export function TwatterProfile({
  accountId,
  personaId,
  personaAccount,
  accounts,
  interactions,
}: TwatterProfileProps) {
  const profileQuery = useTwatterAccountProfile(accountId, personaId);
  const updateProfile = useUpdateTwatterProfile();
  const followMutation = useSetTwatterFollow();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");

  const profile = profileQuery.data;
  const apiBase = String(api.defaults.baseURL);

  const avatarSrc = useMemo(() => {
    if (!profile) return null;
    if (profile.kind === "persona") {
      return personaAvatarSrc(profile.avatar, apiBase);
    }
    if (profile.kind === "character") {
      return characterAvatarSrc(profile.avatar, apiBase);
    }
    return null;
  }, [profile, apiBase]);

  if (!accountId) {
    return (
      <p className={classes.status}>Select a profile from search or a mention.</p>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <div className={classes.loading}>
        <div className={classes.spinner} aria-label="Loading" />
      </div>
    );
  }

  if (!profile) {
    return <p className={classes.statusError}>Profile not found.</p>;
  }

  const isOwnProfile = personaAccount?.id === profile.id;
  const isFollowing = personaAccount
    ? personaAccount.settings.social.following_account_ids.includes(profile.id)
    : false;
  const canFollow =
    Boolean(personaId && personaAccount && profile.kind === "character");

  function startEditing() {
    setDisplayName(profile!.display_name);
    setHandle(profile!.handle);
    setBio(profile!.bio);
    setLocation(profile!.settings.profile.location ?? "");
    setEditing(true);
  }

  function saveProfile() {
    if (!personaId || !isOwnProfile) return;
    updateProfile.mutate(
      {
        accountId: profile!.id,
        input: {
          persona_id: personaId,
          display_name: displayName,
          handle,
          bio,
          location,
        },
      },
      { onSuccess: () => setEditing(false) },
    );
  }

  return (
    <div className={classes.profileShell}>
      <div className={classes.profileBanner} aria-hidden />

      <div className={classes.profileHeader}>
        <div className={classes.profileTopRow}>
          {avatarSrc ? (
            <img
              className={classes.profileAvatar}
              src={avatarSrc}
              alt=""
              width={88}
              height={88}
            />
          ) : (
            <span className={classes.profileAvatarFallback} aria-hidden>
              {profile.display_name.slice(0, 1).toUpperCase()}
            </span>
          )}

          {!editing ? (
            <div className={classes.profileActions}>
              {isOwnProfile ? (
                <Button type="button" variant="default" onClick={startEditing}>
                  Edit profile
                </Button>
              ) : null}
              {canFollow ? (
                <Button
                  type="button"
                  variant={isFollowing ? "default" : "primary"}
                  disabled={followMutation.isPending}
                  onClick={() =>
                    personaAccount &&
                    personaId &&
                    followMutation.mutate({
                      followerAccountId: personaAccount.id,
                      targetAccountId: profile.id,
                      input: {
                        persona_id: personaId,
                        following: !isFollowing,
                      },
                    })
                  }
                >
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={classes.profileMeta}>
          {editing ? (
            <div className={classes.profileEditForm}>
              <TextInput
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Display name"
              />
              <TextInput
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                placeholder="@handle"
              />
              <Textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Bio"
                rows={3}
              />
              <TextInput
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Location"
              />
              <div className={classes.profileEditActions}>
                <Button type="button" variant="default" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={updateProfile.isPending}
                  onClick={saveProfile}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h2 className={classes.profileName}>{profile.display_name}</h2>
              <p className={classes.profileHandle}>{profile.handle}</p>
              {profile.bio ? <p className={classes.profileBio}>{profile.bio}</p> : null}
              {profile.settings.profile.location ? (
                <p className={classes.profileLocation}>
                  {profile.settings.profile.location}
                </p>
              ) : null}
              <p className={classes.profileStats}>
                <span>{profile.follower_count} followers</span>
                <span>{profile.following_count} following</span>
              </p>
            </>
          )}
        </div>
      </div>

      <section className={classes.profilePosts}>
        <div className={classes.profilePostsTabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected
            className={classes.profilePostsTabActive}
          >
            Posts
          </button>
        </div>

        {profile.posts.length === 0 ? (
          <p className={classes.status}>No posts yet.</p>
        ) : (
          <div className={classes.postList}>
            {profile.posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                posts={profile.posts}
                accounts={accounts}
                interactions={interactions}
                personaId={personaId}
                personaAccount={personaAccount}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
