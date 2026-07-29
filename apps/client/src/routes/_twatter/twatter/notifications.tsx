import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { TwatterNotifications } from "@/features/twatter/TwatterNotifications";
import { TwatterSubpageHeader } from "@/features/twatter/TwatterSubpageHeader";
import { useTwatterPersona } from "@/features/twatter/TwatterPersonaContext";
import {
  useMarkTwatterNotificationsRead,
  useTwatterBootstrap,
} from "@/features/twatter/queries";

export const Route = createFileRoute("/_twatter/twatter/notifications")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data } = useTwatterBootstrap();
  const { personaId, unreadCount } = useTwatterPersona();
  const markReadMutation = useMarkTwatterNotificationsRead();
  const markedRef = useRef(false);

  useEffect(() => {
    if (personaId && unreadCount > 0 && !markedRef.current) {
      markedRef.current = true;
      markReadMutation.mutate(personaId);
    }
  }, [personaId, unreadCount, markReadMutation]);

  return (
    <>
      <TwatterSubpageHeader title="Notifications" />
      <TwatterNotifications bootstrap={data} personaId={personaId} />
    </>
  );
}
