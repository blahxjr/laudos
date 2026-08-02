import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import { registerWhatsAppSettingsRoutes } from '../src/server/whatsappSettingsRoutes.ts'

const createInMemorySettingsPrisma = (options = {}) => {
  const withConnectionModel = Boolean(options.withConnectionModel)
  const store = new Map()
  const connectionStore = new Map()
  let counter = 1

  const normalizeWhereKey = (where) => `${where.category}::${where.key}`

  const prisma = {
    appSetting: {
      async findMany(args) {
        const category = args?.where?.category
        const keys = args?.where?.key?.in ?? []

        return [...store.values()].filter((item) => {
          if (category && item.category !== category) return false
          if (Array.isArray(keys) && keys.length > 0 && !keys.includes(item.key)) return false
          return true
        })
      },
      async upsert(args) {
        const where = args?.where?.category_key
        const storeKey = normalizeWhereKey(where)
        const existing = store.get(storeKey)
        if (existing) {
          const updated = {
            ...existing,
            value: args.update.value,
            updatedAt: new Date(),
          }
          store.set(storeKey, updated)
          return updated
        }

        const created = {
          id: `setting-${counter++}`,
          category: args.create.category,
          key: args.create.key,
          value: args.create.value,
          updatedAt: new Date(),
        }
        store.set(storeKey, created)
        return created
      },
      async deleteMany(args) {
        const storeKey = normalizeWhereKey(args.where)
        store.delete(storeKey)
        return { count: 1 }
      },
    },
    async $transaction(operations) {
      return Promise.all(operations)
    },
  }

  if (withConnectionModel) {
    prisma.whatsAppConnection = {
      async findFirst() {
        const values = [...connectionStore.values()]
        return values.length > 0 ? values[values.length - 1] : null
      },
      async findUnique(args) {
        return connectionStore.get(args.where.instanceName) || null
      },
      async upsert(args) {
        const instanceName = args.where.instanceName
        const existing = connectionStore.get(instanceName)
        const now = new Date()

        if (existing) {
          const updated = {
            ...existing,
            ...args.update,
            instanceName,
            updatedAt: now,
          }
          connectionStore.set(instanceName, updated)
          return updated
        }

        const created = {
          id: `conn-${counter++}`,
          ...args.create,
          instanceName,
          createdAt: now,
          updatedAt: now,
        }
        connectionStore.set(instanceName, created)
        return created
      },
      async update(args) {
        const instanceName = args.where.instanceName
        const existing = connectionStore.get(instanceName)
        if (!existing) return null
        const updated = {
          ...existing,
          ...args.data,
          updatedAt: new Date(),
        }
        connectionStore.set(instanceName, updated)
        return updated
      },
    }
  }

  return prisma
}

const setupServer = async (options = {}) => {
  const app = express()
  app.use(express.json())

  const prisma = createInMemorySettingsPrisma(options)
  registerWhatsAppSettingsRoutes(app, prisma)

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

test('GET /settings/whatsapp returns default empty values', async () => {
  const runtime = await setupServer()

  try {
    const response = await fetch(`${runtime.baseUrl}/settings/whatsapp`)
    assert.equal(response.status, 200)

    const body = await response.json()
    assert.deepEqual(body, {
      gatewayBaseUrl: null,
      appBaseUrl: null,
      defaultTestPhone: null,
      provider: 'EVOLUTION',
      instanceName: 'assist-tech-main',
      hasGatewayToken: false,
      hasGatewayWebhookToken: false,
    })
  } finally {
    await runtime.close()
  }
})

test('PUT /settings/whatsapp persists values and GET reflects token flags', async () => {
  const runtime = await setupServer()

  try {
    const putResponse = await fetch(`${runtime.baseUrl}/settings/whatsapp`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        gatewayBaseUrl: 'https://gateway.example.com',
        gatewayToken: 'token-123',
        gatewayWebhookToken: 'webhook-123',
        appBaseUrl: 'https://app.example.com',
        defaultTestPhone: '(11) 99999-9999',
      }),
    })

    assert.equal(putResponse.status, 200)
    const putBody = await putResponse.json()
    assert.deepEqual(putBody, {
      gatewayBaseUrl: 'https://gateway.example.com',
      appBaseUrl: 'https://app.example.com',
      defaultTestPhone: '+11999999999',
      provider: 'EVOLUTION',
      instanceName: 'assist-tech-main',
      hasGatewayToken: true,
      hasGatewayWebhookToken: true,
    })
    assert.equal(String(putBody.gatewayBaseUrl).includes('gateway.local.test'), false)

    const getResponse = await fetch(`${runtime.baseUrl}/settings/whatsapp`)
    assert.equal(getResponse.status, 200)
    const getBody = await getResponse.json()
    assert.deepEqual(getBody, putBody)
    assert.equal(String(getBody.gatewayBaseUrl).includes('gateway.local.test'), false)
  } finally {
    await runtime.close()
  }
})

