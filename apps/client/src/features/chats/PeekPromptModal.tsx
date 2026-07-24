import { useEffect, useState } from "react";
import {
  Code,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import type { PeekPromptResult } from "@ai-hub/shared";
import { peekChatPrompt } from "./api";

type PeekPromptModalProps = {
  opened: boolean;
  onClose: () => void;
  chatId: string;
  messageId: string;
};

export function PeekPromptModal({
  opened,
  onClose,
  chatId,
  messageId,
}: PeekPromptModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PeekPromptResult | null>(null);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    void peekChatPrompt(chatId, messageId)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load prompt");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, chatId, messageId]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        result
          ? `Peek prompt — ${result.character_name}`
          : "Peek prompt"
      }
      size="xl"
    >
      {loading ? (
        <Loader size="sm" />
      ) : error ? (
        <Text c="red" size="sm">
          {error}
        </Text>
      ) : result ? (
        <ScrollArea.Autosize mah="70vh">
          <Stack gap="md">
            {result.messages.map((message, index) => (
              <Stack key={`${message.role}-${index}`} gap={4}>
                <Text size="xs" tt="uppercase" c="dimmed" fw={600}>
                  {message.role}
                </Text>
                <Code block style={{ whiteSpace: "pre-wrap" }}>
                  {message.content}
                </Code>
              </Stack>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      ) : null}
    </Modal>
  );
}
