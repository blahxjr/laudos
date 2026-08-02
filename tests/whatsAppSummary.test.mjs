import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWhatsAppFullSummary, buildWhatsAppShortSummary } from '../src/frontend/whatsAppSummary.ts'

test('builds a full WhatsApp summary with client, OS, diagnosis, conclusion and invoice total', () => {
  const summary = buildWhatsAppFullSummary(
    {
      assistencia: { companyName: 'Assistência Tech' },
      cliente: { name: 'Maria Oliveira' },
      equipamento: { type: 'Notebook', brand: 'Dell', model: 'Latitude 5420' },
      diagnostico: {
        probableCause: 'Falha no adaptador de energia',
        technicalConclusion: 'Substituído o adaptador e validado o equipamento.',
      },
      financeiro: { totalValue: 250 },
      meta: { id: 'report-123', protocol: 'OS-2026-000001' },
      atendimentoType: 'CAMPO_REDE',
    },
    { protocol: 'OS-2026-000001' },
    { total: 250 },
    'http://localhost:5173'
  )

  assert.match(summary, /Olá Maria Oliveira/)
  assert.match(summary, /OS: OS-2026-000001/)
  assert.match(summary, /Atendimento em campo: foco em rede e infraestrutura./)
  assert.match(summary, /Equipamento: Notebook Dell Latitude 5420/)
  assert.match(summary, /Diagnóstico: Falha no adaptador de energia/)
  assert.match(summary, /Conclusão: Substituído o adaptador e validado o equipamento./)
  assert.match(summary, /Valor total: R\$\s*250,00/)
  assert.match(summary, /http:\/\/localhost:5173\/reports\/report-123\/document/)
})

test('builds a short WhatsApp summary with concise wording for CCTV field attendance', () => {
  const summary = buildWhatsAppShortSummary(
    {
      assistencia: { companyName: 'Assistência Tech' },
      cliente: { name: 'Carlos Mendes' },
      equipamento: { type: 'Câmera', brand: 'Hikvision', model: 'DS-2CD2T47G2-L' },
      diagnostico: {
        probableCause: 'Falha no fluxo de vídeo',
        technicalConclusion: 'Reconfigurado o canal e resetado o equipamento.',
      },
      financeiro: { totalValue: 180 },
      meta: { id: 'report-456', protocol: 'OS-2026-000002' },
      atendimentoType: 'CAMPO_CCTV',
    },
    { protocol: 'OS-2026-000002' },
    { total: 180 },
    'http://localhost:5173'
  )

  assert.match(summary, /Olá, Carlos Mendes/)
  assert.match(summary, /Achados: Falha no fluxo de vídeo./)
  assert.match(summary, /Status final: Reconfigurado o canal e resetado o equipamento./)
  assert.match(summary, /Valor: R\$\s*180,00/)
  assert.match(summary, /Laudo completo: http:\/\/localhost:5173\/reports\/report-456\/document/)
  assert.ok(summary.split('\n').length <= 5)
})