test('GET /settings/whatsapp returns localhost URL exactly after saving localhost:8080', async () => {
  const runtime = await setupServer()

  try {
    const putResponse = await fetch(`${runtime.baseUrl}/settings/whatsapp`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        gatewayBaseUrl: 'http://localhost:8080',
        provider: 'EVOLUTION',
        instanceName: 'assist-tech-main',
      }),
    })

    assert.equal(putResponse.status, 200)

    const getResponse = await fetch(`${runtime.baseUrl}/settings/whatsapp`)
    assert.equal(getResponse.status, 200)
    const body = await getResponse.json()

    assert.equal(body.gatewayBaseUrl, 'http://localhost:8080')
    assert.equal(String(body.gatewayBaseUrl).includes('gateway.local.test'), false)
  } finally {
    await runtime.close()
  }
})

test('POST /settings/whatsapp/test-connection returns success when gateway responds OK', async () => {
  const runtime = await setupServer()
  const originalFetch = global.fetch
  global.fetch = async (url, requestInit) => {
    const asString = String(url)
    if (asString.startsWith(runtime.baseUrl)) {
      return originalFetch(url, requestInit)
    }

    return {
      ok: true,
      status: 200,
      text: async () => '',
    }
  }

  try {
    await fetch(`${runtime.baseUrl}/settings/whatsapp`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        gatewayBaseUrl: 'https://gateway.example.com',
        gatewayToken: 'token-123',
      }),
    })

    const response = await fetch(`${runtime.baseUrl}/settings/whatsapp/test-connection`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.deepEqual(body, { ok: true, message: 'Conexão com gateway OK' })
  } finally {
    global.fetch = originalFetch
    await runtime.close()
  }
})

