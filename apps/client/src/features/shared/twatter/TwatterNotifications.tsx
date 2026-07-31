import type { TwatterAccount, TwatterBootstrap } from "@ai-hub/shared";
import { useNavigate } from "@tanstack/react-router";
import { avatarSrc } from "@/lib/avatar-url";
import { api } from "@/lib/api";
import {
  useTwatterNotifications,
} from "@/features/api-queries/twatter/queries";
import classes from "./TwatterFeed.module.css";

type TwatterNotificationsProps = {
  bootstrap: TwatterBootstrap | undefined;
  personaId: string | null;
};

function actorAvatar(
  account: TwatterAccount | undefined,
  apiBase: string,
): string | null {
  if (!account) return null;
  if (account.kind === "persona") {
    return avatarSrc(account.avatar, apiBase);
  }
  if (account.kind === "character") {
    return avatarSrc(account.avatar, apiBase);
  }
  return null;
}

export function TwatterNotifications({
  bootstrap,
  personaId,
}: TwatterNotificationsProps) {
  const navigate = useNavigate();
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

  function openProfile(accountId: string) {
    void navigate({
      to: "/twatter/profile/$accountId",
      params: { accountId },
    });
  }

  return (
    <div className={classes.panel}>
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
                onClick={() => openProfile(notification.actor_account_id)}
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
