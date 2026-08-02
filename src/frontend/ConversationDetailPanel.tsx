import React, { useEffect, useState } from 'react'
import { fetchConversationDetail, type InboxConversationDetail, type InboxConversationSummary } from './httpClient.js'

type ConversationDetailPanelProps = {
  conversation: InboxConversationSummary | null
  onOpenServiceOrder: (serviceOrderId: string) => void
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Sem data'
  const cast = new Date(value)
  if (Number.isNaN(cast.getTime())) return 'Sem data'
  return cast.toLocaleString('pt-BR')
}

const statusClassName = (status?: string) => {
  const normalized = (status || '').toUpperCase()
  if (normalized.includes('CONCL')) return 'status-pill status-done'
  if (normalized.includes('ABER') || normalized.includes('DIAGN')) return 'status-pill status-open'
  if (normalized.includes('AGUARD') || normalized.includes('PEND')) return 'status-pill status-pending'
  if (normalized.includes('DESCON') || normalized.includes('CLOSED')) return 'status-pill status-disconnected'
  return 'status-pill'
}

export default function ConversationDetailPanel({ conversation, onOpenServiceOrder }: ConversationDetailPanelProps) {
  const [detail, setDetail] = useState<InboxConversationDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!conversation?.id) {
      setDetail(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false

    const loadDetail = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchConversationDetail(conversation.id)
        if (!cancelled) {
          setDetail(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao carregar detalhes da conversa.')
          setDetail(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadDetail()
    return () => {
      cancelled = true
    }
  }, [conversation?.id])

  if (!conversation) {
    return (
      <div className="sheet conversation-detail-panel">
        <h3>Detalhes da conversa</h3>
        <p>Selecione uma conversa na lista ao lado.</p>
      </div>
    )
  }

  const serviceOrder = conversation.serviceOrder
  const messages = (detail?.messages || []).slice(-8)
  const lastMessage = conversation.lastMessage

  return (
    <div className="sheet conversation-detail-panel">
      <h3>Detalhes da conversa</h3>

      <div className="conversation-detail-grid">
        <div className="info-row">
          <strong>Telefone</strong>
          <span>{conversation.phone || 'Não informado'}</span>
        </div>
        <div className="info-row">
          <strong>Nome</strong>
          <span>{conversation.name || 'Sem nome'}</span>
        </div>
        <div className="info-row">
          <strong>Cliente</strong>
          <span>{conversation.client?.name || 'Não vinculado'}</span>
        </div>
        <div className="info-row">
          <strong>Status da conversa</strong>
          <span className={statusClassName(detail?.status || 'OPEN')}>{detail?.status || 'OPEN'}</span>
        </div>
      </div>

      <div className="conversation-os-box">
        <div>
          <strong>OS vinculada</strong>
          <p>
            {serviceOrder
              ? `${serviceOrder.protocol || serviceOrder.id} · ${serviceOrder.status}`
              : 'Nenhuma OS vinculada'}
          </p>
        </div>
        {serviceOrder ? (
          <button
            type="button"
            className="button-primary"
            onClick={() => onOpenServiceOrder(serviceOrder.id)}
          >
            Abrir OS
          </button>
        ) : (
          <button type="button" className="table-action" disabled>
            Criar OS (próximo sprint)
          </button>
        )}
      </div>

      <div className="conversation-last-message">
        <h4>Resumo da última mensagem</h4>
        {lastMessage ? (
          <>
            <p>{lastMessage.text || 'Mensagem sem texto'}</p>
            <span>{formatDateTime(lastMessage.sentAt || lastMessage.createdAt)}</span>
          </>
        ) : (
          <p>Nenhuma mensagem registrada ainda.</p>
        )}
      </div>

      <div className="conversation-message-preview">
        <h4>Mensagens recentes</h4>
        {loading ? <p>Carregando mensagens...</p> : null}
        {error ? <p className="feedback-error">{error}</p> : null}
        {!loading && !error && messages.length === 0 ? <p>Sem mensagens para exibir.</p> : null}
        {!loading && !error && messages.length > 0 ? (
          <ul className="conversation-message-list">
            {messages.map((message) => (
              <li key={message.id} className={`conversation-message-item ${message.direction === 'OUTBOUND' ? 'outbound' : 'inbound'}`}>
                <div>
                  <strong>{message.direction === 'INBOUND' ? 'Cliente' : 'Atendimento'}</strong>
                  <p>{message.content || message.type}</p>
                </div>
                <span>{formatDateTime(message.sentAt || message.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
