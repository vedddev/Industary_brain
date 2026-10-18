import axios from "axios";

const api = axios.create({
  baseURL: "https://industary-brain.onrender.com",
});

export async function sendChatMessage(question) {
  const provider = localStorage.getItem("provider") || "groq";
  const apiKey = localStorage.getItem("api_key") || "";

  const response = await api.post("/chat", {
    question,
    provider,
    api_key: apiKey,
  });

  return response.data;
}

export async function uploadDocuments(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
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

export default api;
