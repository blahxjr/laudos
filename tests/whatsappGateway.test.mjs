import assert from 'node:assert/strict'
import test from 'node:test'
import { sendWhatsAppTextMessage } from '../src/whatsappGateway.ts'

test('sendWhatsAppTextMessage reports a gateway failure without throwing', async () => {
  const originalFetch = global.fetch
  const originalBaseUrl = process.env.WHATSAPP_GATEWAY_BASE_URL
  const originalToken = process.env.WHATSAPP_GATEWAY_TOKEN
  process.env.WHATSAPP_GATEWAY_BASE_URL = 'http://localhost:8080'
  process.env.WHATSAPP_GATEWAY_TOKEN = 'test-token'
  global.fetch = async () => ({
    ok: false,
    status: 502,
    text: async () => 'gateway down',
  })

  try {
    const result = await sendWhatsAppTextMessage({ phone: '5511999999999', text: 'Olá' })
    assert.equal(result.ok, false)
    assert.match(result.error, /gateway down|falhou/i)
  } finally {
    global.fetch = originalFetch
    if (originalBaseUrl === undefined) {
      delete process.env.WHATSAPP_GATEWAY_BASE_URL
    } else {
      process.env.WHATSAPP_GATEWAY_BASE_URL = originalBaseUrl
    }

    if (originalToken === undefined) {
      delete process.env.WHATSAPP_GATEWAY_TOKEN
    } else {
      process.env.WHATSAPP_GATEWAY_TOKEN = originalToken
    }
  }
})
