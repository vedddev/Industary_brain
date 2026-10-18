import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChatBubbleLeftRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  DocumentTextIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  Squares2X2Icon,
  TrashIcon,
} from "@heroicons/react/24/outline";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const formatSize = (bytes) => {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function SectionLabel({ children, htmlFor }) {
  const Tag = htmlFor ? "label" : "p";
  return (
    <Tag
      htmlFor={htmlFor}
      className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400"
    >
      {children}
    </Tag>
  );
}

function NavItem({ icon: Icon, label, active, collapsed, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40",
        collapsed && "justify-center px-0",
        active
          ? "bg-emerald-50 text-emerald-800"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <Icon className={cx("h-[18px] w-[18px] shrink-0", active ? "text-emerald-700" : "text-slate-400")} />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

export default function Sidebar({
  chats,
  documents,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onOpenProfile,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) {
  const [query, setQuery] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("api_key") || "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats.filter((chat) => (chat.title || "").toLowerCase().includes(q));
  }, [chats, query]);

  // Close the mobile drawer with the Escape key.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && onCloseMobile();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onCloseMobile]);

  const handleKeyChange = (e) => {
    setApiKey(e.target.value);
    localStorage.setItem("api_key", e.target.value);
  };

  // The mobile drawer is always shown expanded; only desktop can collapse.
  const renderContent = (isCollapsed) => (
    <div className="flex h-full min-h-0 flex-col bg-white text-slate-700">
      {/* Brand */}
      <div className={cx("flex h-16 shrink-0 items-center border-b border-slate-200 px-3", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && (
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-[11px] font-bold tracking-wide text-white shadow-sm">
              IIB
            </span>
            <span className="min-w-0 leading-tight">
              <strong className="block truncate text-sm font-semibold text-slate-900">Industrial Intelligence</strong>
              <small className="block text-xs text-slate-500">Brain</small>
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 lg:inline-flex"
        >
          {isCollapsed ? <ChevronDoubleRightIcon className="h-4 w-4" /> : <ChevronDoubleLeftIcon className="h-4 w-4" />}
        </button>
      </div>

      {/* Primary action */}
      <div className="shrink-0 px-3 pt-4">
        <button
          type="button"
          onClick={onNewChat}
          title={isCollapsed ? "New conversation" : undefined}
          className={cx(
            "flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-medium text-white shadow-sm transition-colors",
            "hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/50 focus-visible:ring-offset-2"
          )}
        >
          <PlusIcon className="h-4 w-4" />
          {!isCollapsed && "New conversation"}
        </button>
      </div>

      {/* Navigation */}
      <nav className="shrink-0 space-y-1 px-3 pt-4" aria-label="Workspace">
        <NavItem icon={Squares2X2Icon} label="Workspace" active collapsed={isCollapsed} onClick={onNewChat} />
        <NavItem icon={ChatBubbleLeftRightIcon} label="Knowledge chat" collapsed={isCollapsed} onClick={onNewChat} />
      </nav>

      {!isCollapsed && (
        <>
          {/* Documents */}
          <section className="shrink-0 px-4 pt-6">
            <div className="flex items-center justify-between">
              <SectionLabel>Documents</SectionLabel>
              {documents.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  {documents.length}
                </span>
              )}
            </div>
            <ul className="mt-2 space-y-1">
              {documents.length ? (
                documents.slice(0, 4).map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <DocumentTextIcon className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate" title={doc.name}>{doc.name}</span>
                    <small className="shrink-0 text-[11px] text-slate-400">{formatSize(doc.size)}</small>
                  </li>
                ))
              ) : (
                <li className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">
                  No uploaded documents
                </li>
              )}
            </ul>
          </section>

          {/* Provider key */}
          <section className="shrink-0 px-4 pt-6">
            <div className="flex items-center justify-between">
              <SectionLabel htmlFor="api-key">Provider key</SectionLabel>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className={cx("h-1.5 w-1.5 rounded-full", apiKey ? "bg-emerald-500" : "bg-slate-300")} />
                {apiKey ? "Connected" : "Not set"}
              </span>
            </div>
            <div className="relative mt-2">
              <input
                id="api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                placeholder="Groq API key"
                autoComplete="off"
                spellCheck={false}
                onChange={handleKeyChange}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? "Hide API key" : "Show API key"}
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:text-slate-700"
              >
                {showKey ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-400">Stored only in this browser.</p>
          </section>
        </>
      )}

      {/* Conversations */}
      <section className="mt-6 flex min-h-0 flex-1 flex-col border-t border-slate-200 px-3 pt-4">
        {!isCollapsed && (
          <>
            <label className="relative block">
              <span className="sr-only">Search conversations</span>
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </label>
            <div className="mt-4 px-1">
              <SectionLabel>Conversations</SectionLabel>
            </div>
          </>
        )}

        <div className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-3 [scrollbar-width:thin]">
          <AnimatePresence initial={false}>
            {filtered.map((chat) => {
              const active = activeChatId === chat.id;
              return (
                <motion.div
                  key={chat.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="group relative"
                >
                  <button
                    type="button"
                    onClick={() => onSelectChat(chat.id)}
                    title={chat.title}
                    aria-current={active ? "true" : undefined}
                    className={cx(
                      "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40",
                      isCollapsed && "justify-center px-0",
                      active
                        ? "bg-slate-100 font-medium text-slate-900"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <ChatBubbleLeftRightIcon className={cx("h-4 w-4 shrink-0", active ? "text-emerald-700" : "text-slate-400")} />
                    {!isCollapsed && <span className="truncate pr-6">{chat.title || "New conversation"}</span>}
                  </button>
                  {!isCollapsed && (
                    <button
                      type="button"
                      onClick={() => onDeleteChat(chat.id)}
                      aria-label="Delete conversation"
                      className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:outline-none group-hover:opacity-100"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {!isCollapsed && filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-slate-400">
              {query ? "No conversations match your search" : "No conversations yet"}
            </p>
          )}
        </div>
      </section>

      {/* User */}
      <div className="shrink-0 border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={onOpenProfile}
          title={isCollapsed ? "Guest workspace" : undefined}
          className={cx(
            "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-slate-50",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40",
            isCollapsed && "justify-center"
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
            GU
          </span>
          {!isCollapsed && (
            <span className="min-w-0 leading-tight">
              <strong className="block truncate text-sm font-medium text-slate-900">Guest workspace</strong>
              <small className="block text-xs text-slate-500">Local session</small>
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 280 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative hidden h-screen shrink-0 overflow-hidden border-r border-slate-200 bg-white lg:block"
        aria-label="Sidebar"
      >
        {renderContent(collapsed)}
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[min(288px,88vw)] border-r border-slate-200 bg-white shadow-xl lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              aria-label="Sidebar"
            >
              {renderContent(false)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}