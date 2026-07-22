// Minimal reference backend for Forge AI — Node.js + Express
// Run with: node server/index.js (from the project root)
// This is a starting point: swap the mock reply logic for your real LLM call.

import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json({ limit: '2mb' }))

// In-memory store — replace with a real database in production
const chatStore = new Map()

app.post('/api/chat', async (req, res) => {
  const { message, chatId, model } = req.body || {}

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'A "message" string is required.' })
  }

  // Replace this block with your actual model call (OpenAI, Anthropic, local LLM, etc.)
  const reply = `You said: "${message}". This is a placeholder reply from ${model || 'Forge AI'} — connect your LLM provider here.`

  const record = chatStore.get(chatId) || { id: chatId, title: message.slice(0, 40), messages: [] }
  record.messages.push({ role: 'user', content: message }, { role: 'assistant', content: reply })
  chatStore.set(chatId, record)

  res.json({ reply, chatId, createdAt: new Date().toISOString() })
})

app.get('/api/history', (_req, res) => {
  res.json({ chats: Array.from(chatStore.values()) })
})

app.delete('/api/chat', (req, res) => {
  const { chatId } = req.body || {}
  if (chatId) {
    chatStore.delete(chatId)
  } else {
    chatStore.clear()
  }
  res.json({ success: true })
})

app.listen(PORT, () => {
  console.log(`Forge AI backend listening on http://localhost:${PORT}`)
})
