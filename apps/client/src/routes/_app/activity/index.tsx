import { createFileRoute } from "@tanstack/react-router";
import { ActivityPage } from "./-components/ActivityPage";

export const Route = createFileRoute("/_app/activity/")({
  component: ActivityPage,
});
