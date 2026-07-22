import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useLocalStorage } from "./useLocalStorage";
import { sendChatMessage } from "../api/chatApi";

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

function makeChat(title = "New Chat") {
  return {
    id: createId(),
    title,
    createdAt: new Date().toISOString(),
    messages: [],
  };
}

export function useChat() {
  const [chats, setChats] = useLocalStorage("forge_chats", []);
  const [activeChatId, setActiveChatId] = useLocalStorage(
    "forge_active_chat",
    null
  );

  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useLocalStorage(
    "forge_model",
    "Industrial AI"
  );

  const activeChat =
    chats.find((c) => c.id === activeChatId) || null;

  useEffect(() => {
    if (!activeChatId && chats.length > 0) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats]);

  const startNewChat = useCallback(() => {
    const chat = makeChat();

    setChats((prev) => [chat, ...prev]);

    setActiveChatId(chat.id);

    return chat.id;
  }, []);

  const updateMessages = useCallback((chatId, updater) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: updater(chat.messages),
            }
          : chat
      )
    );
  }, []);

  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim()) return;

      let chatId = activeChatId;

      if (!chatId) {
        chatId = startNewChat();
      }

      const userMessage = {
        id: createId(),
        role: "user",
        content: text,
      };

      updateMessages(chatId, (msgs) => [...msgs, userMessage]);

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId && chat.title === "New Chat"
            ? {
                ...chat,
                title: text.substring(0, 40),
              }
            : chat
        )
      );

      const assistantId = createId();

      updateMessages(chatId, (msgs) => [
        ...msgs,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          status: "typing",
        },
      ]);

      setIsLoading(true);

      try {
        const groqKey = localStorage.getItem("groq_key");

        const data = await sendChatMessage(text, groqKey);

        updateMessages(chatId, (msgs) =>
          msgs.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: data.answer,
                  status: "done",
                  sources: data.sources,
                }
              : m
          )
        );
      } catch (err) {
        console.error(err);

        toast.error("Failed to contact backend.");

        updateMessages(chatId, (msgs) =>
          msgs.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "Error communicating with backend.",
                  status: "error",
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeChatId, startNewChat, updateMessages]
  );

  const regenerateLast = async () => {
    toast("Regenerate coming soon.");
  };

  const reactToMessage = (messageId, reaction) => {
    if (!activeChat) return;

    updateMessages(activeChat.id, (msgs) =>
      msgs.map((m) =>
        m.id === messageId
          ? {
              ...m,
              reaction,
            }
          : m
      )
    );
  };

  const deleteChatById = (id) => {
    setChats((prev) => prev.filter((c) => c.id !== id));

    if (activeChatId === id) {
      setActiveChatId(null);
    }
  };

  const clearActiveChat = () => {
    if (!activeChat) return;

    updateMessages(activeChat.id, () => []);

    toast.success("Chat cleared");
  };

  const clearAllChats = () => {
    setChats([]);

    setActiveChatId(null);

    toast.success("All chats cleared");
  };

  return {
    chats,
    activeChat,
    activeChatId,
    setActiveChatId,
    isLoading,
    model,
    setModel,
    startNewChat,
    sendMessage,
    regenerateLast,
    reactToMessage,
    deleteChatById,
    clearActiveChat,
    clearAllChats,
  };
}