import React, { useEffect, useState } from 'react'

type ReportDocumentView = {
  assistencia: {
    companyName?: string
    companyDocument?: string
    companyContact?: string
    companyAddress?: string
    companyEmail?: string
    companySite?: string
    technicianName?: string
    technicianRegistry?: string
    cityDate?: string | null
  }
  cliente?: { [key: string]: any } | null
  equipamento?: { [key: string]: any } | null
  ordemServico?: {
    id?: string
    protocol?: string | null
    status?: string | null
    priority?: string | null
    notes?: string | null
    createdAt?: string | null
    updatedAt?: string | null
    closedAt?: string | null
    items?: Array<{
      id: string
      type: string
      description: string
      quantity: number
      unitPrice: number
      totalPrice: number
      serviceCatalogName?: string | null
      partCatalogName?: string | null
    }>
    invoices?: Array<{ id: string; subtotal: number; discountAmount: number; total: number; status: string; issuedAt: string; paidAt?: string | null }>
    latestInvoice?: { id: string; subtotal: number; discountAmount: number; total: number; status: string; issuedAt: string; paidAt?: string | null } | null
  }
  diagnostico: {
    clientReport?: string
    testsExecuted?: string
    powerStageStatus?: string
    usageTimeEstimate?: string
    probableCause?: string
    technicalConclusion?: string
    noRepair?: boolean
    noRepairReason?: string | null
  }
  financeiro: {
    partsValue: number
    laborValue: number
    totalValue: number
  }
  componentes: Array<{ id?: string; description?: string | null; quantity?: number | null; unitPrice?: number | null; price?: number | null }>
  fotos: Array<{ id?: string; storagePath?: string | null; caption?: string | null }>
  meta: {
    id: string
    serviceOrderId?: string
    protocol?: string | null
    status?: string | null
  }
}

const formatCurrency = (value: number | string | undefined | null) => {
  const numeric = Number(value ?? 0)
  return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('pt-BR')
}

