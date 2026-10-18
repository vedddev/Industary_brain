import { useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import MessageBubble from './MessageBubble'
import WorkspaceHome from './WorkspaceHome'

export default function ChatWindow({ messages, documents = [], onSelectSuggestion, onRegenerate, onReact, isLoading, onUpload, isUploading }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isLoading])

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id

  if (!messages || messages.length === 0) {
    return <WorkspaceHome documents={documents} onSelectSuggestion={onSelectSuggestion} onUpload={onUpload} isUploading={isUploading} />
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 py-7 sm:px-7">
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
