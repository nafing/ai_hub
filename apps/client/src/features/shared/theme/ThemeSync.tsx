import { useEffect } from "react";
import { applyThemeToDocument } from "./applyTheme";
import { useThemeStore } from "./themeStore";

export function ThemeSync() {
  const mode = useThemeStore((s) => s.mode);
  const baseColors = useThemeStore((s) => s.baseColors);
  const accentH = useThemeStore((s) => s.accentH);
  const accentS = useThemeStore((s) => s.accentS);
  const accentL = useThemeStore((s) => s.accentL);
  const cornerRadius = useThemeStore((s) => s.cornerRadius);
  const fontScale = useThemeStore((s) => s.fontScale);
  const uiScale = useThemeStore((s) => s.uiScale);
  const glassEffects = useThemeStore((s) => s.glassEffects);

  useEffect(() => {
    applyThemeToDocument({
      mode,
      baseColors,
      accentH,
      accentS,
      accentL,
      cornerRadius,
      fontScale,
      uiScale,
      glassEffects,
    });
  }, [
    mode,
    baseColors,
    accentH,
    accentS,
    accentL,
    cornerRadius,
    fontScale,
    uiScale,
    glassEffects,
  ]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const state = useThemeStore.getState();
      applyThemeToDocument({
        mode,
        baseColors: state.baseColors,
        accentH: state.accentH,
        accentS: state.accentS,
        accentL: state.accentL,
        cornerRadius: state.cornerRadius,
        fontScale: state.fontScale,
        uiScale: state.uiScale,
        glassEffects: state.glassEffects,
      });
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  return null;
}
