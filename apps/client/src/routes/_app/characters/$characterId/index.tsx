import { createFileRoute } from "@tanstack/react-router";
import { CharacterDetailPage } from "./-components/CharacterDetailPage";

export const Route = createFileRoute("/_app/characters/$characterId/")({
  component: CharacterDetailPage,
});
