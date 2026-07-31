import { useEffect, useRef } from "react";
import type { Chat, GenerateChatInput } from "@ai-hub/shared";
import { api } from "@/lib/api";

type AutonomousCheckResult = {
  shouldTrigger: boolean;
  characterId?: string;
  characterName?: string;
  intentKey?: string;
  reason?: string;
};

type BusyDelayResult = { delayMs: number };
type ExchangeResult = {
  shouldTrigger: boolean;
  characterId?: string;
  characterName?: string;
};

type UseAutonomousMessagingOptions = {
  chat: Chat;
  streaming: boolean;
  generate: (input: GenerateChatInput) => Promise<void>;
};

/**
 * Marinara-style client poller: while a conversation chat is open and
 * autonomous_messages is enabled, check every 30s for unprompted replies.
 */
export function useAutonomousMessaging({
  chat,
  streaming,
  generate,
}: UseAutonomousMessagingOptions): void {
  const generateRef = useRef(generate);
  generateRef.current = generate;
  const busyRef = useRef(false);

  useEffect(() => {
    if (chat.mode !== "conversation") return;
    if (!chat.settings.autonomous_messages) return;

    let cancelled = false;
    let timer: number | undefined;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    const tick = async () => {
      if (cancelled || busyRef.current || streaming) return;
      if (document.visibilityState === "hidden") return;

      busyRef.current = true;
      try {
        await api.post("/conversation/activity/presence", {
          chatId: chat.id,
          presence: "active",
        });

        const { data: check } = await api.post<AutonomousCheckResult>(
          "/conversation/autonomous/check",
          { chatId: chat.id },
        );
        if (!check.shouldTrigger || !check.characterId || cancelled) {
          if (!check.shouldTrigger) {
            await api.post("/conversation/autonomous/clear-in-progress", {
              chatId: chat.id,
            });
          }
          return;
        }

        const { data: delay } = await api.post<BusyDelayResult>(
          "/conversation/busy-delay",
          { chatId: chat.id, characterId: check.characterId },
        );
        if (delay.delayMs > 0) {
          await sleep(Math.min(delay.delayMs, 5 * 60_000));
        }
        if (cancelled) return;

        await generateRef.current({
          forCharacterId: check.characterId,
          autonomous: true,
          autonomous_intent_key: check.intentKey,
          skip_presence_delay: true,
        });

        if (chat.settings.character_exchanges && chat.settings.character_ids.length > 1) {
          const { data: exchange } = await api.post<ExchangeResult>(
            "/conversation/autonomous/exchange",
            {
              chatId: chat.id,
              excludeCharacterId: check.characterId,
            },
          );
          if (exchange.shouldTrigger && exchange.characterId && !cancelled) {
            await sleep(2000 + Math.floor(Math.random() * 3000));
            await generateRef.current({
              forCharacterId: exchange.characterId,
              autonomous: true,
              skip_presence_delay: true,
            });
          }
        }
      } catch {
        await api
          .post("/conversation/autonomous/clear-in-progress", {
            chatId: chat.id,
          })
          .catch(() => undefined);
      } finally {
        busyRef.current = false;
      }
    };

    const start = window.setTimeout(() => {
      void tick();
      timer = window.setInterval(() => {
        void tick();
      }, 30_000);
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearTimeout(start);
      if (timer) window.clearInterval(timer);
    };
  }, [
    chat.id,
    chat.mode,
    chat.settings.autonomous_messages,
    chat.settings.character_exchanges,
    chat.settings.character_ids.length,
    streaming,
  ]);
}
