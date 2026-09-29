import { api, request } from "./client.js";

/** Reads a File as the data URL the upload endpoint expects ("data:<mime>;base64,..."). */
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const prescriptionsApi = {
  listMine: async () => (await api.get("/prescriptions")).prescriptions,
  listAll: async (params = {}) => (await api.get("/prescriptions", params)).prescriptions,
  get: async (id) => (await api.get(`/prescriptions/${id}`)).prescription,
  review: async (id, { status, notes }) => (await api.post(`/prescriptions/${id}/review`, { status, notes: notes || undefined })).prescription,

  async upload(file, { productIds } = {}) {
    const dataBase64 = await readAsDataUrl(file);
    return (await api.post("/prescriptions", { fileName: file.name, mimeType: file.type, dataBase64, productIds })).prescription;
  },

  /**
   * The file route is authenticated with the same bearer token as every other call, so a plain <img src=...>
   * can't load it (the browser won't attach an Authorization header to that request). This fetches the bytes
   * through the normal API client and hands back a blob: URL the caller is responsible for revoking.
   */
  async fetchFileBlobUrl(id) {
    const res = await request(`/prescriptions/${id}/file`, { raw: true });
    return URL.createObjectURL(await res.blob());
  },
};
