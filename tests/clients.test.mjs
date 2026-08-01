import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClientValidationErrors, normalizeClientPayload } from '../src/server/clientValidation.ts'

test('PF with valid CPF should pass validation', () => {
  const payload = normalizeClientPayload({
    name: 'Maria Silva',
    type: 'PF',
    document: '529.982.247-25',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01000-000',
  })

  const errors = createClientValidationErrors(payload)
  assert.deepEqual(errors, [])
})

test('PJ with valid CNPJ should pass validation', () => {
  const payload = normalizeClientPayload({
    name: 'Empresa Teste',
    type: 'PJ',
    document: '11.222.333/0001-81',
    city: 'Rio de Janeiro',
    state: 'RJ',
    zipCode: '20000-000',
  })

  const errors = createClientValidationErrors(payload)
  assert.deepEqual(errors, [])
})

test('PF with CNPJ should fail with specific message', () => {
  const payload = normalizeClientPayload({
    name: 'Cliente',
    type: 'PF',
    document: '11222333000181',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01000-000',
  })

  const errors = createClientValidationErrors(payload)
  assert.match(errors[0]?.message ?? '', /Tipo PF exige CPF/)
})

test('duplicate document should produce duplicate error', () => {
  const payload = normalizeClientPayload({
    name: 'Cliente',
    type: 'PF',
    document: '52998224725',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01000-000',
  })

  const errors = createClientValidationErrors(payload, { document: '52998224725' })
  assert.ok(errors.some((error) => error.code === 'DUPLICATE_DOCUMENT'))
})
