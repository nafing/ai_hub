import type { SoundCategory } from "./soundStore";
import { getSoundVolume, isSoundCategoryEnabled } from "./soundStore";

export type SoundVariant = "success" | "notification" | "error";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!("AudioContext" in window)) return null;

  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }
  return audioContext;
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

function schedulePattern(
  category: SoundCategory,
  variant: SoundVariant,
  volume: number,
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const peak = volume;

  if (category === "chat") {
    if (variant === "error") {
      playTone(ctx, 220, now, 0.12, peak, "triangle");
      playTone(ctx, 185, now + 0.1, 0.16, peak * 0.9, "triangle");
      return;
    }
    playTone(ctx, 523.25, now, 0.09, peak * 0.85, "sine");
    playTone(ctx, 659.25, now + 0.08, 0.11, peak, "sine");
    return;
  }

  if (category === "generator") {
    if (variant === "error") {
      playTone(ctx, 196, now, 0.14, peak, "square");
      return;
    }
    playTone(ctx, 440, now, 0.07, peak * 0.75, "sine");
    playTone(ctx, 554.37, now + 0.07, 0.07, peak * 0.85, "sine");
    playTone(ctx, 659.25, now + 0.14, 0.12, peak, "sine");
    return;
  }

  if (variant === "notification") {
    playTone(ctx, 880, now, 0.05, peak * 0.8, "sine");
    playTone(ctx, 987.77, now + 0.07, 0.07, peak, "sine");
    return;
  }

  if (variant === "error") {
    playTone(ctx, 277.18, now, 0.16, peak, "triangle");
    return;
  }

  playTone(ctx, 698.46, now, 0.08, peak * 0.85, "sine");
  playTone(ctx, 932.33, now + 0.06, 0.1, peak, "sine");
}

export function playAppSound(
  category: SoundCategory,
  variant: SoundVariant = "success",
) {
  if (!isSoundCategoryEnabled(category)) return;
  schedulePattern(category, variant, getSoundVolume());
}

export function previewAppSound(category: SoundCategory) {
  const ctx = getAudioContext();
  if (!ctx) return;
  schedulePattern(category, category === "twatter" ? "notification" : "success", getSoundVolume());
}
