import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDownIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  Bars3Icon,
  CheckIcon,
} from '@heroicons/react/24/outline'

const MODELS = [
  'Forge Reasoning',
  'Forge Turbo',
  'Forge Vision',
  'Forge Code',
]

export default function Header({
  model,
  onModelChange,
  onClearChat,
  onExportChat,
  onOpenSidebar,
  onOpenProfile,
  chatTitle,
}) {
  const [modelOpen, setModelOpen] = useState(false)

  return (
    <header className="glass sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-white/5 px-3 py-3 sm:px-6">

      {/* Left */}
      <div className="flex min-w-0 items-center gap-2">

        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-1.5 text-muted hover:bg-white/10 lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>

        <div className="relative">

          <button
            onClick={() => setModelOpen(!modelOpen)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-text hover:bg-white/10"
          >
            {model}
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${
                modelOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {modelOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="glass-strong absolute left-0 mt-2 w-52 rounded-xl p-2 shadow-panel"
              >
                {MODELS.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      onModelChange(m)
                      setModelOpen(false)
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"
                  >
                    {m}

                    {model === m && (
                      <CheckIcon className="h-4 w-4 text-green-400" />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {chatTitle && (
          <span className="hidden truncate text-sm text-muted sm:inline">
            / {chatTitle}
          </span>
        )}

      </div>

      {/* Right */}
      <div className="flex items-center gap-2">

        <button
          onClick={onExportChat}
          className="rounded-lg p-2 text-muted hover:bg-white/10 hover:text-green-400"
          title="Export Chat"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
        </button>

        <button
          onClick={onClearChat}
          className="rounded-lg p-2 text-muted hover:bg-white/10 hover:text-red-500"
          title="Clear Chat"
        >
          <TrashIcon className="h-5 w-5" />
        </button>

        <button
          onClick={onOpenProfile}
          className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-green-500 font-semibold text-black shadow-lg shadow-green-500/40 hover:bg-green-400"
          title="Profile"
        >
          FA
        </button>

      </div>
    </header>
  )
}