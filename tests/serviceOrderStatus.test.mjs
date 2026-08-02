import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SERVICE_ORDER_STATUS_OPTIONS, validateServiceOrderStatus } from '../src/server/serviceOrderStatus.ts'

test('accepts known service order statuses', () => {
  const result = validateServiceOrderStatus('AGUARDANDO_CLIENTE')
  assert.equal(result.valid, true)
  assert.equal(result.error, null)
})

test('rejects unknown service order statuses', () => {
  const result = validateServiceOrderStatus('EM_ANDAMENTO')
  assert.equal(result.valid, false)
  assert.match(result.error ?? '', /status/i)
})

test('exposes human-friendly labels for the status options', () => {
  const opened = SERVICE_ORDER_STATUS_OPTIONS.find((option) => option.value === 'ABERTA')
  assert.ok(opened)
  assert.equal(opened?.label, 'Aberta')
})
