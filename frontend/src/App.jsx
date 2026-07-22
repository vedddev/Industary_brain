import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import UserProfile from "./components/UserProfile";

import { useChat } from "./hooks/useChat";
import { useLocalStorage } from "./hooks/useLocalStorage";

import { exportChatAsPdf } from "./utils/exportChat";

export default function App() {
  const {
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
  } = useChat();

  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage(
    "forge_sidebar_collapsed",
    false
  );

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Always use dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const handleSelectChat = (id) => {
    setActiveChatId(id);
    setMobileSidebarOpen(false);
  };

  const handleNewChat = () => {
    startNewChat();
    setMobileSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)] text-white">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={deleteChatById}
        onOpenProfile={() => setProfileOpen(true)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          model={model}
          onModelChange={setModel}
          onClearChat={clearActiveChat}
          onExportChat={() => exportChatAsPdf(activeChat)}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
          onOpenProfile={() => setProfileOpen(true)}
          chatTitle={activeChat?.title}
        />

        <main className="flex-1 overflow-y-auto">
          <ChatWindow
            messages={activeChat?.messages || []}
            onSelectSuggestion={sendMessage}
            onRegenerate={regenerateLast}
            onReact={reactToMessage}
            isLoading={isLoading}
          />
        </main>

        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
        />
      </div>

      <UserProfile
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#1f2937",
            color: "#fff",
            border: "1px solid #22c55e",
          },
        }}
      />
    </div>
  );
}