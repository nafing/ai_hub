import { createFileRoute } from "@tanstack/react-router";
import { TwatterAppBackButton } from "@/features/twatter/TwatterAppBackButton";
import { TwatterPageHeader } from "@/features/twatter/TwatterPageHeader";
import { TwatterProfile } from "@/features/twatter/TwatterProfile";
import { useTwatterPersona } from "@/features/twatter/TwatterPersonaContext";
import {
  useTwatterAccountProfile,
  useTwatterBootstrap,
} from "@/features/twatter/queries";
import shellClasses from "@/features/twatter/TwatterShell.module.css";

export const Route = createFileRoute("/_twatter/twatter/profile/$accountId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { accountId } = Route.useParams();
  const { personaId, personaAccount } = useTwatterPersona();
  const { data: bootstrap } = useTwatterBootstrap();
  const profileQuery = useTwatterAccountProfile(accountId, personaId);

  return (
    <>
      <TwatterPageHeader
        title={profileQuery.data?.display_name || "Profile"}
        className={shellClasses.subpageHeader}
        leading={
          <span className={shellClasses.desktopOnly}>
            <TwatterAppBackButton />
          </span>
        }
        trailing={<span className={shellClasses.headerSpacer} aria-hidden />}
      />
      <TwatterProfile
        accountId={accountId}
        personaId={personaId}
        personaAccount={personaAccount}
        interactions={bootstrap?.interactions ?? []}
        accounts={bootstrap?.accounts ?? []}
      />
    </>
  );
}
