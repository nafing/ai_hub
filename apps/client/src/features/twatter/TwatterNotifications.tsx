import type { TwatterAccount, TwatterBootstrap } from "@ai-hub/shared";
import { characterAvatarSrc } from "@/features/characters/avatar-url";
import { personaAvatarSrc } from "@/features/personas/avatar-url";
import { api } from "@/lib/api";
import {
  useTwatterNotifications,
} from "./queries";
import classes from "./TwatterFeed.module.css";

type TwatterNotificationsProps = {
  bootstrap: TwatterBootstrap | undefined;
  personaId: string | null;
  onOpenProfile: (accountId: string) => void;
};

function actorAvatar(
  account: TwatterAccount | undefined,
  apiBase: string,
): string | null {
  if (!account) return null;
  if (account.kind === "persona") {
    return personaAvatarSrc(account.avatar, apiBase);
  }
  if (account.kind === "character") {
    return characterAvatarSrc(account.avatar, apiBase);
  }
  return null;
}

export function TwatterNotifications({
  bootstrap,
  personaId,
  onOpenProfile,
}: TwatterNotificationsProps) {
  const notificationsQuery = useTwatterNotifications(personaId, false);
  const apiBase = String(api.defaults.baseURL);

  if (!personaId) {
    return (
      <p className={classes.status}>Choose an active persona to view notifications.</p>
    );
  }

  if (notificationsQuery.isLoading) {
    return (
      <div className={classes.loading}>
        <div className={classes.spinner} aria-label="Loading" />
      </div>
    );
  }

  const notifications = notificationsQuery.data?.notifications ?? [];
  const accountById = new Map(
    (bootstrap?.accounts ?? []).map((account) => [account.id, account]),
  );

  return (
    <div className={classes.panel}>
      <div className={classes.panelHeader}>
        <h2 className={classes.panelTitle}>Notifications</h2>
      </div>

      {notifications.length === 0 ? (
        <p className={classes.status}>No notifications yet.</p>
      ) : (
        <div className={classes.notificationList}>
          {notifications.map((notification) => {
            const actor = accountById.get(notification.actor_account_id);
            const avatar = actorAvatar(actor, apiBase);
            const initial = (actor?.display_name || "?").slice(0, 1).toUpperCase();
            return (
              <button
                key={notification.id}
                type="button"
                className={classes.notificationRow}
                onClick={() => onOpenProfile(notification.actor_account_id)}
              >
                {avatar ? (
                  <img
                    className={classes.avatar}
                    src={avatar}
                    alt=""
                    width={36}
                    height={36}
                  />
                ) : (
                  <span className={classes.avatarFallback} aria-hidden>
                    {initial}
                  </span>
                )}
                <span className={classes.notificationBody}>
                  <span className={classes.notificationContent}>
                    {notification.content}
                  </span>
                  <time
                    className={classes.notificationTime}
                    dateTime={notification.created_at}
                  >
                    {new Date(notification.created_at).toLocaleString()}
                  </time>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
