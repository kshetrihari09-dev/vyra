// Run after `vite build`, before `cap sync`: writes dist/offline.html (the page shown when the live site can't be reached).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const url = (process.env.CAP_SERVER_URL || "https://vyrapro.vercel.app").replace(/\/+$/, "");
if (!/^https:\/\/[^\s"'<>]+$/.test(url)) { console.error(`CAP_SERVER_URL must be an https:// URL (got "${url}")`); process.exit(1); }
const html = readFileSync(new URL("../capacitor/offline.template.html", import.meta.url), "utf8").replaceAll("__SERVER_URL__", url);
mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
writeFileSync(new URL("../dist/offline.html", import.meta.url), html);
console.log(`dist/offline.html written (retry target ${url}/)`);
