import { motion } from 'framer-motion'
import {
  ClipboardDocumentListIcon,
  DocumentMagnifyingGlassIcon,
  QuestionMarkCircleIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline'

const SUGGESTIONS = [
  {
    icon: ClipboardDocumentListIcon,
    title: 'Summarize the documents',
    subtitle: 'Get the key points and takeaways',
    prompt: 'Summarize the key points in the uploaded documents.',
  },
  {
    icon: DocumentMagnifyingGlassIcon,
    title: 'Find a specific topic',
    subtitle: 'Locate the most relevant passages',
    prompt: 'What do the uploaded documents say about the main topic?',
  },
  {
    icon: QuestionMarkCircleIcon,
    title: 'Explain a concept',
    subtitle: 'Turn technical language into clear terms',
    prompt: 'Explain the most important technical concept in simple language.',
  },
  {
    icon: ScaleIcon,
    title: 'Compare viewpoints',
    subtitle: 'Identify agreements and differences',
    prompt: 'Compare the key viewpoints or recommendations in these documents.',
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
