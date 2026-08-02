import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRecentConversationsEndpoint } from '../src/frontend/httpClient.ts'
import { formatInboxPhone, truncateInboxText } from '../src/frontend/pages/ConversationsInboxPage.tsx'

test('buildRecentConversationsEndpoint monta query de telefone quando filtro existe', () => {
  assert.equal(
    buildRecentConversationsEndpoint({ phone: '+55 (11) 99999-0000' }),
    '/communications/conversations/recent?phone=%2B55+%2811%29+99999-0000'
  )
})

test('buildRecentConversationsEndpoint sem filtro retorna endpoint base', () => {
  assert.equal(buildRecentConversationsEndpoint(), '/communications/conversations/recent')
})

test('formatInboxPhone formata numero brasileiro quando possivel', () => {
  assert.equal(formatInboxPhone('+5511999990000'), '+55 (11) 99999-0000')
  assert.equal(formatInboxPhone('5511988887777'), '+55 (11) 98888-7777')
})

test('truncateInboxText mantém mensagem curta e recorta mensagem longa', () => {
  assert.equal(truncateInboxText('Mensagem curta', 40), 'Mensagem curta')
  assert.equal(truncateInboxText('A'.repeat(100), 20), `${'A'.repeat(19)}...`)
  assert.equal(truncateInboxText('', 20), 'Sem mensagem')
})
