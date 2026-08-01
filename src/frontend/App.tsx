import React, { useEffect, useState } from 'react'
import TechnicalReportTabs from './TechnicalReportTabs'

type ServiceOrderItem = {
  id: string
  protocol?: string
  status?: string
  client?: { name?: string }
  equipment?: { type?: string; model?: string }
  firstReportId?: string
}

export default function App() {
  const [orders, setOrders] = useState<ServiceOrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/service-orders')
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then((data) => {
        // server returns { data, meta } or array directly; normalize
        const list: ServiceOrderItem[] = Array.isArray(data) ? data : data.data || []
        setOrders(list)
      })
      .catch((err) => setError(err.message || 'Erro ao carregar ordens'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedOrderId) return

    const order = orders.find((o) => o.id === selectedOrderId)
    if (order?.firstReportId) {
      setSelectedReportId(order.firstReportId)
      return
    }

    // fetch first report for this serviceOrder
    setSelectedReportId(null)
    fetch(`/reports?serviceOrderId=${encodeURIComponent(selectedOrderId)}&page=1&pageSize=1`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then((data) => {
        const list = data.data || []
        if (list.length) setSelectedReportId(list[0].id)
        else setSelectedReportId(null)
      })
      .catch(() => setSelectedReportId(null))
  }, [selectedOrderId, orders])

  const statusClassName = (status?: string) => {
    const normalized = (status || '').toUpperCase()
    if (normalized.includes('CONCL')) return 'status-pill status-done'
    if (normalized.includes('ABER') || normalized.includes('EM_DIAGN')) return 'status-pill status-open'
    if (normalized.includes('AGUARD') || normalized.includes('PEND')) return 'status-pill status-pending'
    return 'status-pill'
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-card">
          <p className="eyebrow">Assistência</p>
          <h2 style={{ marginBottom: 8 }}>Ordens de Serviço</h2>
          <p>Selecione uma ordem para abrir o laudo técnico associado.</p>

          {loading && <p>Carregando ordens...</p>}
          {error && <p className="feedback-error">Erro: {error}</p>}

          {!loading && !error && (
            <ul className="service-order-list">
              {orders.map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => setSelectedOrderId(o.id)}
                    className={`service-order-card ${selectedOrderId === o.id ? 'selected' : ''}`}
                  >
                    <div className="order-meta">
                      <span className="order-title">{o.protocol ?? o.id}</span>
                      <span className={statusClassName(o.status)}>{o.status ?? 'SEM STATUS'}</span>
                    </div>
                    <div className="order-subtitle">{o.client?.name ?? '-'}</div>
                    <div className="order-subtitle">{o.equipment ? `${o.equipment.type ?? ''} ${o.equipment.model ?? ''}`.trim() : '-'}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className="app-main">
        {selectedOrderId ? (
          selectedReportId ? (
            <TechnicalReportTabs reportId={selectedReportId} />
          ) : (
            <div className="sheet" style={{ padding: 24 }}>
              <p>Carregando laudo para a OS selecionada...</p>
            </div>
          )
        ) : (
          <div className="sheet" style={{ padding: 24 }}>
            <p>Selecione uma OS para visualizar o laudo.</p>
          </div>
        )}
      </main>
    </div>
  )
}
