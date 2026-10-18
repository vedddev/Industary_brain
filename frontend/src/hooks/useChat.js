
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useLocalStorage } from "./useLocalStorage";
import { getApiError, sendChatMessage } from "../api/chatApi";

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
    chats.find((chat) => chat.id === activeChatId) || null;

  useEffect(() => {
    if (!activeChatId && chats.length > 0) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats, setActiveChatId]);

  const startNewChat = useCallback(() => {
    const chat = makeChat();

    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);

    return chat.id;
  }, [setActiveChatId, setChats]);

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
  }, [setChats]);

  const sendMessage = useCallback(
    async (text) => {
      if (!text?.trim() || isLoading) return;

      let chatId = activeChatId;

      if (!chatId) {
        chatId = startNewChat();
      }

      const userMessage = {
        id: createId(),
        role: "user",
        content: text.trim(),
      };

      updateMessages(chatId, (messages) => [
        ...messages,
        userMessage,
      ]);

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId && chat.title === "New Chat"
            ? {
                ...chat,
                title: text.trim().substring(0, 40),
              }
            : chat
        )
      );

      const assistantId = createId();

      updateMessages(chatId, (messages) => [
        ...messages,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          status: "typing",
        },
      ]);

      setIsLoading(true);

      try {
        const data = await sendChatMessage(text);

        updateMessages(chatId, (messages) =>
          messages.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: data.answer,
                  status: "done",
                  sources: data.sources || [],
                }
              : message
          )
        );
      } catch (err) {
        console.error(err);

        const errorMessage = getApiError(err, "Failed to contact the knowledge service.");
        toast.error(errorMessage);

        updateMessages(chatId, (messages) =>
          messages.map((message) =>
            message.id === assistantId
              ? {
                  ...m,
                  content: `Unable to answer this question: ${errorMessage}`,
                  status: "error",
                }
              : message
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeChatId, setChats, startNewChat, updateMessages]
  );

  const regenerateLast = async () => {
    toast("Regenerate coming soon.");
  };

  const reactToMessage = (messageId, reaction) => {
    if (!activeChat) return;

    updateMessages(activeChat.id, (messages) =>
      messages.map((message) =>
        message.id === messageId
          ? { ...message, reaction }
          : message
      )
    );
  };

  const deleteChatById = (id) => {
    setChats((prev) => prev.filter((chat) => chat.id !== id));

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
