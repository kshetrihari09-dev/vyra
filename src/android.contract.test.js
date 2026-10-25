import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

/** Guards the Android app's security and permission settings (the app itself is built in CI / Android Studio, not in these tests). */
describe("Android app (Capacitor)", () => {
  const config = read("capacitor.config.ts");
  const manifest = read("android/app/src/main/AndroidManifest.xml");

  it("opens only the https site, never cleartext, and keeps navigation on its own domain", () => {
    assert.match(config, /cleartext:\s*false/); assert.match(config, /allowNavigation:\s*\[new URL\(serverUrl\)\.host\]/);
    assert.match(config, /allowMixedContent:\s*false/); assert.match(config, /errorPath:\s*"offline\.html"/);
    assert.match(config, /webContentsDebuggingEnabled:\s*debug/, "remote debugging only in debug builds");
  });
  it("manifest: no backups, no cleartext traffic, and exactly the permissions the features need", () => {
    assert.match(manifest, /android:allowBackup="false"/); assert.match(manifest, /android:usesCleartextTraffic="false"/);
    const perms = [...manifest.matchAll(/uses-permission android:name="android\.permission\.(\w+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(perms, ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "ACCESS_NETWORK_STATE", "CAMERA", "INTERNET", "MODIFY_AUDIO_SETTINGS", "RECORD_AUDIO", "VIBRATE"]);
  });
  it("hardware is optional so Google Play doesn't hide the app from devices without it", () => {
    const feats = [...manifest.matchAll(/<uses-feature[^>]*>/g)].map((m) => m[0]);
    assert.ok(feats.length >= 5 && feats.every((f) => /android:required="false"/.test(f)));
  });
  it("release signing and versions come from the environment, never from committed files", () => {
    const gradle = read("android/app/build.gradle");
    assert.match(gradle, /System\.getenv\("ANDROID_KEYSTORE_PATH"\)/); assert.match(gradle, /System\.getenv\("VERSION_CODE"\)/);
    assert.equal(/storePassword\s+["'][^"']+["']/.test(gradle), false, "no password literal in the build file");
  });
  it("the offline page is self-contained and its retry target is filled in at build time", () => {
    const html = read("capacitor/offline.template.html");
    assert.match(html, /__SERVER_URL__/); assert.equal(/https?:\/\/(?!__)/.test(html.replace(/xmlns="[^"]*"/g, "")), false, "no external requests");
    assert.match(read("scripts/prepare-android.mjs"), /must be an https:\/\/ URL/);
  });
  it("the web app hides the native splash only inside the app, via a lazy import", () => {
    const main = read("src/main.jsx");
    assert.match(main, /window\.Capacitor\?\.isNativePlatform\?\.\(\)/); assert.match(main, /import\("@capacitor\/splash-screen"\)/);
  });
  it("no signing keys are committed", () => {
    assert.match(read("../.gitignore"), /^\*\.jks$/m);
  });
});
