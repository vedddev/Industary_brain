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

export default api;
