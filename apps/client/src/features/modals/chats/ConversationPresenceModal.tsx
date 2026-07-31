import { Modal } from "@/components/ui";
import type { Chat } from "@ai-hub/shared";
import { ConversationPresenceCard } from "./ConversationPresenceCard";

type ConversationPresenceModalProps = {
  chat: Chat;
  opened: boolean;
  onClose: () => void;
};

export function ConversationPresenceModal({
  chat,
  opened,
  onClose,
}: ConversationPresenceModalProps) {
  if (chat.mode !== "conversation") return null;

  return (
    <Modal opened={opened} onClose={onClose} title="Presence" size="md">
      <ConversationPresenceCard chat={chat} active={opened} />
    </Modal>
  );
}
