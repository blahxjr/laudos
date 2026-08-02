import { parseHttpResponseSafely } from './httpResponse.js'

export type InboxMessageSummary = {
  id: string
  direction: 'INBOUND' | 'OUTBOUND'
  type: string
  text: string | null
  sentAt: string | null
  receivedAt: string | null
  createdAt: string
}

export type InboxConversationSummary = {
  id: string
  phone: string
  name: string | null
  client: { id: string; name: string } | null
  serviceOrder: { id: string; protocol: string; status: string } | null
  lastMessage: InboxMessageSummary | null
  updatedAt: string
}

export type InboxConversationDetail = {
  id: string
  status: string
  externalId: string | null
  client: { id: string; name: string } | null
  serviceOrder: { id: string; protocol: string; status: string } | null
  messages: Array<{
    id: string
    direction: 'INBOUND' | 'OUTBOUND'
    type: string
    content: string | null
    sentAt: string | null
    receivedAt: string | null
    createdAt: string
  }>
}

const toApiError = (message: string, status?: number) => {
  return status ? `${message} (HTTP ${status})` : message
}

export const buildRecentConversationsEndpoint = (params?: { phone?: string }) => {
  const query = new URLSearchParams()
  if (params?.phone?.trim()) {
    query.set('phone', params.phone.trim())
  }

  const serialized = query.toString()
  return serialized
    ? `/communications/conversations/recent?${serialized}`
    : '/communications/conversations/recent'
}

export async function fetchRecentConversations(params?: { phone?: string }): Promise<InboxConversationSummary[]> {
  const response = await fetch(buildRecentConversationsEndpoint(params))
  const parsed = await parseHttpResponseSafely<{ data?: InboxConversationSummary[]; error?: string }>(response)

  if (!parsed.ok) {
    throw new Error(parsed.message || toApiError('Falha ao carregar conversas', parsed.status))
  }

  if (parsed.data?.error) {
    throw new Error(parsed.data.error)
  }

  const list = Array.isArray(parsed.data?.data) ? parsed.data?.data : []
  return list
}

export async function fetchConversationDetail(conversationId: string): Promise<InboxConversationDetail> {
  const response = await fetch(`/communications/conversations/${encodeURIComponent(conversationId)}`)
  const parsed = await parseHttpResponseSafely<InboxConversationDetail & { error?: string }>(response)

  if (!parsed.ok || !parsed.data) {
    throw new Error(parsed.message || toApiError('Falha ao carregar detalhes da conversa', parsed.status))
  }

  if (parsed.data.error) {
    throw new Error(parsed.data.error)
  }

  return parsed.data
}
