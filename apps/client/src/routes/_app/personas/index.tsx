import { createFileRoute } from "@tanstack/react-router";
import { PersonasPage } from "./-components/PersonasPage";

export const Route = createFileRoute("/_app/personas/")({
  component: PersonasPage,
});
