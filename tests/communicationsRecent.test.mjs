import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import { createCommunicationsRouter } from '../src/server/communicationsRouter.ts'

const setupServer = async (prisma) => {
  const app = express()
  app.use(express.json())
  app.use('/communications', createCommunicationsRouter(prisma))

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance))
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve test server address')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) return reject(error)
          resolve(undefined)
        })
      })
    },
  }
}

test('GET /communications/conversations/recent retorna resumo de conversa', async () => {
  const prisma = {
    conversation: {
      async findMany() {
        return [
          {
            id: 'conv-1',
            externalId: 'assist-tech-main:+5511999990000',
            updatedAt: '2026-08-02T23:10:00.000Z',
            client: { id: 'client-1', name: 'Cliente Inbox', whatsappNumber: '+5511999990000', primaryPhone: null },
            serviceOrder: { id: 'so-1', protocol: 'OS-123', status: 'ABERTA' },
            messages: [
              {
                id: 'msg-1',
                direction: 'INBOUND',
                type: 'TEXT',
                content: 'Olá, tudo bem?',
                sentAt: '2026-08-02T23:09:00.000Z',
                receivedAt: '2026-08-02T23:09:10.000Z',
                createdAt: '2026-08-02T23:09:10.000Z',
                mediaUrl: JSON.stringify({ fromName: 'Cliente Inbox' }),
              },
            ],
          },
        ]
      },
    },
  }

  const runtime = await setupServer(prisma)
  try {
    const response = await fetch(`${runtime.baseUrl}/communications/conversations/recent`)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.ok(Array.isArray(body.data))
    assert.equal(body.data.length, 1)
    assert.equal(body.data[0].id, 'conv-1')
    assert.equal(body.data[0].phone, '+5511999990000')
    assert.equal(body.data[0].name, 'Cliente Inbox')
    assert.equal(body.data[0].serviceOrder.protocol, 'OS-123')
    assert.equal(body.data[0].lastMessage.text, 'Olá, tudo bem?')
  } finally {
    await runtime.close()
  }
})

test('GET /communications/conversations/recent aplica filtro por telefone no where', async () => {
  let receivedWhere = null
  const prisma = {
    conversation: {
      async findMany(args) {
        receivedWhere = args.where
        return []
      },
    },
  }

  const runtime = await setupServer(prisma)
  try {
    const response = await fetch(`${runtime.baseUrl}/communications/conversations/recent?phone=+55%2011%2099999-0000`)
    assert.equal(response.status, 200)
    assert.ok(receivedWhere)
    assert.ok(Array.isArray(receivedWhere.OR))
    assert.equal(receivedWhere.OR.length, 3)
  } finally {
    await runtime.close()
  }
})
