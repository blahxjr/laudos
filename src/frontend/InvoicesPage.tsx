import React, { useEffect, useState } from 'react'

type Invoice = {
  id: string
  subtotal: number
  discountAmount: number
  total: number
  status: string
  issuedAt: string
  paidAt?: string | null
  serviceOrder?: { protocol?: string }
  client?: { name?: string }
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const parseDecimalNumber = (value: number | string | null | undefined) => {
    if (value === null || value === undefined || value === '') return 0
    if (typeof value === 'number') return value
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  const normalizeInvoice = (invoice: any): Invoice => ({
    ...invoice,
    subtotal: parseDecimalNumber(invoice.subtotal),
    discountAmount: parseDecimalNumber(invoice.discountAmount),
    total: parseDecimalNumber(invoice.total),
    issuedAt: invoice.issuedAt,
    paidAt: invoice.paidAt,
  })

  const loadInvoices = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/invoices')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const rawInvoices: any[] = Array.isArray(data) ? data : data.data || []
      setInvoices(rawInvoices.map(normalizeInvoice))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar invoices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [])

  const setStatus = async (invoice: Invoice, status: string) => {
    try {
      const res = await fetch(`/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(await res.text())
      await loadInvoices()
      setSelectedInvoice(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar invoice')
    }
  }

  return (
    <div className="sheet">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Cobranças</p>
          <h2>Gestão de invoices</h2>
          <p>Visualize e atualize faturas geradas a partir de ordens de serviço.</p>
        </div>
      </div>

      <div className="report-content">
        {error && <p className="feedback-error">Erro: {error}</p>}
        {loading ? (
          <p>Carregando invoices...</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>OS</th>
                  <th>Status</th>
                  <th>Subtotal</th>
                  <th>Desconto</th>
                  <th>Total</th>
                  <th>Emitida</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.client?.name || '—'}</td>
                    <td>{invoice.serviceOrder?.protocol || '—'}</td>
                    <td>{invoice.status}</td>
                    <td>R$ {invoice.subtotal.toFixed(2)}</td>
                    <td>R$ {invoice.discountAmount.toFixed(2)}</td>
                    <td>R$ {invoice.total.toFixed(2)}</td>
                    <td>{new Date(invoice.issuedAt).toLocaleDateString()}</td>
                    <td>
                      <button className="table-action" type="button" onClick={() => setSelectedInvoice(invoice)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedInvoice && (
          <div className="sheet" style={{ marginTop: 24, padding: 24 }}>
            <div className="section-heading">
              <h3>Detalhes da cobrança</h3>
              <div>
                <button type="button" className="table-action" onClick={() => setSelectedInvoice(null)}>Fechar</button>
              </div>
            </div>
            <p><strong>Cliente:</strong> {selectedInvoice.client?.name || '—'}</p>
            <p><strong>OS:</strong> {selectedInvoice.serviceOrder?.protocol || '—'}</p>
            <p><strong>Status:</strong> {selectedInvoice.status}</p>
            <p><strong>Subtotal:</strong> R$ {selectedInvoice.subtotal.toFixed(2)}</p>
            <p><strong>Desconto:</strong> R$ {selectedInvoice.discountAmount.toFixed(2)}</p>
            <p><strong>Total:</strong> R$ {selectedInvoice.total.toFixed(2)}</p>
            <p><strong>Emitida em:</strong> {new Date(selectedInvoice.issuedAt).toLocaleString()}</p>
            <p><strong>Paga em:</strong> {selectedInvoice.paidAt ? new Date(selectedInvoice.paidAt).toLocaleString() : '—'}</p>
            <div className="form-actions" style={{ marginTop: 16 }}>
              {selectedInvoice.status !== 'PAGO' && (
                <button className="button-primary" type="button" onClick={() => setStatus(selectedInvoice, 'PAGO')}>Marcar como PAGO</button>
              )}
              {selectedInvoice.status !== 'CANCELADA' && (
                <button type="button" className="table-action" onClick={() => setStatus(selectedInvoice, 'CANCELADA')}>Cancelar</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
