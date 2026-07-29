import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";

export async function initCapacitor(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  document.documentElement.classList.add("native-app");
  document.documentElement.dataset.platform = Capacitor.getPlatform();

  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    // overlaysWebView is a no-op on Android 15+; safe to ignore.
  }

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.hide();
  } catch {
    // Status bar plugin may be unavailable on some devices.
  }

  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
  } catch {
    // Keyboard plugin may be unavailable on some devices.
  }
}
