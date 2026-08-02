import React, { useEffect, useMemo, useState } from 'react'
import ConversationDetailPanel from '../ConversationDetailPanel.js'
import { fetchRecentConversations, type InboxConversationSummary } from '../httpClient.js'

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '--'
  const cast = new Date(value)
  if (Number.isNaN(cast.getTime())) return '--'
  return cast.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const truncateInboxText = (value: string | null | undefined, maxLength = 80) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return 'Sem mensagem'
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}...`
}

export const formatInboxPhone = (phone: string | null | undefined) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return 'Sem telefone'

  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4)
    const first = digits.slice(4, 9)
    const second = digits.slice(9)
    return `+55 (${ddd}) ${first}-${second}`
  }

  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4)
    const first = digits.slice(4, 8)
    const second = digits.slice(8)
    return `+55 (${ddd}) ${first}-${second}`
  }

  return phone || 'Sem telefone'
}

const osLabel = (conversation: InboxConversationSummary) => {
  if (!conversation.serviceOrder) return 'Sem OS'
  return `${conversation.serviceOrder.protocol || conversation.serviceOrder.id} · ${conversation.serviceOrder.status}`
}

export default function ConversationsInboxPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conversations, setConversations] = useState<InboxConversationSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterInput, setFilterInput] = useState('')
  const [filterPhone, setFilterPhone] = useState('')

  const loadConversations = async (phone?: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchRecentConversations(phone ? { phone } : undefined)
      setConversations(data)
      setSelectedId((current) => {
        if (current && data.some((conversation) => conversation.id === current)) {
          return current
        }
        return data[0]?.id || null
      })
    } catch (err) {
      setConversations([])
      setSelectedId(null)
      setError(err instanceof Error ? err.message : 'Erro ao carregar conversas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConversations()
  }, [])

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || null,
    [conversations, selectedId]
  )

  const onFilterSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const normalized = filterInput.trim()
    setFilterPhone(normalized)
    loadConversations(normalized || undefined)
  }

  const onClearFilter = () => {
    setFilterInput('')
    setFilterPhone('')
    loadConversations()
  }

  return (
    <div className="conversations-inbox-layout">
      <aside className="sheet conversations-list-panel">
        <div className="section-heading" style={{ marginBottom: 16 }}>
          <div>
            <h3>Conversas recentes</h3>
            <p style={{ margin: 0 }}>WhatsApp / Evolution</p>
          </div>
        </div>

        <form className="conversations-filter" onSubmit={onFilterSubmit}>
          <input
            value={filterInput}
            onChange={(event) => setFilterInput(event.target.value)}
            placeholder="Buscar por telefone"
            aria-label="Buscar por telefone"
          />
          <button type="submit" className="table-action">Filtrar</button>
          <button type="button" className="table-action" onClick={onClearFilter}>Limpar</button>
        </form>

        {filterPhone ? <p className="table-subtle">Filtro ativo: {filterPhone}</p> : null}

        {loading ? (
          <div className="conversations-skeleton-list" aria-label="Carregando conversas">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="conversation-skeleton-item" />
            ))}
          </div>
        ) : null}

        {error ? <p className="feedback-error">{error}</p> : null}

        {!loading && !error && conversations.length === 0 ? (
          <p>Nenhuma conversa recebida ainda.</p>
        ) : null}

        {!loading && !error && conversations.length > 0 ? (
          <ul className="conversations-list" aria-label="Lista de conversas">
            {conversations.map((conversation) => {
              const active = conversation.id === selectedId
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    className={`conversation-list-item ${active ? 'active' : ''}`}
                    onClick={() => setSelectedId(conversation.id)}
                  >
                    <div className="conversation-list-top">
                      <strong>{conversation.name || 'Sem nome'}</strong>
                      <span>{formatDateTime(conversation.lastMessage?.sentAt || conversation.updatedAt)}</span>
                    </div>
                    <div className="conversation-list-mid">{formatInboxPhone(conversation.phone)}</div>
                    <div className="conversation-list-bottom">
                      <span className="status-pill">{osLabel(conversation)}</span>
                      <p>{truncateInboxText(conversation.lastMessage?.text)}</p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </aside>

      <section className="conversations-detail-panel-wrap">
        <ConversationDetailPanel
          conversation={selectedConversation}
          onOpenServiceOrder={(serviceOrderId) => {
            window.history.pushState({}, '', `/service-orders/${serviceOrderId}`)
            window.dispatchEvent(new PopStateEvent('popstate'))
          }}
        />
      </section>
    </div>
  )
}
