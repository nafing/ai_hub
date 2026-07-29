import { createFileRoute } from "@tanstack/react-router";
import { TwatterProfile } from "@/features/twatter/TwatterProfile";
import { useTwatterPersona } from "@/features/twatter/TwatterPersonaContext";
import {
  useTwatterAccountProfile,
  useTwatterBootstrap,
} from "@/features/twatter/queries";

export const Route = createFileRoute("/_twatter/twatter/profile/$accountId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { accountId } = Route.useParams();
  const { personaId, personaAccount } = useTwatterPersona();
  const { data: bootstrap } = useTwatterBootstrap();
  useTwatterAccountProfile(accountId, personaId);

  return (
    <TwatterProfile
      accountId={accountId}
      personaId={personaId}
      personaAccount={personaAccount}
      interactions={bootstrap?.interactions ?? []}
      accounts={bootstrap?.accounts ?? []}
    />
  );
}