test('POST /settings/whatsapp/send-test-message uses default phone and sends message', async () => {
  const runtime = await setupServer()
  const originalFetch = global.fetch
  global.fetch = async (url, requestInit) => {
    const asString = String(url)
    if (asString.startsWith(runtime.baseUrl)) {
      return originalFetch(url, requestInit)
    }

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ requestBody: requestInit?.body ?? '' }),
    }
  }

  try {
    await fetch(`${runtime.baseUrl}/settings/whatsapp`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        gatewayBaseUrl: 'https://gateway.example.com',
        gatewayToken: 'token-123',
        defaultTestPhone: '(11) 98888-7777',
      }),
    })

    const response = await fetch(`${runtime.baseUrl}/settings/whatsapp/send-test-message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.ok, true)
    assert.equal(body.phone, '+11988887777')
    assert.match(body.message, /sucesso/i)
  } finally {
    global.fetch = originalFetch
    await runtime.close()
  }
})

test('POST /settings/whatsapp/test-connection returns technicalDetails without exposing secrets', async () => {
  const runtime = await setupServer()
  const originalFetch = global.fetch
  const gatewayToken = 'token-very-secret'
  global.fetch = async (url, requestInit) => {
    const asString = String(url)
    if (asString.startsWith(runtime.baseUrl)) {
      return originalFetch(url, requestInit)
    }

    return {
      ok: false,
      status: 503,
      text: async () => 'gateway unavailable',
    }
  }

  try {
    await fetch(`${runtime.baseUrl}/settings/whatsapp`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        gatewayBaseUrl: 'https://user:super-secret@example.com/api',
        gatewayToken,
      }),
    })

    const response = await fetch(`${runtime.baseUrl}/settings/whatsapp/test-connection`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })

    assert.equal(response.status, 400)
    const body = await response.json()
    assert.equal(body.ok, false)
    assert.equal(body.message, 'Falha ao conectar ao gateway')
    assert.equal(body.technicalDetails.statusCode, 503)
    assert.match(body.technicalDetails.endpoint, /(\/health$|\/instance\/fetchInstances$|\/$)/)
    assert.equal(body.technicalDetails.errorCode, 'HTTP_ERROR')

    const serialized = JSON.stringify(body)
    assert.equal(serialized.includes(gatewayToken), false)
    assert.equal(serialized.includes('super-secret'), false)
    assert.equal(serialized.includes('user:'), false)
  } finally {
    global.fetch = originalFetch
    await runtime.close()
  }
})

test('POST /settings/whatsapp/send-test-message returns technicalDetails without exposing token', async () => {
  const runtime = await setupServer()
  const originalFetch = global.fetch
  const gatewayToken = 'token-ultra-secret'
  global.fetch = async (url, requestInit) => {
    const asString = String(url)
    if (asString.startsWith(runtime.baseUrl)) {
      return originalFetch(url, requestInit)
    }

    return {
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    }
  }

  try {
    await fetch(`${runtime.baseUrl}/settings/whatsapp`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        gatewayBaseUrl: 'https://example.com',
        gatewayToken,
      }),
    })

    const response = await fetch(`${runtime.baseUrl}/settings/whatsapp/send-test-message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '+5511999990000', message: 'oi' }),
    })

    assert.equal(response.status, 400)
    const body = await response.json()
    assert.equal(body.ok, false)
    assert.equal(body.message, 'Falha ao enviar mensagem de teste')
    assert.equal(body.technicalDetails.statusCode, 401)
    assert.match(body.technicalDetails.endpoint, /(\/messages$|\/message\/sendText\/assist-tech-main$|\/message\/sendText$|\/api\/sendText$)/)
    assert.equal(body.technicalDetails.errorCode, 'HTTP_ERROR')

    const serialized = JSON.stringify(body)
    assert.equal(serialized.includes(gatewayToken), false)
  } finally {
    global.fetch = originalFetch
    await runtime.close()
  }
})

test('GET /settings/whatsapp/instance returns disconnected payload by default', async () => {
  const runtime = await setupServer({ withConnectionModel: true })

  try {
    const response = await fetch(`${runtime.baseUrl}/settings/whatsapp/instance`)
    assert.equal(response.status, 200)

    const body = await response.json()
    assert.equal(body.ok, true)
    assert.equal(body.provider, 'EVOLUTION')
    assert.equal(body.instanceName, 'assist-tech-main')
    assert.equal(body.status, 'DISCONNECTED')
    assert.equal(body.qrCodeBase64, null)
  } finally {
    await runtime.close()
  }
})

