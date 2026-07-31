import { createFileRoute } from "@tanstack/react-router";
import { LorebookDetailPage } from "./-components/LorebookDetailPage";

export const Route = createFileRoute("/_app/lorebooks/$lorebookId/")({
  component: LorebookDetailPage,
});
