/** Public (browser) map token — a restricted `pk.` token. The server's routing token (MAPBOX_ACCESS_TOKEN) is a different, secret one. */
export const MAP_TOKEN = import.meta.env?.VITE_MAPBOX_TOKEN || "";
export const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";
/** Where the map opens before any coordinate is known (central Kathmandu, matching the app's Nepal address data). */
export const DEFAULT_CENTER = { lat: 27.7172, lng: 85.324 };
