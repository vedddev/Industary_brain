import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:5000",
});

export async function sendChatMessage(question) {
  const response = await api.post("/chat", {
    question,
    provider: localStorage.getItem("provider"),
    api_key: localStorage.getItem("api_key"),
  });

  return response.data;
}

export default api;
// baseURL: "https://your-backend.onrender.com"