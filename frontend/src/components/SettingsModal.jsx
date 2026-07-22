import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon, SunIcon, MoonIcon, TrashIcon } from '@heroicons/react/24/outline'

export default function SettingsModal({
  open,
  onClose,
  isDark,
  onToggleTheme,
  onClearAllChats,
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.2 }}
            className="glass-strong fixed left-1/2 top-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-panel"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text">Settings</h3>
              <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-white/10">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text">Appearance</p>
                  <p className="text-xs text-muted">Switch between dark and light mode</p>
                </div>
                <button
                  onClick={onToggleTheme}
                  className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-text hover:bg-white/10"
                >
                  {isDark ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
                  {isDark ? 'Dark' : 'Light'}
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text">Clear all chats</p>
                  <p className="text-xs text-muted">Deletes every saved conversation</p>
                </div>
                <button
                  onClick={onClearAllChats}
                  className="flex items-center gap-1.5 rounded-lg border border-danger/30 px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
                >
                  <TrashIcon className="h-4 w-4" />
                  Clear
                </button>
              </div>

              <div className="rounded-xl bg-white/5 px-4 py-3">
                <p className="text-sm font-medium text-text">About</p>
                <p className="mt-1 text-xs text-muted">
                  Forge AI — a futuristic chatbot interface. Backend powered by Node.js + Express.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
