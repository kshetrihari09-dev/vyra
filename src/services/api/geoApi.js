import { api } from "./client.js";

export const geoApi = {
  /** Which province / district / municipality a map pin is in. Public lookup. → { inNepal, approximate, province, district, municipality|null, area? } */
  locate: (lat, lng) => api.get("/geo/locate", { lat, lng }),
};
