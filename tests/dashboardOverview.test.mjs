import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDashboardOverview } from '../src/server/dashboard.ts'

test('builds a dashboard summary with status mapping and period totals', () => {
  const overview = buildDashboardOverview({
    osByStatus: {
      ABERTA: 4,
      EM_DIAGNOSTICO: 2,
      AGUARDANDO_CLIENTE: 1,
      CONCLUIDA: 5,
      SEM_CONSERTO: 3,
    },
    totalLaudos: 7,
    totalFaturamento: 1250.5,
    last30DaysLaudos: 2,
    last30DaysFaturamento: 400,
  })

  assert.deepEqual(overview.osByStatus, {
    ABERTA: 4,
    EM_ATENDIMENTO: 2,
    AGUARDANDO_PECA: 1,
    CONCLUIDA: 5,
    CANCELADA: 3,
  })
  assert.equal(overview.totalLaudos, 7)
  assert.equal(overview.totalFaturamento, 1250.5)
  assert.deepEqual(overview.periodLaudos, { last30Days: 2 })
  assert.deepEqual(overview.periodFaturamento, { last30Days: 400 })
})
