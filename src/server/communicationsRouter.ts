import { Router, type Request, type Response } from 'express'
import { normalizePhoneNumber } from './whatsappWebhook.js'

const parseInboundMetadata = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

const readConversationPhone = (conversation: any, lastMessage: any) => {
  if (typeof conversation?.externalId === 'string' && conversation.externalId.includes(':')) {
    const parts = conversation.externalId.split(':')
    const phoneCandidate = parts[parts.length - 1]
    const normalized = normalizePhoneNumber(phoneCandidate)
    if (normalized) return normalized
  }

  const meta = parseInboundMetadata(lastMessage?.mediaUrl)
  const metaPhone = normalizePhoneNumber(String(meta?.fromPhone || ''))
  if (metaPhone) return metaPhone

  const whatsapp = normalizePhoneNumber(String(conversation?.client?.whatsappNumber || ''))
  if (whatsapp) return whatsapp

  return normalizePhoneNumber(String(conversation?.client?.primaryPhone || ''))
}

export function createCommunicationsRouter(prisma: any) {
  const router = Router()

  router.post('/channels', async (req: Request, res: Response) => {
    try {
      const { type, name, isActive } = req.body
      if (!type) return res.status(400).json({ error: 'channel type is required' })

      const created = await prisma.channel.create({
        data: {
          type,
          name: typeof name === 'string' ? name : undefined,
          isActive: isActive === false ? false : true,
        },
      })

      res.status(201).json(created)
    } catch (error) {
      console.error('POST /communications/channels error:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  router.get('/channels', async (_req: Request, res: Response) => {
    try {
      const channels = await prisma.channel.findMany({ orderBy: { createdAt: 'desc' } })
      res.json({ data: channels })
    } catch (error) {
      console.error('GET /communications/channels error:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  router.post('/conversations', async (req: Request, res: Response) => {
    try {
      const { channelId, externalId, clientId, serviceOrderId } = req.body
      if (!channelId) return res.status(400).json({ error: 'channelId is required' })

      const created = await prisma.conversation.create({
        data: {
          channelId,
          externalId: typeof externalId === 'string' ? externalId : undefined,
          clientId: typeof clientId === 'string' ? clientId : undefined,
          serviceOrderId: typeof serviceOrderId === 'string' ? serviceOrderId : undefined,
        },
      })

      res.status(201).json(created)
    } catch (error) {
      console.error('POST /communications/conversations error:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  router.get('/conversations', async (req: Request, res: Response) => {
    try {
      const where: any = {}
      if (req.query.serviceOrderId) where.serviceOrderId = String(req.query.serviceOrderId)
      if (req.query.clientId) where.clientId = String(req.query.clientId)

      const conversations = await prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          channel: true,
          client: true,
          serviceOrder: true,
        },
      })

      res.json({ data: conversations })
    } catch (error) {
      console.error('GET /communications/conversations error:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  router.get('/conversations/recent', async (req: Request, res: Response) => {
    try {
      const take = Math.min(100, Math.max(1, Number(req.query.take) || 20))
      const phoneFilter = normalizePhoneNumber(typeof req.query.phone === 'string' ? req.query.phone : undefined)
      const phoneVariants = phoneFilter
        ? [...new Set([phoneFilter, phoneFilter.replace(/^\+/, ''), phoneFilter.replace(/^\+55/, '')])]
        : []

      const where: any = {}
      if (phoneVariants.length > 0) {
        where.OR = [
          { externalId: { contains: `:${phoneFilter}` } },
          { client: { whatsappNumber: { in: phoneVariants } } },
          { client: { primaryPhone: { in: phoneVariants } } },
        ]
      }

      const conversations = await prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take,
        include: {
          client: true,
          serviceOrder: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })

      const data = conversations.map((conversation: any) => {
        const lastMessage = conversation.messages?.[0] || null
        const metadata = parseInboundMetadata(lastMessage?.mediaUrl)
        const fromName =
          typeof metadata?.fromName === 'string' && metadata.fromName.trim().length > 0
            ? metadata.fromName.trim()
            : null

        return {
          id: conversation.id,
          phone: readConversationPhone(conversation, lastMessage),
          name: fromName || conversation.client?.name || null,
          client: conversation.client
            ? {
                id: conversation.client.id,
                name: conversation.client.name,
              }
            : null,
          serviceOrder: conversation.serviceOrder
            ? {
                id: conversation.serviceOrder.id,
                protocol: conversation.serviceOrder.protocol,
                status: conversation.serviceOrder.status,
              }
            : null,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                direction: lastMessage.direction,
                type: lastMessage.type,
                text: lastMessage.content,
                sentAt: lastMessage.sentAt,
                receivedAt: lastMessage.receivedAt,
                createdAt: lastMessage.createdAt,
              }
            : null,
          updatedAt: conversation.updatedAt,
        }
      })

      return res.json({ data })
    } catch (error) {
      console.error('GET /communications/conversations/recent error:', error)
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  router.get('/conversations/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          channel: true,
          client: true,
          serviceOrder: true,
          messages: { orderBy: { createdAt: 'asc' } },
        },
      })
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' })
      res.json(conversation)
    } catch (error) {
      console.error('GET /communications/conversations/:id error:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  router.get('/conversations/:id/messages', async (req: Request, res: Response) => {
    const conversationId = req.params.id
    if (!conversationId) return res.status(400).json({ error: 'Missing conversation id' })

    try {
      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      })
      res.json({ data: messages })
    } catch (error) {
      console.error('GET /communications/conversations/:id/messages error:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  router.get('/clients/:clientId/conversations', async (req: Request, res: Response) => {
    const clientId = req.params.clientId
    if (!clientId) return res.status(400).json({ error: 'Missing clientId' })

    try {
      const conversations = await prisma.conversation.findMany({
        where: { clientId },
        orderBy: { updatedAt: 'desc' },
        include: {
          channel: true,
          serviceOrder: true,
        },
      })
      res.json({ data: conversations })
    } catch (error) {
      console.error('GET /communications/clients/:clientId/conversations error:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
    const conversationId = req.params.id
    if (!conversationId) return res.status(400).json({ error: 'Missing conversation id' })

    try {
      const { direction, type, content, mediaUrl, mediaId, sentAt, receivedAt } = req.body
      if (!direction || !type) {
        return res.status(400).json({ error: 'direction and type are required' })
      }

      const created = await prisma.message.create({
        data: {
          conversationId,
          direction,
          type,
          content: typeof content === 'string' ? content : undefined,
          mediaUrl: typeof mediaUrl === 'string' ? mediaUrl : undefined,
          mediaId: typeof mediaId === 'string' ? mediaId : undefined,
          sentAt: sentAt ? new Date(sentAt) : undefined,
          receivedAt: receivedAt ? new Date(receivedAt) : undefined,
        },
      })

      res.status(201).json(created)
    } catch (error) {
      console.error('POST /communications/conversations/:id/messages error:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  return router
}
