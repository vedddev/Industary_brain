import { useEffect, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import UserProfile from "./components/UserProfile";
import { useChat } from "./hooks/useChat";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { getApiError, getServiceHealth, uploadDocuments } from "./api/chatApi";
import { exportChatAsPdf } from "./utils/exportChat";

export default function App() {
  const { chats, activeChat, activeChatId, setActiveChatId, isLoading, startNewChat, sendMessage, regenerateLast, reactToMessage, deleteChatById, clearActiveChat } = useChat();
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage("forge_sidebar_collapsed", false);
  const [documents, setDocuments] = useLocalStorage("iki_documents", []);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [serviceStatus, setServiceStatus] = useState(null);

  useEffect(() => {
    let active = true;
    getServiceHealth().then((data) => active && setServiceStatus(data?.status === "healthy" ? "healthy" : null)).catch(() => active && setServiceStatus(null));
    return () => { active = false; };
  }, []);

  const handleUpload = async (files) => {
    if (files.some((file) => !file.name.toLowerCase().endsWith(".pdf"))) { toast.error("Only PDF files can be uploaded."); return; }
    setIsUploading(true);
    try {
      const result = await uploadDocuments(files);
      const uploadedAt = new Date().toISOString();
      setDocuments((current) => [...files.map((file) => ({ id: `${file.name}-${file.size}-${uploadedAt}`, name: file.name, size: file.size, uploadedAt })), ...current.filter((document) => !files.some((file) => file.name === document.name && file.size === document.size))]);
      toast.success(`${result.documents || files.length} document${files.length === 1 ? "" : "s"} added to the knowledge workspace.`);
    } catch (error) { toast.error(getApiError(error, "Upload failed. Please try again.")); }
    finally { setIsUploading(false); }
  };
  const newConversation = () => { startNewChat(); setMobileSidebarOpen(false); };
  const selectChat = (id) => { setActiveChatId(id); setMobileSidebarOpen(false); };

  return <div className="flex h-dvh overflow-hidden bg-[var(--color-background)] text-[var(--color-text)]">
    <Sidebar chats={chats} documents={documents} activeChatId={activeChatId} onSelectChat={selectChat} onNewChat={newConversation} onDeleteChat={deleteChatById} onOpenProfile={() => setProfileOpen(true)} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((value) => !value)} mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
    <div className="flex min-w-0 flex-1 flex-col"><Header chatTitle={activeChat?.title} serviceStatus={serviceStatus} onAddDocuments={() => document.getElementById("workspace-upload")?.click()} onClearChat={clearActiveChat} onExportChat={() => exportChatAsPdf(activeChat)} onOpenSidebar={() => setMobileSidebarOpen(true)} onOpenProfile={() => setProfileOpen(true)} />
      <main className="min-h-0 flex-1 overflow-y-auto"><ChatWindow messages={activeChat?.messages || []} documents={documents} onSelectSuggestion={sendMessage} onRegenerate={regenerateLast} onReact={reactToMessage} isLoading={isLoading} onUpload={handleUpload} isUploading={isUploading} hasDocuments={documents.length > 0} /></main>
      <ChatInput onSend={sendMessage} isLoading={isLoading} onUpload={handleUpload} isUploading={isUploading} />
    </div>
    <UserProfile open={profileOpen} onClose={() => setProfileOpen(false)} />
    <Toaster position="top-center" toastOptions={{ style: { background: "#FFFFFF", color: "#1C2924", border: "1px solid #DFE2D8", boxShadow: "0 10px 30px rgba(28, 41, 36, 0.12)" } }} />
  </div>;
}
