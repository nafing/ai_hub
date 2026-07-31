import { createFileRoute } from "@tanstack/react-router";
import { RegexDetailPage } from "./-components/RegexDetailPage";

export const Route = createFileRoute("/_app/regexes/$regexId/")({
  component: RegexDetailPage,
});
