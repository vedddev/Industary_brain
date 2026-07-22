import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onOpenSettings,
  onOpenProfile,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) {
  const [query, setQuery] = useState('')

  const filteredChats = useMemo(() => {
    if (!query.trim()) return chats
    return chats.filter((c) => c.title?.toLowerCase().includes(query.toLowerCase()))
  }, [chats, query])

 const [provider, setProvider] = useState(
  localStorage.getItem("provider") || "groq"
);

const [apiKey, setApiKey] = useState(
  localStorage.getItem("api_key") || ""
);
  const content = (
    <div className="flex h-full flex-col">
      {/* Logo + collapse toggle */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className={`flex items-center gap-2 overflow-hidden ${collapsed ? 'lg:justify-center lg:w-full' : ''}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient shadow-glow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white">
              <path d="M12 2 L19 20 L12 15.5 L5 20 Z" fill="currentColor" />
            </svg>
          </div>
          {!collapsed && (
            <span className="whitespace-nowrap text-lg font-semibold tracking-tight text-text">
              Forge <span className="bg-brand-gradient bg-clip-text text-transparent">AI</span>
            </span>
          )}
        </div>
        <button
          onClick={onCloseMobile}
          className="rounded-lg p-1 text-muted hover:bg-white/10 lg:hidden"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
        <button
          onClick={onToggleCollapse}
          className="hidden rounded-lg p-1 text-muted hover:bg-white/10 lg:block"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronDoubleRightIcon className="h-4 w-4" /> : <ChevronDoubleLeftIcon className="h-4 w-4" />}
        </button>
      </div>

      {/* New chat button */}
      <div className="px-3">
        <button
          onClick={onNewChat}
          className={`btn-gradient flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm shadow-glow-sm ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <PlusIcon className="h-4 w-4 shrink-0" />
          {!collapsed && 'New Chat'}
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="mt-3 px-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              className="w-full bg-transparent text-sm text-text placeholder:text-muted/60 focus:outline-none"
            />
          </div>
        </div>
      )}
        {/* Groq API Key */}
        {!collapsed && (
          <div className="mt-3 px-3">
            <label className="mb-1 block text-xs font-semibold text-green-400">
              Groq API Key
            </label>

            <input
              type="password"
              placeholder="Enter API Key"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                localStorage.setItem("api_key", e.target.value);
              }}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2 text-white"
            />

            <p className="mt-1 text-[11px] text-gray-500">
              Stored only in your browser.
            </p>
          </div>
        )}
      {/* Chat history */}
      <div className="scrollbar-thin-fade mt-3 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {!collapsed && (
          <p className="px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted/50">
            Chat History
          </p>
        )}
        <AnimatePresence initial={false}>
          {filteredChats.length === 0 && !collapsed && (
            <p className="px-3 py-4 text-center text-xs text-muted/60">
              No chats yet. Start a new conversation!
            </p>
          )}
          {filteredChats.map((chat) => (
            <motion.div
              key={chat.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              className="group relative"
            >
              <button
                onClick={() => onSelectChat(chat.id)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  activeChatId === chat.id
                    ? 'bg-brand-gradient-soft text-text border border-secondary/30'
                    : 'text-muted hover:bg-white/5'
                } ${collapsed ? 'justify-center' : ''}`}
                title={chat.title}
              >
                <ChatBubbleLeftRightIcon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{chat.title || 'New chat'}</span>}
              </button>
              {!collapsed && (
                <button
                  onClick={() => onDeleteChat(chat.id)}
                  className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-danger group-hover:block"
                  title="Delete chat"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>


{/* AI Configuration */}

{!collapsed && (
  <div className="mx-3 mt-4 rounded-xl border border-gray-700 bg-gray-900 p-3">

    <h3 className="mb-3 text-sm font-semibold text-green-400">
      AI Configuration
    </h3>

    <select
      value={provider}
      onChange={(e) => {
        setProvider(e.target.value);
        localStorage.setItem("provider", e.target.value);
      }}
      className="mb-3 w-full rounded-lg border border-gray-700 bg-gray-800 p-2 text-white"
    >
      <option value="groq">Groq</option>
      <option value="gemini">Gemini</option>
      <option value="openai">OpenAI</option>
      <option value="anthropic">Anthropic</option>
    </select>

    <input
      type="password"
      placeholder="Enter API Key"
      value={apiKey}
      onChange={(e) => {
        setApiKey(e.target.value);
        localStorage.setItem("api_key", e.target.value);
      }}
      className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2 text-white"
    />

    <p className="mt-2 text-xs text-gray-500">
      Stored only in your browser.
    </p>

  </div>
)}

  {/* Settings + Profile */}

  <div className="space-y-1 border-t border-white/10 px-2 py-3">
        <button
          onClick={onOpenSettings}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-white/5 hover:text-text ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <Cog6ToothIcon className="h-4 w-4 shrink-0" />
          {!collapsed && 'Settings'}
        </button>
        <button
          onClick={onOpenProfile}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-white/5 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-semibold text-white">
            FA
          </span>
          {!collapsed && (
            <span className="flex flex-col overflow-hidden text-left">
              <span className="truncate text-text">Guest User</span>
              <span className="truncate text-xs text-muted/70">Free plan</span>
            </span>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 76 : 272 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="glass-strong relative hidden shrink-0 border-r border-white/5 lg:block"
      >
        {content}
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="glass-strong fixed inset-y-0 left-0 z-50 w-72 border-r border-white/5 lg:hidden"
            >
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
