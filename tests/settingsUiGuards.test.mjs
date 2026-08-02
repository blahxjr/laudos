import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHttpResponseSafely } from '../src/frontend/httpResponse.ts'
import { isSessionReadyForTestMessage, shouldShowQrCode } from '../src/frontend/whatsappConnectionUi.tsx'

test('frontend parser returns friendly unexpected-format payload for html responses', async () => {
  const response = new Response('<!DOCTYPE html><html><body>proxy error</body></html>', {
    status: 502,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })

  const parsed = await parseHttpResponseSafely(response)

  assert.equal(parsed.ok, false)
  assert.equal(parsed.message, 'Gateway respondeu em formato inesperado')
  assert.equal(parsed.technicalDetails?.statusCode, 502)
  assert.match(parsed.technicalDetails?.preview || '', /DOCTYPE html/i)
})

test('UI keeps test message blocked while session is not connected', () => {
  assert.equal(isSessionReadyForTestMessage('DISCONNECTED'), false)
  assert.equal(isSessionReadyForTestMessage('WAITING_QR'), false)
  assert.equal(isSessionReadyForTestMessage('CONNECTING'), false)
  assert.equal(isSessionReadyForTestMessage('CONNECTED'), true)
})

test('UI renders QR image only when WAITING_QR has base64 content', () => {
  assert.equal(shouldShowQrCode('WAITING_QR', 'data:image/png;base64,AAAA'), true)
  assert.equal(shouldShowQrCode('WAITING_QR', null), false)
  assert.equal(shouldShowQrCode('CONNECTING', 'data:image/png;base64,AAAA'), false)
})
