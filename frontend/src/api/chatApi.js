import axios from "axios";

const api = axios.create({
  // The Docker frontend proxies this route to the API. Set VITE_API_URL when
  // building for a separately hosted backend.
  baseURL: import.meta.env.VITE_API_URL || "/api",
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

export default api;
