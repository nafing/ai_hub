import { createFileRoute } from "@tanstack/react-router";
import { CharactersPage } from "./-components/CharactersPage";

export const Route = createFileRoute("/_app/characters/")({
  component: CharactersPage,
});
