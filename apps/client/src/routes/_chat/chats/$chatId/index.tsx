import { createFileRoute } from "@tanstack/react-router";
import { ChatPage } from "./-components/ChatPage";

export const Route = createFileRoute("/_chat/chats/$chatId/")({
  component: ChatPage,
});
