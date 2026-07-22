import { jsPDF } from 'jspdf'

/**
 * Exports a chat's messages as a simple, readable PDF transcript.
 */
export function exportChatAsPdf(chat) {
  if (!chat || chat.messages.length === 0) return

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const marginX = 48
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const maxWidth = pageWidth - marginX * 2
  let y = 60

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(chat.title || 'Forge AI Chat', marginX, y)
  y += 28

  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(new Date(chat.createdAt || Date.now()).toLocaleString(), marginX, y)
  y += 24
  doc.setTextColor(20)

  chat.messages.forEach((msg) => {
    const label = msg.role === 'user' ? 'You' : 'Forge AI'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    if (y > pageHeight - 80) {
      doc.addPage()
      y = 60
    }
    doc.text(label, marginX, y)
    y += 16

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    const lines = doc.splitTextToSize(msg.content || '', maxWidth)
    lines.forEach((line) => {
      if (y > pageHeight - 60) {
        doc.addPage()
        y = 60
      }
      doc.text(line, marginX, y)
      y += 14
    })
    y += 14
  })

  doc.save(`${(chat.title || 'forge-chat').replace(/\s+/g, '-').toLowerCase()}.pdf`)
}
