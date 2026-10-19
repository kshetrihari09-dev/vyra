/** Tailwind is compiled at build time (it used to be loaded from cdn.tailwindcss.com at runtime, which blocks rendering and
 *  generates CSS in every visitor's browser). Class names are found by scanning these files — build a class name from pieces
 *  (e.g. `bg-${colour}-500`) and it won't be found; write the full class somewhere in the source or add it to `safelist`. */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
};
