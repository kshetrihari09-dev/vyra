import { CATEGORIES } from "../data/categories.js";
import { BRANDS } from "../data/brands.js";

/**
 * The storefront reads categories and brands through module-level helpers (resolveCategory, brandById, ...) that
 * default to these arrays. Categories/brands are small, admin-managed configuration, so we load them whole from
 * the API at startup and swap them into those arrays in place. They are a cache of the server's data, not a source
 * of truth: after any category/brand change the caller refreshes them from the API response.
 */
export function hydrateRegistries({ categories, brands }) {
  if (categories) CATEGORIES.splice(0, CATEGORIES.length, ...categories);
  if (brands) BRANDS.splice(0, BRANDS.length, ...brands);
}
