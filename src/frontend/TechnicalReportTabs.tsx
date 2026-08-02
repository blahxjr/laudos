import React, { useEffect, useState } from 'react'
import { buildWhatsAppFullSummary, buildWhatsAppShortSummary } from './whatsAppSummary.js'

type Assistencia = {
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

type Cliente = Record<string, any> | null
type Equipamento = Record<string, any> | null

type Diagnostico = {
  clientReport?: string
  testsExecuted?: string
  powerStageStatus?: string
  usageTimeEstimate?: string
  probableCause?: string
  technicalConclusion?: string
  noRepair?: boolean
  noRepairReason?: string
}

type Financeiro = {
  partsValue?: number
  laborValue?: number
  totalValue?: number
}

type ComponentItem = Record<string, any>
type PhotoItem = { storagePath?: string; caption?: string; [k: string]: any }

type Meta = {
  id: string
  serviceOrderId?: string
  protocol?: string | null
  status?: string | null
}

type ReportView = {
  assistencia: Assistencia
  cliente: Cliente
  equipamento: Equipamento
  diagnostico: Diagnostico
  financeiro: Financeiro
  componentes: ComponentItem[]
  fotos: PhotoItem[]
  meta: Meta
}

type DiagnosticContext = {
  relatoCliente: string | undefined
  testesExecutados: string | undefined
  componentesAvariados: string | undefined
  estadoFonte: string | undefined
  tempoUso: string | undefined
  contextoEquipamento: string | undefined
  garantia: string | undefined
  protecaoEletrica: string | undefined
  outrosCampos: Record<string, unknown> | undefined
}

export function buildDiagnosticContext(report: ReportView | null): DiagnosticContext | null {
  if (!report) return null

  const { diagnostico, cliente, equipamento, componentes, assistencia } = report

  const componentSummary = componentes
    ?.map((component) => {
      const parts = [component.description, component.function, component.observations].filter(Boolean)
      return parts.join(' - ')
    })
    .filter(Boolean)
    .join(' | ')

  const equipmentSummary = [
    equipamento?.type,
    equipamento?.brand,
    equipamento?.model,
    equipamento?.serialNumber,
    equipamento?.physicalState,
    equipamento?.accessories,
    equipamento?.warranty,
  ].filter(Boolean).join(' | ')

  const protectionSummary = [
    equipamento?.lineFilter,
    equipamento?.ups,
    equipamento?.dps,
    equipamento?.grounding,
    equipamento?.electricalProtection,
  ].filter(Boolean).join(' | ')

  const clientSummary = [cliente?.name, cliente?.document, cliente?.phone, cliente?.email].filter(Boolean).join(' | ')

  return {
    relatoCliente: diagnostico.clientReport?.trim(),
    testesExecutados: diagnostico.testsExecuted?.trim(),
    componentesAvariados: componentSummary?.trim(),
    estadoFonte: diagnostico.powerStageStatus?.trim(),
    tempoUso: diagnostico.usageTimeEstimate?.trim(),
    contextoEquipamento: [equipmentSummary.trim(), clientSummary.trim()].filter(Boolean).join(' | ') || undefined,
    garantia: typeof equipamento?.warranty === 'string' && equipamento.warranty.trim() ? equipamento.warranty.trim() : undefined,
    protecaoEletrica: protectionSummary.trim() || undefined,
    outrosCampos: {
      cliente: clientSummary || undefined,
      tecnico: assistencia.technicianName ? `Técnico: ${assistencia.technicianName}` : undefined,
      equipamento: equipmentSummary || undefined,
    },
  }
}

export default function TechnicalReportTabs({ reportId }: { reportId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ReportView | null>(null)
  const [tab, setTab] = useState<'assistencia' | 'cliente' | 'diagnostico' | 'componentes' | 'fotos'>('assistencia')
  const [probableCause, setProbableCause] = useState('')
  const [technicalConclusion, setTechnicalConclusion] = useState('')
  const [iaLoading, setIaLoading] = useState(false)
  const [iaError, setIaError] = useState<string | null>(null)
  const [iaSuccess, setIaSuccess] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [sendLoading, setSendLoading] = useState(false)
  const [sendFeedback, setSendFeedback] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    setError(null)
    setReport(null)
    setProbableCause('')
    setTechnicalConclusion('')
    setIaError(null)
    setIaSuccess(false)

    fetch(`/reports/${encodeURIComponent(reportId)}/view`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then((data: ReportView) => setReport(data))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message || 'Erro ao carregar o laudo')
      })
      .finally(() => setLoading(false))

    return () => ac.abort()
  }, [reportId])

  useEffect(() => {
    if (!report) {
      setProbableCause('')
      setTechnicalConclusion('')
      setIaError(null)
      setIaSuccess(false)
      return
    }

    setProbableCause(report.diagnostico.probableCause ?? '')
    setTechnicalConclusion(report.diagnostico.technicalConclusion ?? '')
    setIaError(null)
    setIaSuccess(false)
  }, [report])

  const handleCopyWhatsAppSummary = async (mode: 'full' | 'short') => {
    if (!report) return

    try {
      const invoice = (report as any).financeiro?.invoice ?? null
      const text = mode === 'short'
        ? buildWhatsAppShortSummary(report, { protocol: meta.protocol }, invoice, window.location.origin)
        : buildWhatsAppFullSummary(report, { protocol: meta.protocol }, invoice, window.location.origin)
      await navigator.clipboard.writeText(text)
      setCopyFeedback(mode === 'short' ? 'Resumo curto copiado para a área de transferência.' : 'Resumo completo copiado para a área de transferência.')
    } catch (err) {
      setCopyFeedback('Não foi possível copiar o resumo. Copie o texto manualmente.')
    }
  }

  const handleSendSummaryViaGateway = async (mode: 'full' | 'short' = 'short') => {
    if (!report) return

    setSendLoading(true)
    setSendFeedback(null)

    try {
      const response = await fetch('/communications/whatsapp/send-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.meta?.id, mode }),
      })

      const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Não foi possível enviar o resumo pelo gateway.')
      }

      setSendFeedback('Resumo enviado para WhatsApp via gateway.')
    } catch (err) {
      setSendFeedback(err instanceof Error ? err.message : 'Não foi possível enviar o resumo pelo gateway.')
    } finally {
      setSendLoading(false)
    }
  }

  const handleSuggestWithAI = async () => {
    if (!report) return

    const context = buildDiagnosticContext(report)
    const hasContext = Boolean(context?.relatoCliente?.trim() || context?.testesExecutados?.trim())

    if (!hasContext) {
      setIaError('Preencha relato do cliente ou testes executados antes de usar a IA')
      setIaSuccess(false)
      return
    }

    setIaLoading(true)
    setIaError(null)
    setIaSuccess(false)

    try {
      const response = await fetch(`http://localhost:3000/ai/reports/${encodeURIComponent(reportId)}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      })

      if (!response.ok) {
        if (response.status === 400) {
          throw new Error('Preencha relato do cliente ou testes executados antes de usar a IA')
        }

        if (response.status === 500 || response.status === 502) {
          throw new Error('Não foi possível gerar a sugestão. Tente novamente mais tarde.')
        }

        const errorText = await response.text()
        throw new Error(errorText || 'Erro inesperado ao sugerir texto com a IA')
      }

      const data = (await response.json()) as { suggestion?: { probableCauseDraft?: string; technicalConclusionDraft?: string } }
      setProbableCause(data.suggestion?.probableCauseDraft?.trim() || '')
      setTechnicalConclusion(data.suggestion?.technicalConclusionDraft?.trim() || '')
      setIaSuccess(true)
    } catch (err) {
      setIaError(err instanceof Error ? err.message : 'Erro inesperado ao sugerir texto com a IA')
      setIaSuccess(false)
    } finally {
      setIaLoading(false)
    }
  }

  if (loading) return <div>Carregando laudo...</div>
  if (error) return <div style={{ color: 'crimson' }}>Erro: {error}</div>
  if (!report) return <div>Laudo não encontrado.</div>

  const { assistencia, cliente, equipamento, diagnostico, financeiro, componentes, fotos, meta } = report

  const tabBtn = (key: typeof tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`tab-button ${tab === key ? 'active' : ''}`}
    >
      {label}
    </button>
  )

  return (
    <section aria-labelledby="report-title" className="sheet">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Laudo técnico</p>
          <h2 id="report-title">{meta.protocol ?? meta.id}</h2>
          <p style={{ marginBottom: 0 }}>{assistencia.companyName || 'Assistência técnica'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button-primary"
            onClick={() => {
              window.history.pushState({}, '', `/reports/${encodeURIComponent(meta.id)}/document`)
              window.dispatchEvent(new PopStateEvent('popstate'))
            }}
          >
            Ver laudo completo
          </button>
          <button
            type="button"
            className="button-primary"
            onClick={() => handleCopyWhatsAppSummary('full')}
            style={{ background: '#147d3b' }}
          >
            Copiar resumo completo
          </button>
          <button
            type="button"
            className="button-primary"
            onClick={() => handleCopyWhatsAppSummary('short')}
            style={{ background: '#2563eb' }}
          >
            Copiar resumo curto
          </button>
          <button
            type="button"
            className="button-primary"
            onClick={() => handleSendSummaryViaGateway('short')}
            style={{ background: '#0f766e' }}
            disabled={sendLoading}
          >
            {sendLoading ? 'Enviando...' : 'Enviar via WhatsApp (gateway)'}
          </button>
          <div className={statusClassName(meta.status)}>{meta.status || 'Em revisão'}</div>
        </div>
      </div>

      {copyFeedback ? <p className="feedback-success" style={{ margin: '12px 24px 0' }}>{copyFeedback}</p> : null}
      {sendFeedback ? <p className="feedback-success" style={{ margin: '12px 24px 0' }}>{sendFeedback}</p> : null}

      <nav aria-label="Laudo tabs" className="tab-nav">
        {tabBtn('assistencia', 'Assistência')}
        {tabBtn('cliente', 'Cliente & Equipamento')}
        {tabBtn('diagnostico', 'Diagnóstico & Reparos')}
        {tabBtn('componentes', 'Componentes')}
        {tabBtn('fotos', 'Fotos')}
      </nav>

      <div role="tabpanel" className="report-content">
        {tab === 'assistencia' && (
          <article>
            <div className="section-block">
              <div className="section-heading">
                <h3>Dados da Assistência</h3>
              </div>
              <div className="grid-2">
                <div className="info-row"><strong>Empresa</strong><span>{assistencia.companyName || '-'}</span></div>
                <div className="info-row"><strong>Documento</strong><span>{assistencia.companyDocument || '-'}</span></div>
                <div className="info-row"><strong>Contato</strong><span>{assistencia.companyContact || '-'}</span></div>
                <div className="info-row"><strong>Endereço</strong><span>{assistencia.companyAddress || '-'}</span></div>
                <div className="info-row"><strong>E-mail</strong><span>{assistencia.companyEmail || '-'}</span></div>
                <div className="info-row"><strong>Site</strong><span>{assistencia.companySite || '-'}</span></div>
                <div className="info-row"><strong>Técnico</strong><span>{assistencia.technicianName || '-'} ({assistencia.technicianRegistry || '-'})</span></div>
                <div className="info-row"><strong>Cidade/Data</strong><span>{assistencia.cityDate ?? '-'}</span></div>
              </div>
            </div>
          </article>
        )}

        {tab === 'cliente' && (
          <article>
            <div className="section-block">
              <div className="section-heading">
                <h3>Cliente</h3>
              </div>
              {cliente ? (
                <pre className="report-json">{JSON.stringify(cliente, null, 2)}</pre>
              ) : (
                <p>Dados do cliente não disponíveis.</p>
              )}
            </div>

            <div className="section-block soft">
              <div className="section-heading">
                <h3>Equipamento</h3>
              </div>
              {equipamento ? (
                <pre className="report-json">{JSON.stringify(equipamento, null, 2)}</pre>
              ) : (
                <p>Dados do equipamento não disponíveis.</p>
              )}
            </div>
          </article>
        )}

        {tab === 'diagnostico' && (
          <article>
            <div className="section-block">
              <div className="section-heading">
                <h3>Resumo do diagnóstico</h3>
              </div>
              <div className="grid-2">
                <div className="section-block soft">
                  <h4>Relato do cliente</h4>
                  <p>{diagnostico.clientReport || '-'}</p>
                </div>
                <div className="section-block soft">
                  <h4>Testes executados</h4>
                  <p>{diagnostico.testsExecuted || '-'}</p>
                </div>
              </div>

              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="button-primary" onClick={handleSuggestWithAI} disabled={iaLoading}>
                  {iaLoading ? 'Gerando sugestão com IA...' : 'Sugerir laudo (IA)'}
                </button>
                {iaLoading && <span aria-live="polite">Gerando sugestão com IA...</span>}
              </div>

              {iaError && <p className="feedback-error" style={{ marginTop: 12 }}>{iaError}</p>}
              {iaSuccess && <p className="feedback-success" style={{ marginTop: 12 }}>Sugestão aplicada. Revise os campos antes de salvar.</p>}
            </div>

            <div className="section-block soft">
              <div className="section-heading">
                <h4>Causa provável dos danos</h4>
              </div>
              <textarea
                value={probableCause}
                onChange={(event) => setProbableCause(event.target.value)}
                rows={6}
              />
              <p className="ia-hint">Sugerido pela IA, revise antes de salvar.</p>
            </div>

            <div className="section-block soft">
              <div className="section-heading">
                <h4>Parecer técnico conclusivo</h4>
              </div>
              <textarea
                value={technicalConclusion}
                onChange={(event) => setTechnicalConclusion(event.target.value)}
                rows={6}
              />
              <p className="ia-hint">Sugerido pela IA, revise antes de salvar.</p>
            </div>

            <div className="section-block">
              <div className="section-heading">
                <h4>Observações e financeiro</h4>
              </div>
              <p><strong>No repair:</strong> {diagnostico.noRepair ? `Sim — ${diagnostico.noRepairReason || ''}` : 'Não'}</p>
              <p><strong>Peças:</strong> {formatCurrency(financeiro.partsValue)}</p>
              <p><strong>Mão de obra:</strong> {formatCurrency(financeiro.laborValue)}</p>
              <p><strong>Total:</strong> {formatCurrency(financeiro.totalValue)}</p>
            </div>
          </article>
        )}

        {tab === 'componentes' && (
          <article>
            <div className="section-block">
              <div className="section-heading">
                <h3>Componentes</h3>
              </div>
              {componentes && componentes.length ? (
                <div className="table-scroll">
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>Descrição</th>
                        <th style={thStyle}>Qtd</th>
                        <th style={thStyle}>Preço</th>
                      </tr>
                    </thead>
                    <tbody>
                      {componentes.map((c, i) => (
                        <tr key={c.id || i}>
                          <td style={tdStyle}>{i + 1}</td>
                          <td style={tdStyle}>{c.description || JSON.stringify(c)}</td>
                          <td style={tdStyle}>{c.quantity ?? '-'}</td>
                          <td style={tdStyle}>{formatCurrency(Number(c.unitPrice ?? c.price ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>Sem componentes registrados.</p>
              )}
            </div>
          </article>
        )}

        {tab === 'fotos' && (
          <article>
            <div className="section-block">
              <div className="section-heading">
                <h3>Fotos</h3>
              </div>
              {fotos && fotos.length ? (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {fotos.map((p, i) => (
                    <figure key={p.id || i} style={{ width: 160, margin: 0 }}>
                      {p.storagePath ? (
                        <a href={p.storagePath} target="_blank" rel="noreferrer">
                          <img src={p.storagePath} alt={p.caption || `Foto ${i + 1}`} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 12, border: '1px solid #edf1f6' }} />
                        </a>
                      ) : (
                        <div style={{ width: '100%', height: 100, background: '#eee', borderRadius: 12 }} />
                      )}
                      <figcaption style={{ fontSize: 12, marginTop: 8 }}>{p.caption || ''}</figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <p>Sem fotos registradas.</p>
              )}
            </div>
          </article>
        )}
      </div>
    </section>
  )
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px', borderBottom: '1px solid #eee' }
const tdStyle: React.CSSProperties = { padding: '8px', borderBottom: '1px solid #f6f6f6' }

function statusClassName(status?: string | null) {
  const normalized = (status || '').toUpperCase()
  if (normalized.includes('CONCL')) return 'status-pill status-done'
  if (normalized.includes('ABER') || normalized.includes('DIAGN')) return 'status-pill status-open'
  if (normalized.includes('AGUARD') || normalized.includes('PEND')) return 'status-pill status-pending'
  return 'status-pill'
}

function formatCurrency(value: number | undefined | null) {
  const n = Number(value ?? 0)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
