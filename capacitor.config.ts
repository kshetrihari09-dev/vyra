import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Vaspoor Android app (Capacitor).
 *
 * DEFAULT MODE — "live site": the app is a native shell that opens the deployed web app (CAP_SERVER_URL). This keeps everything that
 * works in the browser working unchanged: relative /api calls through the Vercel proxy, the SameSite=Strict refresh cookie,
 * server-sent-event streams (tracking, support chat, Vaspoor Call signaling) and instant updates when you deploy the web app.
 * If the site can't be reached the app shows the bundled offline page (public/offline.html → dist/offline.html).
 *
 * BUNDLED MODE (CAP_BUNDLED=1): ships the built files inside the app instead. That needs backend changes first (CORS for
 * https://localhost, cross-site cookies, a different refresh-token strategy) — see docs/ANDROID.md before using it.
 */
const serverUrl = (process.env.CAP_SERVER_URL || "https://vyrapro.vercel.app").replace(/\/+$/, "");
const bundled = process.env.CAP_BUNDLED === "1";
const debug = process.env.CAP_DEBUG === "1";

const config: CapacitorConfig = {
  // The application id is permanent once the app is published on Google Play. Change it BEFORE the first release if you want another.
  appId: process.env.CAP_APP_ID || "com.vaspoor.app",
  appName: "Vaspoor",
  webDir: "dist",
  ...(bundled ? {} : { server: { url: serverUrl, cleartext: false, errorPath: "offline.html", allowNavigation: [new URL(serverUrl).host] } }),
  android: {
    backgroundColor: "#F8FCFB",
    allowMixedContent: false,
    appendUserAgent: "VaspoorApp/1.0", // lets the web app recognise it is running inside the Android app
    webContentsDebuggingEnabled: debug, // chrome://inspect only for debug builds
    loggingBehavior: debug ? "debug" : "none",
  },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: "#0FAF8F", showSpinner: false, androidScaleType: "CENTER_CROP" }, // hidden by the web app once it has loaded (src/main.jsx)
    StatusBar: { style: "LIGHT", backgroundColor: "#F8FCFB", overlaysWebView: false },
  },
};

export default config;
