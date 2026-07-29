import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aihub.app",
  appName: "AI Hub",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // Allow http:// API calls from the WebView (local Nest server).
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
