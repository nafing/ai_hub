import { createFileRoute } from "@tanstack/react-router";
import { CharacterImportCardPage } from "./-components/CharacterImportCardPage";

export const Route = createFileRoute("/_app/characters/import/$cardId/")({
  component: CharacterImportCardPage,
});
