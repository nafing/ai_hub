import { createFileRoute } from "@tanstack/react-router";
import { TwatterSubpageHeader } from "@/features/twatter/TwatterSubpageHeader";
import { TwatterSearch } from "@/features/twatter/TwatterSearch";
import { useTwatterPersona } from "@/features/twatter/TwatterPersonaContext";
import { useTwatterBootstrap } from "@/features/twatter/queries";

export const Route = createFileRoute("/_twatter/twatter/search")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data } = useTwatterBootstrap();
  const { personaId, personaAccount } = useTwatterPersona();

  return (
    <>
      <TwatterSubpageHeader title="Explore" />
      <TwatterSearch
        bootstrap={data}
        personaId={personaId}
        personaAccount={personaAccount}
      />
    </>
  );
}
