import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.financialtracker.mobile",
  appName: "Coinhabi",
  webDir: "mobile-shell",
  server: {
    url:
      process.env.CAPACITOR_SERVER_URL ??
      "https://financial-tracker-app-hazel.vercel.app",
    cleartext: false,
  },
};

export default config;
