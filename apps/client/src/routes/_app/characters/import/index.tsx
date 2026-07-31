import { createFileRoute } from "@tanstack/react-router";
import { CharacterImportPage } from "./-components/CharacterImportPage";

export const Route = createFileRoute("/_app/characters/import/")({
  component: CharacterImportPage,
});
