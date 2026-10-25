import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(<App />);

/* Inside the Android app (Capacitor injects window.Capacitor): hide the native splash screen once the web app has painted.
   In a normal browser this never runs and the plugin code is never downloaded. */
if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.()) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    import("@capacitor/splash-screen").then(({ SplashScreen }) => SplashScreen.hide()).catch(() => {});
  }));
}
