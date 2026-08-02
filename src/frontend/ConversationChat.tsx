import React, { useEffect, useRef, useState } from 'react'

type Message = {
  id: string
  direction: 'INBOUND' | 'OUTBOUND'
  type: string
  content?: string | null
  mediaUrl?: string | null
  mediaId?: string | null
  sentAt?: string | null
  createdAt: string
}

type Conversation = {
  id: string
  channel?: { name?: string }
  externalId?: string | null
  status?: string
  client?: { name?: string }
  serviceOrder?: { protocol?: string }
}

type ConversationChatProps = {
  conversationId: string
  conversation: Conversation | null
  onClose: () => void
}

export default function ConversationChat({ conversationId, conversation, onClose }: ConversationChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setMessages([])

    fetch(`/communications/conversations/${encodeURIComponent(conversationId)}/messages`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then((data) => {
        setMessages(Array.isArray(data.data) ? data.data : [])
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar mensagens'))
      .finally(() => setLoading(false))
  }, [conversationId])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  const handleSend = async () => {
    const trimmed = draft.trim()
    if (!trimmed) return

    setSending(true)
    setError(null)

    try {
      const response = await fetch(`/communications/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: trimmed,
          sentAt: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const created = await response.json()
      setMessages((current) => [...current, created])
      setDraft('')
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }, 10)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="sheet" style={{ padding: 0, minHeight: 520, display: 'flex', flexDirection: 'column' }}>
      <div className="section-heading" style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
        <div>
          <h3>Chat da conversa</h3>
          <p style={{ margin: 0, color: '#555' }}>
            {conversation?.channel?.name ? `${conversation.channel.name} ·` : ''} {conversation?.externalId || 'Sem ID externo'}
          </p>
        </div>
        <div className="page-actions" style={{ gap: 8 }}>
          <button type="button" className="table-action" onClick={onClose}>Fechar</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', padding: '0 24px 24px', gap: 16 }}>
        {loading ? (
          <div style={{ padding: 24 }}>Carregando mensagens...</div>
        ) : error ? (
          <div className="feedback-error" style={{ padding: 24 }}>{error}</div>
        ) : (
          <div ref={scrollRef} className="chat-history" style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
            {messages.length === 0 ? (
              <div style={{ padding: 24, color: '#556', fontStyle: 'italic' }}>Nenhuma mensagem nesta conversa.</div>
            ) : (
              messages.map((message) => {
                const isOutbound = message.direction === 'OUTBOUND'
                return (
                  <div key={message.id} className={`chat-message ${isOutbound ? 'chat-message-out' : 'chat-message-in'}`}>
                    <div className="chat-bubble">
                      <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{message.content || message.type || 'Mensagem sem conteúdo'}</p>
                      <div className="chat-meta">{new Date(message.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        <div className="chat-composer">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escreva uma mensagem..."
            rows={3}
            disabled={sending}
          />
          <div className="chat-actions">
            <button type="button" className="button-primary" onClick={handleSend} disabled={sending || !draft.trim()}>
              {sending ? 'Enviando...' : 'Enviar mensagem'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
