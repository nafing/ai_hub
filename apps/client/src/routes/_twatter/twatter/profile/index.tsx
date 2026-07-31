import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useTwatterPersona } from "@/features/shared/twatter/TwatterPersonaContext";

export const Route = createFileRoute("/_twatter/twatter/profile/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { personaAccount } = useTwatterPersona();

  if (!personaAccount) {
    return null;
  }

  return (
    <Navigate
      to="/twatter/profile/$accountId"
      params={{ accountId: personaAccount.id }}
      replace
    />
  );
}
