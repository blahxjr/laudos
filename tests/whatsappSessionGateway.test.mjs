import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createWhatsAppSessionGateway,
  normalizeEvolutionConnectResponse,
  parseHttpResponseSafely,
} from '../src/server/whatsappSessionGateway.ts'

const gatewayConfig = {
  provider: 'EVOLUTION',
  gatewayBaseUrl: 'http://localhost:8080',
  gatewayToken: 'token-123',
  instanceName: 'assist-tech-main',
}

test('parseHttpResponseSafely keeps non-json responses as text without throwing', async () => {
  const response = new Response('<!DOCTYPE html><html><body>bad gateway</body></html>', {
    status: 502,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })

  const parsed = await parseHttpResponseSafely(response)
  assert.equal(parsed.ok, false)
  assert.equal(parsed.status, 502)
  assert.equal(parsed.jsonBody, null)
  assert.match(parsed.textBody, /DOCTYPE html/i)
})

test('normalizeEvolutionConnectResponse maps base64 payload to WAITING_QR', () => {
  const normalized = normalizeEvolutionConnectResponse({ response: { base64: 'AAAA' } })

  assert.equal(normalized.status, 'WAITING_QR')
  assert.equal(normalized.qrCodeBase64, 'data:image/png;base64,AAAA')
  assert.equal(normalized.pairingCode, null)
})

test('normalizeEvolutionConnectResponse maps code-only payload to WAITING_QR without image', () => {
  const normalized = normalizeEvolutionConnectResponse({ response: { code: '123-456' } })

  assert.equal(normalized.status, 'WAITING_QR')
  assert.equal(normalized.qrCodeBase64, null)
  assert.equal(normalized.rawCode, '123-456')
})

test('createInstance handles already in use as reusable success path', async () => {
  const originalFetch = global.fetch

  global.fetch = async () => {
    return new Response(JSON.stringify({ message: 'This name "assist-tech-main" is already in use.' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const gateway = createWhatsAppSessionGateway(gatewayConfig)
    const result = await gateway.createInstance()

    assert.equal(result.errorCode, null)
    assert.equal(result.errorMessage, 'Instância já existente. Reutilizando conexão.')
  } finally {
    global.fetch = originalFetch
  }
})

test('connectInstance exposes pairingCode when gateway returns no QR image', async () => {
  const originalFetch = global.fetch

  global.fetch = async () => {
    return new Response(JSON.stringify({ pairingCode: 'ABCDEF' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const gateway = createWhatsAppSessionGateway(gatewayConfig)
    const result = await gateway.connectInstance()

    assert.equal(result.status, 'WAITING_QR')
    assert.equal(result.qrCodeBase64, null)
    assert.equal(result.pairingCode, 'ABCDEF')
  } finally {
    global.fetch = originalFetch
  }
})
