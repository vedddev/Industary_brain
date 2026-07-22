import { motion } from 'framer-motion'
import SuggestionCards from './SuggestionCards'

export default function WelcomeScreen({ onSelectSuggestion }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative flex h-20 w-20 items-center justify-center"
      >
        <div className="absolute inset-0 animate-pulse-glow rounded-full bg-brand-gradient blur-xl opacity-60" />
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-white">
            <path
              d="M12 2 L19 20 L12 15.5 L5 20 Z"
              fill="currentColor"
            />
          </svg>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="text-center"
      >
        <h1 className="text-2xl font-semibold text-text sm:text-3xl">
          Hi! I'm Forge AI <span className="inline-block"></span>
        </h1>
        <p className="mt-2 text-sm text-muted sm:text-base">
          How can I help you today?
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="w-full flex justify-center"
      >
        <SuggestionCards onSelect={onSelectSuggestion} />
      </motion.div>
    </div>
  )
}
