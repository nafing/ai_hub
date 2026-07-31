import { createFileRoute } from "@tanstack/react-router";
import { PersonaDetailPage } from "./-components/PersonaDetailPage";

export const Route = createFileRoute("/_app/personas/$personaId/")({
  component: PersonaDetailPage,
});
