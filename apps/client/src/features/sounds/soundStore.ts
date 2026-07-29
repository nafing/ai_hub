import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SoundCategory = "chat" | "generator" | "twatter";

interface SoundState {
  enabled: boolean;
  volume: number;
  chat: boolean;
  generator: boolean;
  twatter: boolean;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setCategoryEnabled: (category: SoundCategory, enabled: boolean) => void;
}

export const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      enabled: true,
      volume: 0.35,
      chat: true,
      generator: true,
      twatter: true,

      setEnabled: (enabled) => set({ enabled }),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
      setCategoryEnabled: (category, enabled) =>
        set(
          category === "chat"
            ? { chat: enabled }
            : category === "generator"
              ? { generator: enabled }
              : { twatter: enabled },
        ),
    }),
    { name: "ai-hub-sounds" },
  ),
);

export function isSoundCategoryEnabled(category: SoundCategory): boolean {
  const state = useSoundStore.getState();
  if (!state.enabled) return false;
  return state[category];
}

export function getSoundVolume(): number {
  return useSoundStore.getState().volume;
}
