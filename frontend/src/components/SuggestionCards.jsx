import { motion } from 'framer-motion'
import {
  LightBulbIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  BugAntIcon,
  RocketLaunchIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

const SUGGESTIONS = [
  {
    icon: LightBulbIcon,
    title: 'Explain a concept',
    subtitle: 'Break down something complex, simply',
    prompt: 'Explain how neural networks learn, in simple terms.',
  },
  {
    icon: CodeBracketIcon,
    title: 'Generate code',
    subtitle: 'Get a working snippet in any language',
    prompt: 'Write a React hook for debouncing a search input.',
  },
  {
    icon: DocumentTextIcon,
    title: 'Summarize text',
    subtitle: 'Turn a long read into key points',
    prompt: 'Summarize this article for me in 5 bullet points.',
  },
  {
    icon: BugAntIcon,
    title: 'Debug my code',
    subtitle: 'Find and fix the issue fast',
    prompt: 'Help me debug this error in my Node.js Express server.',
  },
  {
    icon: RocketLaunchIcon,
    title: 'Create a project',
    subtitle: 'Plan the structure from scratch',
    prompt: 'Help me plan the architecture for a hackathon project.',
  },
  {
    icon: SparklesIcon,
    title: 'Brainstorm ideas',
    subtitle: 'Explore options before committing',
    prompt: 'Brainstorm 10 unique ideas for a college tech fest.',
  },
]

export default function SuggestionCards({ onSelect }) {
  return (
    <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
      {SUGGESTIONS.map(({ icon: Icon, title, subtitle, prompt }, i) => (
        <motion.button
          key={title}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i, duration: 0.35 }}
          whileHover={{ y: -3, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(prompt)}
          className="group flex items-start gap-3 rounded-2xl glass p-4 text-left shadow-panel transition-colors hover:border-secondary/50 hover:shadow-glow-sm"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient-soft text-secondary group-hover:bg-brand-gradient group-hover:text-white transition-colors">
            <Icon className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-medium text-text">{title}</span>
            <span className="block text-xs text-muted">{subtitle}</span>
          </span>
        </motion.button>
      ))}
    </div>
  )
}
