import React, { useEffect, useMemo, useState } from 'react'

type DashboardOverview = {
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

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/dashboard/overview')
        if (!response.ok) throw new Error(await response.text())
        const data = await response.json()
        if (isMounted) setOverview(data)
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : 'Erro ao carregar o dashboard')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => { isMounted = false }
  }, [])

  const statusCards = useMemo(() => {
    if (!overview) return []

    return [
      { label: 'Abertas', value: overview.osByStatus.ABERTA, tone: 'open' },
      { label: 'Em atendimento', value: overview.osByStatus.EM_ATENDIMENTO, tone: 'pending' },
      { label: 'Aguardando peça', value: overview.osByStatus.AGUARDANDO_PECA, tone: 'pending' },
      { label: 'Concluídas', value: overview.osByStatus.CONCLUIDA, tone: 'done' },
      { label: 'Canceladas', value: overview.osByStatus.CANCELADA, tone: 'no-repair' },
    ]
  }, [overview])

  return (
    <div className="sheet" style={{ padding: 24 }}>
      <div className="section-heading" style={{ marginBottom: 24 }}>
        <div>
          <p className="eyebrow">Resumo operacional</p>
          <h3 style={{ marginBottom: 4 }}>Visão rápida da assistência</h3>
        </div>
      </div>

      {loading ? (
        <p>Carregando indicadores...</p>
      ) : error ? (
        <p className="feedback-error">Erro: {error}</p>
      ) : overview ? (
        <>
          <div className="grid-3" style={{ marginBottom: 24 }}>
            {statusCards.map((card) => (
              <div key={card.label} className="section-block" style={{ padding: 20 }}>
                <p style={{ marginBottom: 8, color: '#516174' }}>{card.label}</p>
                <h2 style={{ marginBottom: 0 }}>{card.value}</h2>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ marginBottom: 24 }}>
            <div className="section-block" style={{ padding: 20 }}>
              <p className="eyebrow">Laudos</p>
              <h2 style={{ marginBottom: 8 }}>{overview.totalLaudos}</h2>
              <p>Emitidos no total</p>
              {overview.periodLaudos ? <p className="feedback-success">Últimos 30 dias: {overview.periodLaudos.last30Days}</p> : null}
            </div>
            <div className="section-block" style={{ padding: 20 }}>
              <p className="eyebrow">Faturamento</p>
              <h2 style={{ marginBottom: 8 }}>{currencyFormatter.format(overview.totalFaturamento)}</h2>
              <p>Somatório de invoices registradas</p>
              {overview.periodFaturamento ? <p className="feedback-success">Últimos 30 dias: {currencyFormatter.format(overview.periodFaturamento.last30Days)}</p> : null}
            </div>
          </div>

          <div className="section-block" style={{ padding: 20 }}>
            <div className="section-heading">
              <h4>Distribuição por status</h4>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {statusCards.map((card) => (
                <div key={`${card.label}-list`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #edf1f6' }}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
