import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatFormatState {
  /** Bold quoted dialogue spans in chat messages. */
  dialogueBold: boolean;
  setDialogueBold: (value: boolean) => void;
}

export const useChatFormatStore = create<ChatFormatState>()(
  persist(
    (set) => ({
      dialogueBold: false,
      setDialogueBold: (dialogueBold) => set({ dialogueBold }),
    }),
    { name: "ai-hub-chat-format" },
  ),
);
