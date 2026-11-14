import axios from "axios";

const api = axios.create({
  // Match authApi: use Vite's same-origin /api proxy locally so the HTTP-only
  // SameSite=Lax session cookie belongs to localhost rather than 127.0.0.1.
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) window.dispatchEvent(new Event("auth:expired"));
    return Promise.reject(error);
  },
);

export async function sendChatMessage(question, { provider = "groq", apiKey = "", signal } = {}) {

  const response = await api.post("/chat", {
    question,
    provider,
    api_key: apiKey,
  }, { signal });

  return response.data;
}

export async function uploadDocuments(files, { signal } = {}) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    signal,
  });

  return response.data;
}

export function getApiError(error, fallback) {
  const message = error?.response?.data?.error || error?.response?.data?.message;
  return message || error?.message || fallback;
}

export async function getServiceHealth() {
  const response = await api.get("/health");
  return response.data;
}

export async function listDocuments({ signal } = {}) {
  const response = await api.get("/documents", { signal });
  return response.data;
}

export default api;
