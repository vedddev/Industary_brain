import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon, EnvelopeIcon, SparklesIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'

export default function UserProfile({ open, onClose }) {
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
            className="glass-strong fixed left-1/2 top-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-panel"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted hover:bg-white/10"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-lg font-semibold text-white shadow-glow">
                FA
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text">Guest User</h3>
                <p className="flex items-center justify-center gap-1 text-sm text-muted">
                  <EnvelopeIcon className="h-4 w-4" /> guest@forgeai.com
                </p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-brand-gradient-soft px-3 py-1 text-xs font-medium text-secondary">
                <SparklesIcon className="h-3.5 w-3.5" /> Free plan
              </span>
            </div>

            <div className="mt-6 space-y-2 text-sm">
              <div className="flex justify-between rounded-xl bg-white/5 px-4 py-2.5">
                <span className="text-muted">Chats this month</span>
                <span className="font-medium text-text">—</span>
              </div>
              <div className="flex justify-between rounded-xl bg-white/5 px-4 py-2.5">
                <span className="text-muted">Member since</span>
                <span className="font-medium text-text">2026</span>
              </div>
            </div>

            <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-danger">
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              Sign out
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
