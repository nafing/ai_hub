import { createFileRoute } from "@tanstack/react-router";
import { LorebooksPage } from "./-components/LorebooksPage";

export const Route = createFileRoute("/_app/lorebooks/")({
  component: LorebooksPage,
});
