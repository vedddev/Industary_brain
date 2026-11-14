import { useEffect, useRef, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import UserProfile from "./components/UserProfile";
import { useAuth } from "./AuthContext";
import { useChat } from "./hooks/useChat";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { getApiError, getServiceHealth, listDocuments, uploadDocuments } from "./api/chatApi";
import { exportChatAsPdf } from "./utils/exportChat";
import AuthPage from "./components/AuthPage";

function Workspace({ workspaceId, user, navigate }) {
  const { chats, activeChat, activeChatId, setActiveChatId, isLoading, startNewChat, sendMessage, regenerateLast, reactToMessage, deleteChatById, clearActiveChat } = useChat(workspaceId);
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage("forge_sidebar_collapsed", false);
  const [documents, setDocuments] = useLocalStorage(`iki:${workspaceId}:documents`, []);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [serviceStatus, setServiceStatus] = useState(null);
  const uploadRequest = useRef(null);

  useEffect(() => {
    let active = true;
    getServiceHealth().then((data) => active && setServiceStatus(data?.status === "healthy" ? "healthy" : null)).catch(() => active && setServiceStatus(null));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setDocuments([]);
      return undefined;
    }
    const controller = new AbortController();
    listDocuments({ signal: controller.signal })
      .then((data) => setDocuments(Array.isArray(data?.documents) ? data.documents : []))
      .catch((error) => {
        if (error?.name !== "CanceledError" && error?.name !== "AbortError") setDocuments([]);
      });
    return () => controller.abort();
  }, [user?.id, setDocuments]);

  useEffect(() => () => uploadRequest.current?.abort(), []);

  const handleUpload = async (files) => {
    if (!user?.id) { toast.error("Sign in to upload documents."); navigate("/login"); return; }
    if (files.some((file) => !file.name.toLowerCase().endsWith(".pdf"))) { toast.error("Only PDF files can be uploaded."); return; }
    const controller = new AbortController();
    uploadRequest.current = controller;
    setIsUploading(true);
    try {
      const result = await uploadDocuments(files, { signal: controller.signal });
      if (uploadRequest.current !== controller) return;
      // Reload the server-owned list instead of trusting a stale local upload result.
      const current = await listDocuments({ signal: controller.signal });
      if (uploadRequest.current !== controller) return;
      setDocuments(Array.isArray(current?.documents) ? current.documents : []);
      toast.success(`${result.documents || files.length} document${files.length === 1 ? "" : "s"} added to the knowledge workspace.`);
    } catch (error) {
      if (error?.name !== "CanceledError" && error?.name !== "AbortError") toast.error(getApiError(error, "Upload failed. Please try again."));
    } finally {
      if (uploadRequest.current === controller) {
        uploadRequest.current = null;
        setIsUploading(false);
      }
    }
  };

  return <div className="flex h-dvh overflow-hidden bg-[var(--color-background)] text-[var(--color-text)]">
    <Sidebar chats={chats} documents={documents} activeChatId={activeChatId} onSelectChat={(id) => { setActiveChatId(id); setMobileSidebarOpen(false); }} onNewChat={() => { startNewChat(); setMobileSidebarOpen(false); }} onDeleteChat={deleteChatById} onOpenProfile={() => setProfileOpen(true)} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((value) => !value)} mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} workspaceId={workspaceId} />
    <div className="flex min-w-0 flex-1 flex-col"><Header chatTitle={activeChat?.title} serviceStatus={serviceStatus} onAddDocuments={() => document.getElementById("workspace-upload")?.click()} onClearChat={clearActiveChat} onExportChat={() => exportChatAsPdf(activeChat)} onOpenSidebar={() => setMobileSidebarOpen(true)} onOpenProfile={() => setProfileOpen(true)} />
      <main className="min-h-0 flex-1 overflow-y-auto"><ChatWindow messages={activeChat?.messages || []} documents={documents} onSelectSuggestion={sendMessage} onRegenerate={regenerateLast} onReact={reactToMessage} isLoading={isLoading} onUpload={handleUpload} isUploading={isUploading} hasDocuments={documents.length > 0} /></main>
      <ChatInput onSend={sendMessage} isLoading={isLoading} onUpload={handleUpload} isUploading={isUploading} />
    </div>
    <UserProfile open={profileOpen} onClose={() => setProfileOpen(false)} onSignIn={() => navigate("/login")} onSignOut={() => navigate("/login")} />
  </div>;
}

export default function App() {
  const { user, loading } = useAuth();
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const navigate = (to) => {
    if (window.location.pathname !== to) window.history.pushState({}, "", to);
    setPath(to);
  };
  if (path === "/login" || path === "/register") return <AuthPage key={path} mode={path.slice(1)} onNavigate={navigate} />;
  // Auth restoration finishes before a user's protected document list is requested.
  if (loading) return null;
  const workspaceId = user?.id || "guest";
  return <><Workspace key={workspaceId} workspaceId={workspaceId} user={user} navigate={navigate} /><Toaster position="top-center" toastOptions={{ style: { background: "#FFFFFF", color: "#1C2924", border: "1px solid #DFE2D8", boxShadow: "0 10px 30px rgba(28, 41, 36, 0.12)" } }} /></>;
}
