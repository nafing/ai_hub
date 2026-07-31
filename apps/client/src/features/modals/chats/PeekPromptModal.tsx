import { useEffect, useState } from "react";
import type { PeekPromptResult } from "@ai-hub/shared";
import { Modal, RuntimeText } from "@/components/ui";
import { peekChatPrompt } from "./api";
import classes from "./PeekPromptModal.module.css";

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
          setError(
            err instanceof Error ? err.message : "Failed to load prompt",
          );
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
        result ? `Peek prompt — ${result.character_name}` : "Peek prompt"
      }
      size="xl"
    >
      {loading ? (
        <div className={classes.loading}>
          <div className={classes.spinner} aria-label="Loading" />
        </div>
      ) : error ? (
        <p className={classes.error}>{error}</p>
      ) : result ? (
        <div className={classes.scroll}>
          <div className={classes.stack}>
            {(result.command_tags?.length ?? 0) > 0 ||
            (result.image_prompts?.length ?? 0) > 0 ? (
              <section className={classes.loreSection}>
                <div className={classes.loreHeader}>
                  <p className={classes.role}>Conversation commands</p>
                </div>
                {(result.command_tags ?? []).length > 0 ? (
                  <ul className={classes.loreList}>
                    {(result.command_tags ?? []).map((tag, index) => (
                      <li key={`${tag}-${index}`} className={classes.loreItem}>
                        <pre className={classes.code}>{tag}</pre>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {(result.image_prompts ?? []).map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className={classes.loreItem}
                  >
                    <div className={classes.loreItemTop}>
                      <span className={classes.loreName}>{item.name}</span>
                      <span className={classes.loreSource}>image</span>
                    </div>
                    {item.command ? (
                      <pre className={classes.lorePreview}>{item.command}</pre>
                    ) : null}
                    {item.prompt ? (
                      <pre className={classes.code}>{item.prompt}</pre>
                    ) : null}
                  </div>
                ))}
              </section>
            ) : null}

            <section className={classes.loreSection}>
              <div className={classes.loreHeader}>
                <p className={classes.role}>Lore retrieval</p>
                <p className={classes.loreMeta}>
                  {(result.lore_hits ?? []).length} hit
                  {(result.lore_hits ?? []).length === 1 ? "" : "s"}
                  {(result.lore_token_estimate ?? 0) > 0
                    ? ` · ~${result.lore_token_estimate} tok`
                    : null}
                </p>
              </div>
              {(result.lore_hits ?? []).length === 0 ? (
                <p className={classes.loreEmpty}>
                  No lore entries selected for this turn.
                </p>
              ) : (
                <ul className={classes.loreList}>
                  {(result.lore_hits ?? []).map((hit, index) => (
                    <li
                      key={`${hit.lorebook_id}-${hit.entry_name}-${index}`}
                      className={classes.loreItem}
                    >
                      <div className={classes.loreItemTop}>
                        <span className={classes.loreName}>
                          {hit.entry_name}
                        </span>
                        <span className={classes.loreSource}>{hit.source}</span>
                      </div>
                      <p className={classes.loreBook}>{hit.lorebook_name}</p>
                      {hit.preview ? (
                        <pre className={classes.lorePreview}>
                          <RuntimeText
                            as="span"
                            text={hit.preview}
                            values={{ char: result.character_name }}
                          />
                        </pre>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {result.messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={classes.block}>
                <p className={classes.role}>{message.role}</p>
                <pre className={classes.code}>
                  <RuntimeText
                    as="span"
                    text={message.content}
                    values={{ char: result.character_name }}
                  />
                </pre>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