test('instance lifecycle endpoints create, connect, check status and disconnect', async () => {
  const runtime = await setupServer({ withConnectionModel: true })
  const originalFetch = global.fetch

  global.fetch = async (url, requestInit) => {
    const asString = String(url)
    if (asString.startsWith(runtime.baseUrl)) {
      return originalFetch(url, requestInit)
    }

    if (asString.endsWith('/instance/create')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'open' }),
      }
    }

    if (asString.includes('/instance/connect/')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          status: 'connecting',
          qrcode: 'AAAA',
        }),
      }
    }

    if (asString.includes('/instance/connectionState/')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          status: 'open',
          instance: { number: '+5511988887777' },
        }),
      }
    }

    if (asString.includes('/instance/logout/')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'close' }),
      }
    }

    return {
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ message: 'not found' }),
    }
  }

  try {
    const saveResponse = await fetch(`${runtime.baseUrl}/settings/whatsapp`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        gatewayBaseUrl: 'https://gateway.example.com',
        gatewayToken: 'token-123',
        provider: 'EVOLUTION',
        instanceName: 'assist-tech-main',
      }),
    })
    assert.equal(saveResponse.status, 200)

    const createResponse = await fetch(`${runtime.baseUrl}/settings/whatsapp/instance/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    assert.equal(createResponse.status, 200)
    const createBody = await createResponse.json()
    assert.equal(createBody.ok, true)
    assert.equal(createBody.status, 'CONNECTED')

    const connectResponse = await fetch(`${runtime.baseUrl}/settings/whatsapp/instance/connect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    assert.equal(connectResponse.status, 200)
    const connectBody = await connectResponse.json()
    assert.equal(connectBody.ok, true)
    assert.equal(connectBody.status, 'WAITING_QR')
    assert.match(connectBody.qrCodeBase64, /^data:image\/png;base64,AAAA$/)

    const statusResponse = await fetch(`${runtime.baseUrl}/settings/whatsapp/instance/status`)
    assert.equal(statusResponse.status, 200)
    const statusBody = await statusResponse.json()
    assert.equal(statusBody.ok, true)
    assert.equal(statusBody.status, 'CONNECTED')
    assert.equal(statusBody.phoneNumber, '+5511988887777')

    const disconnectResponse = await fetch(`${runtime.baseUrl}/settings/whatsapp/instance/disconnect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    assert.equal(disconnectResponse.status, 200)
    const disconnectBody = await disconnectResponse.json()
    assert.equal(disconnectBody.ok, true)
    assert.equal(disconnectBody.status, 'DISCONNECTED')
    assert.equal(disconnectBody.qrCodeBase64, null)
  } finally {
    global.fetch = originalFetch
    await runtime.close()
  }
})

test('instance lifecycle works even when connection model is unavailable', async () => {
  const runtime = await setupServer({ withConnectionModel: false })
  const originalFetch = global.fetch

  global.fetch = async (url, requestInit) => {
    const asString = String(url)
    if (asString.startsWith(runtime.baseUrl)) {
      return originalFetch(url, requestInit)
    }

    if (asString.endsWith('/instance/create')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'open' }),
      }
    }

    if (asString.includes('/instance/connect/')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'connecting', response: { base64: 'AAAA' } }),
      }
    }

    if (asString.includes('/instance/connectionState/')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'open', instance: { number: '+5511988887777' } }),
      }
    }

    if (asString.includes('/instance/logout/')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'close' }),
      }
    }

    return {
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ message: 'not found' }),
    }
  }

  try {
    const saveResponse = await fetch(`${runtime.baseUrl}/settings/whatsapp`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        gatewayBaseUrl: 'https://gateway.example.com',
        gatewayToken: 'token-123',
        provider: 'EVOLUTION',
        instanceName: 'assist-tech-main',
      }),
    })
    assert.equal(saveResponse.status, 200)

    const createResponse = await fetch(`${runtime.baseUrl}/settings/whatsapp/instance/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    assert.equal(createResponse.status, 200)

    const connectResponse = await fetch(`${runtime.baseUrl}/settings/whatsapp/instance/connect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    assert.equal(connectResponse.status, 200)
    const connectBody = await connectResponse.json()
    assert.equal(connectBody.ok, true)
    assert.equal(connectBody.status, 'WAITING_QR')

    const statusResponse = await fetch(`${runtime.baseUrl}/settings/whatsapp/instance/status`)
    assert.equal(statusResponse.status, 200)
    const statusBody = await statusResponse.json()
    assert.equal(statusBody.ok, true)
    assert.equal(statusBody.status, 'CONNECTED')

    const disconnectResponse = await fetch(`${runtime.baseUrl}/settings/whatsapp/instance/disconnect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    assert.equal(disconnectResponse.status, 200)
  } finally {
    global.fetch = originalFetch
    await runtime.close()
  }
})
