import { useEffect, useState } from "react";

/** Live `matchMedia` flag. The initial value is read synchronously so the first paint already uses the right layout. */
export function useMediaQuery(query) {
  const get = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

/** Phones and small portrait screens: everything below Tailwind's `md` breakpoint (768 px). Tablet and desktop are `false`. */
export const MOBILE_QUERY = "(max-width: 767.98px)";
export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);
