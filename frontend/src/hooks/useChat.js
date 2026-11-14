import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocalStorage } from "./useLocalStorage";
import { getApiError, sendChatMessage } from "../api/chatApi";

const createId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

function makeChat(title = "New Chat") {
  return { id: createId(), title, createdAt: new Date().toISOString(), messages: [] };
}

export function useChat(workspaceId) {
  const key = useCallback((name) => `iki:${workspaceId}:${name}`, [workspaceId]);
  const [chats, setChats] = useLocalStorage(key("conversations"), []);
  const [activeChatId, setActiveChatId] = useLocalStorage(key("active-conversation"), null);
  const [model, setModel] = useLocalStorage(key("model"), "Industrial AI");
  const [isLoading, setIsLoading] = useState(false);
  const requestRef = useRef(null);
  const activeRef = useRef(true);

  useEffect(() => () => {
    activeRef.current = false;
    requestRef.current?.abort();
  }, []);

  const activeChat = chats.find((chat) => chat.id === activeChatId) || null;

  useEffect(() => {
    if (!activeChatId && chats.length > 0) setActiveChatId(chats[0].id);
  }, [activeChatId, chats, setActiveChatId]);

  const startNewChat = useCallback(() => {
    const chat = makeChat();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    return chat.id;
  }, [setActiveChatId, setChats]);

  const updateMessages = useCallback((chatId, updater) => {
    setChats((prev) => prev.map((chat) => chat.id === chatId ? { ...chat, messages: updater(chat.messages) } : chat));
  }, [setChats]);

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || isLoading) return;
    let chatId = activeChatId;
    if (!chatId) chatId = startNewChat();

    updateMessages(chatId, (messages) => [...messages, { id: createId(), role: "user", content: text.trim() }]);
    setChats((prev) => prev.map((chat) => chat.id === chatId && chat.title === "New Chat"
      ? { ...chat, title: text.trim().substring(0, 40) } : chat));

    const assistantId = createId();
    updateMessages(chatId, (messages) => [...messages, { id: assistantId, role: "assistant", content: "", status: "typing" }]);
    const controller = new AbortController();
    requestRef.current = controller;
    setIsLoading(true);
    try {
      const data = await sendChatMessage(text, {
        provider: localStorage.getItem(key("provider")) || "groq",
        apiKey: localStorage.getItem(key("provider-api-key")) || "",
        signal: controller.signal,
      });
      if (!activeRef.current || requestRef.current !== controller) return;
      updateMessages(chatId, (messages) => messages.map((message) => message.id === assistantId
        ? { ...message, content: data.answer, status: "done", sources: data.sources || [] } : message));
    } catch (err) {
      if (err?.name === "CanceledError" || err?.name === "AbortError" || !activeRef.current) return;
      const errorMessage = getApiError(err, "Failed to contact the knowledge service.");
      toast.error(errorMessage);
      updateMessages(chatId, (messages) => messages.map((message) => message.id === assistantId
        ? { ...message, content: `Unable to answer this question: ${errorMessage}`, status: "error" } : message));
    } finally {
      if (activeRef.current && requestRef.current === controller) {
        requestRef.current = null;
        setIsLoading(false);
      }
    }
  }, [activeChatId, isLoading, key, setChats, startNewChat, updateMessages]);

  const regenerateLast = async () => { toast("Regenerate coming soon."); };
  const reactToMessage = (messageId, reaction) => {
    if (activeChat) updateMessages(activeChat.id, (messages) => messages.map((message) => message.id === messageId ? { ...message, reaction } : message));
  };
  const deleteChatById = (id) => {
    setChats((prev) => prev.filter((chat) => chat.id !== id));
    if (activeChatId === id) setActiveChatId(null);
  };
  const clearActiveChat = () => {
    if (activeChat) {
      updateMessages(activeChat.id, () => []);
      toast.success("Chat cleared");
    }
  };
  const clearAllChats = () => {
    setChats([]);
    setActiveChatId(null);
    toast.success("All chats cleared");
  };

  return { chats, activeChat, activeChatId, setActiveChatId, isLoading, model, setModel, startNewChat, sendMessage, regenerateLast, reactToMessage, deleteChatById, clearActiveChat, clearAllChats };
}
