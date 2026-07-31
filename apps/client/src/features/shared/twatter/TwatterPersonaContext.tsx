import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { countUnreadTwatterNotifications, type TwatterAccount } from "@ai-hub/shared";
import { usePersonas } from "@/features/api-queries/personas/queries";
import { playAppSound } from "@/features/shared/sounds";
import { useTwatterBootstrap } from "@/features/api-queries/twatter/queries";

type TwatterPersonaContextValue = {
  personaId: string | null;
  setPersonaId: (personaId: string) => void;
  personaAccount: TwatterAccount | null;
  unreadCount: number;
};

const TwatterPersonaContext = createContext<TwatterPersonaContextValue | null>(
  null,
);

export function TwatterPersonaProvider({ children }: { children: ReactNode }) {
  const { data: personas } = usePersonas();
  const { data: bootstrap } = useTwatterBootstrap();

  const defaultPersonaId =
    personas?.find((persona) => persona.is_default)?.id ??
    personas?.[0]?.id ??
    null;

  const [personaId, setPersonaId] = useState<string | null>(defaultPersonaId);
  const activePersonaId = personaId ?? defaultPersonaId;

  const personaAccount = useMemo(() => {
    if (!activePersonaId || !bootstrap) return null;
    return (
      bootstrap.accounts.find(
        (account) =>
          account.kind === "persona" && account.entity_id === activePersonaId,
      ) ?? null
    );
  }, [activePersonaId, bootstrap]);

  const unreadCount = useMemo(() => {
    if (!personaAccount || !bootstrap) return 0;
    return countUnreadTwatterNotifications({
      personaAccount,
      posts: bootstrap.posts,
      interactions: bootstrap.interactions,
      accounts: bootstrap.accounts,
    });
  }, [personaAccount, bootstrap]);

  const previousUnreadRef = useRef<number | null>(null);
  useEffect(() => {
    if (previousUnreadRef.current === null) {
      previousUnreadRef.current = unreadCount;
      return;
    }
    if (unreadCount > previousUnreadRef.current) {
      playAppSound("twatter", "notification");
    }
    previousUnreadRef.current = unreadCount;
  }, [unreadCount]);

  const value = useMemo(
    () => ({
      personaId: activePersonaId,
      setPersonaId,
      personaAccount,
      unreadCount,
    }),
    [activePersonaId, personaAccount, unreadCount],
  );

  return (
    <TwatterPersonaContext.Provider value={value}>
      {children}
    </TwatterPersonaContext.Provider>
  );
}

export function useTwatterPersona() {
  const context = useContext(TwatterPersonaContext);
  if (!context) {
    throw new Error("useTwatterPersona must be used within TwatterPersonaProvider");
  }
  return context;
}
