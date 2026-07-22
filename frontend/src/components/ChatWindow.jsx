import { useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import WelcomeScreen from './WelcomeScreen'
import MessageBubble from './MessageBubble'

export default function ChatWindow({ messages, onSelectSuggestion, onRegenerate, onReact, isLoading }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isLoading])

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id

  if (!messages || messages.length === 0) {
    return <WelcomeScreen onSelectSuggestion={onSelectSuggestion} />
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <AnimatePresence initial={false}>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLast={message.id === lastAssistantId}
            onRegenerate={onRegenerate}
            onReact={onReact}
          />
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  )
}
