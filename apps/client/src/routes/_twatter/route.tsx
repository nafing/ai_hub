import { createFileRoute } from "@tanstack/react-router";
import { TwatterShell } from "@/features/twatter/TwatterShell";

export const Route = createFileRoute("/_twatter")({
  component: TwatterShell,
});
