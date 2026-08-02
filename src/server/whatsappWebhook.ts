import type { PrismaClient } from '../../generated/prisma/client.js'

export type WhatsAppWebhookPayload = Record<string, unknown>

export type NormalizedEvolutionInboundMessage = {
  providerMessageId: string | null
  instanceName: string
  fromPhone: string
  fromName: string | null
  messageType: 'TEXT' | 'UNSUPPORTED'
  text: string | null
  timestamp: Date
  rawPayload: Record<string, unknown>
}

const OPEN_SERVICE_ORDER_STATUSES = ['ABERTA', 'EM_DIAGNOSTICO', 'AGUARDANDO_CLIENTE'] as const

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toDateFromUnknown = (value: unknown): Date | null => {
  if (typeof value === 'number') {
    const millis = value < 10_000_000_000 ? value * 1000 : value
    const cast = new Date(millis)
    return Number.isNaN(cast.getTime()) ? null : cast
  }

  if (typeof value === 'string') {
    const asNumber = Number(value)
    if (!Number.isNaN(asNumber)) {
      return toDateFromUnknown(asNumber)
    }
    const cast = new Date(value)
    return Number.isNaN(cast.getTime()) ? null : cast
  }

  return null
}

export function normalizePhoneNumber(phone: string | undefined): string {
  const value = String(phone || '').trim()
  if (!value) return ''

  const withoutJid = value.includes('@') ? (value.split('@')[0] ?? '') : value
  let digits = withoutJid.replace(/\D/g, '')
  if (!digits) return ''

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`
  }

  return `+${digits}`
}

const buildPhoneVariants = (normalizedPhone: string): string[] => {
  if (!normalizedPhone) return []
  const noPlus = normalizedPhone.replace(/^\+/, '')
  const local = noPlus.startsWith('55') ? noPlus.slice(2) : noPlus
  return [...new Set([normalizedPhone, noPlus, local])].filter(Boolean)
}

export function normalizeEvolutionInboundMessage(payload: WhatsAppWebhookPayload): NormalizedEvolutionInboundMessage | null {
  const root = asRecord(payload)
  const event = asString(root.event)?.toLowerCase() || null
  const data = asRecord(root.data)
  const key = asRecord(data.key)
  const message = asRecord(data.message)

  const fromMe = Boolean(
    key.fromMe
    ?? data.fromMe
    ?? root.fromMe
  )

  if (fromMe) {
    return null
  }

  if (event && !event.includes('message')) {
    return null
  }

  const remoteJid = asString(key.remoteJid) || asString(root.remoteJid) || asString(root.phone) || asString(data.sender)
  const fromPhone = normalizePhoneNumber(remoteJid || undefined)
  if (!fromPhone) {
    return null
  }

  const providerMessageId = asString(key.id) || asString(root.messageId) || asString(data.id)
  const instanceName = asString(root.instance) || asString(root.instanceName) || asString(data.instance) || 'assist-tech-main'
  const fromName = asString(data.pushName) || asString(root.pushName) || asString(root.fromName)

  const conversationText = asString(message.conversation)
  const extendedText = asString(asRecord(message.extendedTextMessage).text)
  const directText = asString(root.text) || asString(data.text) || asString(data.body)
  const text = conversationText || extendedText || directText

  const timestamp =
    toDateFromUnknown(data.messageTimestamp)
    || toDateFromUnknown(root.timestamp)
    || new Date()

  return {
    providerMessageId,
    instanceName,
    fromPhone,
    fromName,
    messageType: text ? 'TEXT' : 'UNSUPPORTED',
    text,
    timestamp,
    rawPayload: root,
  }
}

async function ensureWhatsAppChannel(prisma: PrismaClient) {
  const existing = await prisma.channel.findFirst({ where: { type: 'WHATSAPP_BUSINESS_API' } })
  if (existing) return existing

  return prisma.channel.create({
    data: {
      type: 'WHATSAPP_BUSINESS_API',
      name: 'WhatsApp Gateway',
      isActive: true,
    },
  })
}

async function findClientByPhone(prisma: PrismaClient, normalizedPhone: string) {
  const variants = buildPhoneVariants(normalizedPhone)
  if (variants.length === 0) return null

  const exact = await prisma.client.findFirst({
    where: {
      OR: [
        { whatsappNumber: { in: variants } },
        { primaryPhone: { in: variants } },
      ],
    },
  })
  if (exact) return exact

  const sample = await prisma.client.findMany({
    where: {
      OR: [
        { whatsappNumber: { not: null } },
        { primaryPhone: { not: null } },
      ],
    },
    take: 500,
    orderBy: { updatedAt: 'desc' },
  })

  return sample.find((item) => {
    const a = normalizePhoneNumber(item.whatsappNumber || undefined)
    const b = normalizePhoneNumber(item.primaryPhone || undefined)
    return a === normalizedPhone || b === normalizedPhone
  }) || null
}

async function findServiceOrderCandidate(prisma: PrismaClient, clientId: string): Promise<string | null> {
  const openOrders = await prisma.serviceOrder.findMany({
    where: {
      clientId,
      status: { in: [...OPEN_SERVICE_ORDER_STATUSES] },
    },
    orderBy: { updatedAt: 'desc' },
    take: 2,
  })

  if (openOrders.length === 1) {
    const [singleOpen] = openOrders
    return singleOpen ? singleOpen.id : null
  }

  if (openOrders.length > 1) {
    return null
  }

  const recentThreshold = new Date(Date.now() - (15 * 24 * 60 * 60 * 1000))
  const recentOrders = await prisma.serviceOrder.findMany({
    where: {
      clientId,
      createdAt: { gte: recentThreshold },
    },
    orderBy: { createdAt: 'desc' },
    take: 2,
  })

  if (recentOrders.length === 1) {
    const [singleRecent] = recentOrders
    return singleRecent ? singleRecent.id : null
  }

  return null
}

export async function handleWhatsAppWebhook(prisma: PrismaClient, payload: WhatsAppWebhookPayload) {
  const normalized = normalizeEvolutionInboundMessage(payload)
  if (!normalized) {
    console.info('[whatsapp-webhook] evento ignorado (payload irrelevante/parcial)')
    return { ok: true, ignored: true, reason: 'irrelevant_or_partial_payload' }
  }

  console.info('[whatsapp-webhook] inbound recebido', {
    instanceName: normalized.instanceName,
    providerMessageId: normalized.providerMessageId,
    messageType: normalized.messageType,
  })

  const channel = await ensureWhatsAppChannel(prisma)
  const client = await findClientByPhone(prisma, normalized.fromPhone)

  console.info('[whatsapp-webhook] telefone normalizado', {
    fromPhone: normalized.fromPhone,
  })
  console.info('[whatsapp-webhook] cliente', {
    found: Boolean(client),
    clientId: client?.id || null,
  })

  const conversationExternalId = `${normalized.instanceName}:${normalized.fromPhone}`
  let conversation = await prisma.conversation.findFirst({
    where: {
      channelId: channel.id,
      externalId: conversationExternalId,
      status: { not: 'CLOSED' },
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (!conversation) {
    let serviceOrderId: string | undefined
    if (client?.id) {
      const candidate = await findServiceOrderCandidate(prisma, client.id)
      if (candidate) {
        serviceOrderId = candidate
      }
    }

    conversation = await prisma.conversation.create({
      data: {
        channelId: channel.id,
        externalId: conversationExternalId,
        clientId: client?.id ?? null,
        serviceOrderId: serviceOrderId ?? null,
        status: 'OPEN',
      },
    })

    console.info('[whatsapp-webhook] conversa criada', {
      conversationId: conversation.id,
      serviceOrderId: conversation.serviceOrderId || null,
    })
  } else {
    const shouldAttachClient = !conversation.clientId && Boolean(client?.id)
    const shouldAttachServiceOrder = !conversation.serviceOrderId && Boolean(client?.id)
    if (shouldAttachClient || shouldAttachServiceOrder) {
      let serviceOrderId = conversation.serviceOrderId
      if (shouldAttachServiceOrder && client?.id) {
        const candidate = await findServiceOrderCandidate(prisma, client.id)
        if (candidate) {
          serviceOrderId = candidate
        }
      }

      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          clientId: shouldAttachClient ? (client?.id ?? null) : conversation.clientId,
          serviceOrderId: serviceOrderId ?? null,
          status: 'OPEN',
        },
      })
    } else {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: 'OPEN' },
      })
    }

    console.info('[whatsapp-webhook] conversa reutilizada', {
      conversationId: conversation.id,
      serviceOrderId: conversation.serviceOrderId || null,
    })
  }

  if (normalized.providerMessageId) {
    const duplicated = await prisma.message.findFirst({
      where: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        mediaId: normalized.providerMessageId,
      },
    })

    if (duplicated) {
      console.info('[whatsapp-webhook] duplicata ignorada', {
        providerMessageId: normalized.providerMessageId,
        conversationId: conversation.id,
      })
      return {
        ok: true,
        duplicated: true,
        conversationId: conversation.id,
        clientId: client?.id || null,
      }
    }
  }

  const metadata = {
    provider: 'EVOLUTION',
    instanceName: normalized.instanceName,
    fromName: normalized.fromName,
    fromPhone: normalized.fromPhone,
    rawPayload: normalized.rawPayload,
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      type: normalized.messageType === 'TEXT' ? 'TEXT' : 'DOCUMENT',
      content: normalized.text || '[mensagem não textual não suportada nesta sprint]',
      mediaId: normalized.providerMessageId || null,
      mediaUrl: JSON.stringify(metadata),
      sentAt: normalized.timestamp,
      receivedAt: new Date(),
    },
  })

  console.info('[whatsapp-webhook] mensagem salva', {
    conversationId: conversation.id,
    providerMessageId: normalized.providerMessageId,
  })

  return {
    ok: true,
    ignored: false,
    duplicated: false,
    conversationId: conversation.id,
    clientId: client?.id || null,
    serviceOrderId: conversation.serviceOrderId || null,
  }
}
