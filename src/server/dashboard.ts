export type DashboardOverview = {
  osByStatus: {
    ABERTA: number
    EM_ATENDIMENTO: number
    AGUARDANDO_PECA: number
    CONCLUIDA: number
    CANCELADA: number
  }
  totalLaudos: number
  totalFaturamento: number
  periodLaudos?: { last30Days: number }
  periodFaturamento?: { last30Days: number }
}

export function buildDashboardOverview(input: {
  osByStatus: Record<string, number>
  totalLaudos: number
  totalFaturamento: number
  last30DaysLaudos?: number
  last30DaysFaturamento?: number
}): DashboardOverview {
  const mappedStatuses = {
    ABERTA: Number(input.osByStatus.ABERTA ?? 0),
    EM_ATENDIMENTO: Number(input.osByStatus.EM_DIAGNOSTICO ?? 0),
    AGUARDANDO_PECA: Number(input.osByStatus.AGUARDANDO_CLIENTE ?? 0),
    CONCLUIDA: Number(input.osByStatus.CONCLUIDA ?? 0),
    CANCELADA: Number(input.osByStatus.SEM_CONSERTO ?? 0),
  }

  return {
    osByStatus: mappedStatuses,
    totalLaudos: Number(input.totalLaudos ?? 0),
    totalFaturamento: Number(input.totalFaturamento ?? 0),
    ...(typeof input.last30DaysLaudos === 'number' ? { periodLaudos: { last30Days: input.last30DaysLaudos } } : {}),
    ...(typeof input.last30DaysFaturamento === 'number' ? { periodFaturamento: { last30Days: input.last30DaysFaturamento } } : {}),
  }
}
