import assert from 'node:assert/strict'
import test from 'node:test'
import {
  handleWhatsAppWebhook,
  normalizeEvolutionInboundMessage,
  normalizePhoneNumber,
} from '../src/server/whatsappWebhook.ts'

const createMockPrisma = () => {
  const state = {
    channels: [],
    clients: [],
    conversations: [],
    messages: [],
    serviceOrders: [],
  }

  let idCounter = 1
  const nextId = (prefix) => `${prefix}-${idCounter++}`

  const prisma = {
    channel: {
      async findFirst(args) {
        if (!args?.where?.type) return state.channels[0] || null
        return state.channels.find((item) => item.type === args.where.type) || null
      },
      async create(args) {
        const created = {
          id: nextId('channel'),
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        state.channels.push(created)
        return created
      },
    },
    client: {
      async findFirst(args) {
        const entries = args?.where?.OR || []
        for (const entry of entries) {
          const whatsappIn = entry?.whatsappNumber?.in || []
          if (whatsappIn.length > 0) {
            const found = state.clients.find((item) => whatsappIn.includes(item.whatsappNumber))
            if (found) return found
          }

          const primaryIn = entry?.primaryPhone?.in || []
          if (primaryIn.length > 0) {
            const found = state.clients.find((item) => primaryIn.includes(item.primaryPhone))
            if (found) return found
          }
        }
        return null
      },
      async findMany(args) {
        const values = [...state.clients]
        if (args?.orderBy?.updatedAt === 'desc') {
          values.sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
        }
        return values.slice(0, args?.take || values.length)
      },
    },
    conversation: {
      async findFirst(args) {
        const items = state.conversations.filter((item) => {
          if (args?.where?.channelId && item.channelId !== args.where.channelId) return false
          if (args?.where?.externalId && item.externalId !== args.where.externalId) return false
          if (args?.where?.status?.not && item.status === args.where.status.not) return false
          return true
        })
        items.sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
        return items[0] || null
      },
      async create(args) {
        const created = {
          id: nextId('conversation'),
          channelId: args.data.channelId,
          clientId: args.data.clientId || null,
          serviceOrderId: args.data.serviceOrderId || null,
          externalId: args.data.externalId || null,
          status: args.data.status,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        state.conversations.push(created)
        return created
      },
      async update(args) {
        const index = state.conversations.findIndex((item) => item.id === args.where.id)
        const current = state.conversations[index]
        const updated = {
          ...current,
          ...args.data,
          updatedAt: new Date(),
        }
        state.conversations[index] = updated
        return updated
      },
    },
    message: {
      async findFirst(args) {
        return state.messages.find((item) => {
          if (args?.where?.conversationId && item.conversationId !== args.where.conversationId) return false
          if (args?.where?.direction && item.direction !== args.where.direction) return false
          if (args?.where?.mediaId && item.mediaId !== args.where.mediaId) return false
          return true
        }) || null
      },
      async create(args) {
        const created = {
          id: nextId('message'),
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        state.messages.push(created)
        return created
      },
    },
    serviceOrder: {
      async findMany(args) {
        let values = state.serviceOrders.filter((item) => item.clientId === args.where.clientId)

        if (args?.where?.status?.in) {
          const allowed = args.where.status.in
          values = values.filter((item) => allowed.includes(item.status))
        }

        if (args?.where?.createdAt?.gte) {
          values = values.filter((item) => Number(item.createdAt) >= Number(args.where.createdAt.gte))
        }

        if (args?.orderBy?.updatedAt === 'desc') {
          values.sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
        } else if (args?.orderBy?.createdAt === 'desc') {
          values.sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
        }

        return values.slice(0, args?.take || values.length)
      },
    },
  }

  return { prisma, state, nextId }
}

const evolutionTextPayload = ({
  id = 'MSG-1',
  instance = 'assist-tech-main',
  remoteJid = '5511999990000@s.whatsapp.net',
  text = 'Olá, quero saber da minha OS',
  fromMe = false,
  pushName = 'Cliente Teste',
} = {}) => ({
  event: 'messages.upsert',
  instance,
  data: {
    key: {
      id,
      remoteJid,
      fromMe,
    },
    pushName,
    messageTimestamp: 1722628800,
    message: {
      conversation: text,
    },
  },
})

test('normaliza telefones para formato comparável', () => {
  assert.equal(normalizePhoneNumber('11999999999'), '+5511999999999')
  assert.equal(normalizePhoneNumber('5511999999999'), '+5511999999999')
  assert.equal(normalizePhoneNumber('+55 (11) 99999-9999'), '+5511999999999')
  assert.equal(normalizePhoneNumber('5511999999999@s.whatsapp.net'), '+5511999999999')
})

test('normaliza payload inbound da Evolution para mensagem de texto', () => {
  const normalized = normalizeEvolutionInboundMessage(evolutionTextPayload())
  assert.ok(normalized)
  assert.equal(normalized.instanceName, 'assist-tech-main')
  assert.equal(normalized.providerMessageId, 'MSG-1')
  assert.equal(normalized.fromPhone, '+5511999990000')
  assert.equal(normalized.fromName, 'Cliente Teste')
  assert.equal(normalized.messageType, 'TEXT')
  assert.equal(normalized.text, 'Olá, quero saber da minha OS')
})

test('ignora eventos irrelevantes ou enviados pelo próprio bot', () => {
  const irrelevant = normalizeEvolutionInboundMessage({ event: 'connection.update', data: {} })
  assert.equal(irrelevant, null)

  const fromMe = normalizeEvolutionInboundMessage(evolutionTextPayload({ fromMe: true }))
  assert.equal(fromMe, null)
})

test('cria conversa quando não existe e salva mensagem inbound', async () => {
  const runtime = createMockPrisma()
  runtime.state.clients.push({
    id: 'client-1',
    name: 'Cliente A',
    whatsappNumber: '+5511999990000',
    primaryPhone: '+5511999990000',
    updatedAt: new Date(),
  })

  const result = await handleWhatsAppWebhook(runtime.prisma, evolutionTextPayload())

  assert.equal(result.ok, true)
  assert.equal(runtime.state.conversations.length, 1)
  assert.equal(runtime.state.messages.length, 1)
  assert.equal(runtime.state.conversations[0].clientId, 'client-1')
  assert.equal(runtime.state.conversations[0].externalId, 'assist-tech-main:+5511999990000')
})

test('reutiliza conversa existente e não duplica por externalMessageId', async () => {
  const runtime = createMockPrisma()
  runtime.state.channels.push({ id: 'channel-1', type: 'WHATSAPP_BUSINESS_API', updatedAt: new Date() })
  runtime.state.conversations.push({
    id: 'conversation-1',
    channelId: 'channel-1',
    clientId: null,
    serviceOrderId: null,
    externalId: 'assist-tech-main:+5511999990000',
    status: 'OPEN',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  runtime.state.messages.push({
    id: 'message-1',
    conversationId: 'conversation-1',
    direction: 'INBOUND',
    mediaId: 'MSG-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const result = await handleWhatsAppWebhook(runtime.prisma, evolutionTextPayload({ id: 'MSG-1' }))

  assert.equal(result.ok, true)
  assert.equal(result.duplicated, true)
  assert.equal(runtime.state.conversations.length, 1)
  assert.equal(runtime.state.messages.length, 1)
})

test('vincula clientId na conversa existente quando encontra cliente por telefone', async () => {
  const runtime = createMockPrisma()
  runtime.state.channels.push({ id: 'channel-1', type: 'WHATSAPP_BUSINESS_API', updatedAt: new Date() })
  runtime.state.clients.push({
    id: 'client-42',
    name: 'Cliente Vinculado',
    whatsappNumber: '(11) 99999-0000',
    primaryPhone: null,
    updatedAt: new Date(),
  })
  runtime.state.conversations.push({
    id: 'conversation-1',
    channelId: 'channel-1',
    clientId: null,
    serviceOrderId: null,
    externalId: 'assist-tech-main:+5511999990000',
    status: 'OPEN',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  await handleWhatsAppWebhook(runtime.prisma, evolutionTextPayload({ id: 'MSG-2' }))

  assert.equal(runtime.state.conversations[0].clientId, 'client-42')
})

test('associa conversa com única OS aberta do cliente', async () => {
  const runtime = createMockPrisma()
  runtime.state.clients.push({
    id: 'client-1',
    name: 'Cliente OS',
    whatsappNumber: '+5511999990000',
    primaryPhone: '+5511999990000',
    updatedAt: new Date(),
  })
  runtime.state.serviceOrders.push({
    id: 'so-1',
    clientId: 'client-1',
    status: 'ABERTA',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  await handleWhatsAppWebhook(runtime.prisma, evolutionTextPayload({ id: 'MSG-3' }))

  assert.equal(runtime.state.conversations.length, 1)
  assert.equal(runtime.state.conversations[0].serviceOrderId, 'so-1')
})
