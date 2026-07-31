import { createFileRoute } from "@tanstack/react-router";
import { RegexesPage } from "./-components/RegexesPage";

export const Route = createFileRoute("/_app/regexes/")({
  component: RegexesPage,
});