export default function TechnicalReportDocument({ reportId }: { reportId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ReportDocumentView | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    setError(null)
    setReport(null)

    fetch(`/reports/${encodeURIComponent(reportId)}/view`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then((data) => setReport(data))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Erro ao carregar documento do laudo')
      })
      .finally(() => setLoading(false))

    return () => ac.abort()
  }, [reportId])

  const handlePrint = () => {
    window.print()
  }

  if (loading) return <div className="sheet"><p>Carregando documento do laudo...</p></div>
  if (error) return <div className="sheet"><p className="feedback-error">Erro: {error}</p></div>
  if (!report) return <div className="sheet"><p>Laudo não encontrado.</p></div>

  const { assistencia, cliente, equipamento, ordemServico, diagnostico, financeiro, componentes, fotos, meta } = report
  const invoice = ordemServico?.latestInvoice

  return (
    <article className="document-shell">
      <div className="document-toolbar no-print">
        <button type="button" className="button-primary" onClick={handlePrint}>Imprimir laudo</button>
        <button
          type="button"
          className="table-action"
          onClick={() => {
            window.history.pushState({}, '', '/service-orders')
            window.dispatchEvent(new PopStateEvent('popstate'))
          }}
        >
          Voltar à OS
        </button>
      </div>

      <section className="document-header">
        <div>
          <p className="eyebrow">Laudo Técnico</p>
          <h1>{assistencia.companyName || 'Assistência Técnica'}</h1>
          <p>{assistencia.companyAddress || ''}</p>
          <p>{assistencia.companyContact || ''}</p>
          <p>{assistencia.companyEmail || ''}</p>
          <p>{assistencia.companySite || ''}</p>
        </div>
        <div className="document-meta">
          <p><strong>Protocolo:</strong> {meta.protocol || meta.id}</p>
          <p><strong>Status:</strong> {meta.status || '—'}</p>
          <p><strong>Data:</strong> {formatDate(assistencia.cityDate ?? undefined)}</p>
          <p><strong>Técnico:</strong> {assistencia.technicianName || '—'}</p>
          <p><strong>Registro:</strong> {assistencia.technicianRegistry || '—'}</p>
        </div>
      </section>

      <section className="document-section">
        <h2>1. Identificação</h2>
        <div className="grid-2">
          <div>
            <h3>Cliente</h3>
            <p><strong>Nome:</strong> {cliente?.name || '—'}</p>
            <p><strong>CPF/CNPJ:</strong> {cliente?.document || '—'}</p>
            <p><strong>Contato:</strong> {cliente?.primaryPhone || cliente?.whatsappNumber || '—'}</p>
            <p><strong>Endereço:</strong> {cliente?.street || '—'}, {cliente?.number || '—'} {cliente?.complement || ''}</p>
            <p>{cliente?.neighborhood || ''} {cliente?.city || ''} {cliente?.state || ''} {cliente?.zipCode || ''}</p>
          </div>
          <div>
            <h3>Equipamento</h3>
            <p><strong>Tipo:</strong> {equipamento?.type || '—'}</p>
            <p><strong>Marca/Modelo:</strong> {equipamento?.brand || '—'} / {equipamento?.model || '—'}</p>
            <p><strong>Série:</strong> {equipamento?.serialNumber || '—'}</p>
            <p><strong>Estado físico:</strong> {equipamento?.physicalState || '—'}</p>
            <p><strong>Acessórios:</strong> {equipamento?.accessories || '—'}</p>
            <p><strong>Garantia:</strong> {equipamento?.warranty || '—'}</p>
          </div>
        </div>
      </section>

      <section className="document-section">
        <h2>2. Dados da Ordem de Serviço</h2>
        <div className="grid-2">
          <div>
            <p><strong>Protocolo:</strong> {ordemServico?.protocol || '—'}</p>
            <p><strong>Status:</strong> {ordemServico?.status || '—'}</p>
            <p><strong>Prioridade:</strong> {ordemServico?.priority || '—'}</p>
          </div>
          <div>
            <p><strong>Abertura:</strong> {formatDate(ordemServico?.createdAt)}</p>
            <p><strong>Atualização:</strong> {formatDate(ordemServico?.updatedAt)}</p>
            <p><strong>Fechamento:</strong> {formatDate(ordemServico?.closedAt)}</p>
          </div>
        </div>
        {ordemServico?.notes ? (
          <div style={{ marginTop: 12 }}>
            <h3>Observações da OS</h3>
            <p>{ordemServico.notes}</p>
          </div>
        ) : null}
      </section>

      <section className="document-section">
        <h2>3. Relato do defeito e testes</h2>
        <div className="section-block soft">
          <h3>Relato do cliente</h3>
          <p>{diagnostico.clientReport || 'Não informado'}</p>
        </div>
        <div className="section-block soft">
          <h3>Testes executados</h3>
          <p>{diagnostico.testsExecuted || 'Não informado'}</p>
        </div>
        <div className="section-block soft">
          <h3>Estado da fonte / Uso estimado</h3>
          <p>{diagnostico.powerStageStatus || 'Não informado'}</p>
          <p>{diagnostico.usageTimeEstimate ? `Tempo de uso estimado: ${diagnostico.usageTimeEstimate}` : ''}</p>
        </div>
      </section>

      <section className="document-section">
        <h2>4. Diagnóstico técnico</h2>
        <div className="section-block soft">
          <h3>Causa provável</h3>
          <p>{diagnostico.probableCause || 'Não informado'}</p>
        </div>
        <div className="section-block soft">
          <h3>Parecer conclusivo</h3>
          <p>{diagnostico.technicalConclusion || 'Não informado'}</p>
        </div>
        {diagnostico.noRepair ? (
          <div className="section-block soft">
            <p><strong>Sem reparo:</strong> {diagnostico.noRepairReason || 'Motivo não especificado'}</p>
          </div>
        ) : null}
      </section>

      <section className="document-section">
        <h2>5. Peças e serviços aplicados</h2>
        {ordemServico?.items && ordemServico.items.length ? (
          <div className="table-scroll">
            <table className="data-table document-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Quantidade</th>
                  <th>Valor unitário</th>
                  <th>Valor total</th>
                </tr>
              </thead>
              <tbody>
                {ordemServico.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.type === 'SERVICO' ? 'Serviço' : 'Peça'}</td>
                    <td>{item.description || item.serviceCatalogName || item.partCatalogName || '—'}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td>{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Sem itens de OS registrados.</p>
        )}
      </section>

      <section className="document-section">
        <h2>6. Resumo financeiro</h2>
        <div className="grid-2">
          <div>
            <p><strong>Peças:</strong> {formatCurrency(financeiro.partsValue)}</p>
            <p><strong>Mão de obra:</strong> {formatCurrency(financeiro.laborValue)}</p>
            <p><strong>Total do laudo:</strong> {formatCurrency(financeiro.totalValue)}</p>
          </div>
          <div>
            <p><strong>Fatura principal:</strong> {invoice ? invoice.id : '—'}</p>
            <p><strong>Status da fatura:</strong> {invoice?.status ?? '—'}</p>
            <p><strong>Emitida em:</strong> {formatDate(invoice?.issuedAt)}</p>
            <p><strong>Paga em:</strong> {formatDate(invoice?.paidAt)}</p>
          </div>
        </div>
      </section>

      <section className="document-section">
        <h2>7. Fotos</h2>
        {fotos && fotos.length ? (
          <div className="document-photos">
            {fotos.map((photo, index) => (
              <figure key={photo.id ?? index} className="document-photo-card">
                {photo.storagePath ? (
                  <img src={photo.storagePath} alt={photo.caption || `Foto ${index + 1}`} />
                ) : (
                  <div className="photo-placeholder">Sem imagem</div>
                )}
                <figcaption>{photo.caption || ''}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p>Sem fotos registradas.</p>
        )}
      </section>

      <footer className="document-footer">
        <div>
          <p><strong>Responsável técnico:</strong> {assistencia.technicianName || '—'}</p>
          <p><strong>Registro:</strong> {assistencia.technicianRegistry || '—'}</p>
        </div>
        <div>
          <p>Documento gerado para registro técnico do serviço.</p>
          <p className="print-note">Este laudo técnico é válido como documento de análise e parecer do serviço prestado.</p>
        </div>
      </footer>
    </article>
  )
}
