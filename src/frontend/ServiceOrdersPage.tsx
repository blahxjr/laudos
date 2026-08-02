import React, { useEffect, useMemo, useState } from 'react'
import TechnicalReportTabs from './TechnicalReportTabs.js'
import ConversationChat from './ConversationChat.js'
import { SERVICE_ORDER_STATUS_OPTIONS, getServiceOrderStatusLabel } from '../server/serviceOrderStatus.js'

type ServiceOrderItem = {
  id: string
  protocol?: string
  status?: string
  client?: { name?: string }
  equipment?: { type?: string; model?: string }
  firstReportId?: string
}

type ConversationSummary = {
  id: string
  channel?: { name?: string }
  externalId?: string | null
  status?: string
  updatedAt?: string
}

type OrderItem = {
  id: string
  type: 'SERVICO' | 'PARTE'
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  serviceCatalogId?: string | null
  partCatalogId?: string | null
  serviceCatalog?: { id?: string; name?: string }
  partCatalog?: { id?: string; name?: string }
}

type CatalogItem = {
  id: string
  name: string
  description?: string | null
  price: number
  stockQuantity?: number
  minimumStock?: number
  isActive: boolean
}

type ActivityItem = {
  id: string
  type: string
  message: string
  author?: string | null
  createdAt: string
}

export default function ServiceOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [orderConversations, setOrderConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [activeConversation, setActiveConversation] = useState<ConversationSummary | null>(null)
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [conversationsError, setConversationsError] = useState<string | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [services, setServices] = useState<CatalogItem[]>([])
  const [parts, setParts] = useState<CatalogItem[]>([])
  const [catalogsLoading, setCatalogsLoading] = useState(false)
  const [itemForm, setItemForm] = useState({
    id: '',
    type: 'SERVICO' as 'SERVICO' | 'PARTE',
    serviceCatalogId: '',
    partCatalogId: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
  })
  const [itemSubmitting, setItemSubmitting] = useState(false)
  const [itemFeedback, setItemFeedback] = useState<string | null>(null)
  const [invoiceFeedback, setInvoiceFeedback] = useState<string | null>(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activityFeedback, setActivityFeedback] = useState<string | null>(null)
  const [activitySubmitting, setActivitySubmitting] = useState(false)
  const [activityForm, setActivityForm] = useState({ message: '', author: '' })
  const [statusForm, setStatusForm] = useState('ABERTA')
  const [statusSubmitting, setStatusSubmitting] = useState(false)
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/service-orders')
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then((data) => {
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

  useEffect(() => {
    if (!selectedOrderId) {
      setOrderConversations([])
      setActiveConversationId(null)
      setActiveConversation(null)
      setConversationsError(null)
      return
    }

    setConversationsLoading(true)
    setConversationsError(null)
    fetch(`/communications/conversations?serviceOrderId=${encodeURIComponent(selectedOrderId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then((data) => {
        setOrderConversations(Array.isArray(data.data) ? data.data : [])
      })
      .catch((err) => {
        setOrderConversations([])
        setConversationsError(err instanceof Error ? err.message : 'Erro ao carregar conversas')
      })
      .finally(() => setConversationsLoading(false))
  }, [selectedOrderId])

  useEffect(() => {
    const loadCatalogs = async () => {
      setCatalogsLoading(true)
      try {
        const [servicesRes, partsRes] = await Promise.all([fetch('/services/catalog'), fetch('/parts/catalog')])
        if (!servicesRes.ok) throw new Error(await servicesRes.text())
        if (!partsRes.ok) throw new Error(await partsRes.text())
        const servicesData = await servicesRes.json()
        const partsData = await partsRes.json()
        const rawServices: any[] = Array.isArray(servicesData) ? servicesData : servicesData.data || []
        const rawParts: any[] = Array.isArray(partsData) ? partsData : partsData.data || []
        setServices(rawServices.map((item) => ({
          ...item,
          price: parseDecimalValue(item.price),
          stockQuantity: Number(item.stockQuantity ?? 0),
          minimumStock: Number(item.minimumStock ?? 0),
        })))
        setParts(rawParts.map((item) => ({
          ...item,
          price: parseDecimalValue(item.price),
          stockQuantity: Number(item.stockQuantity ?? 0),
          minimumStock: Number(item.minimumStock ?? 0),
        })))
      } catch (err) {
        console.error('Catalog load error:', err)
      } finally {
        setCatalogsLoading(false)
      }
    }

    loadCatalogs()
  }, [])

  const parseDecimalValue = (value: number | string | null | undefined): number => {
    if (value === null || value === undefined || value === '') return 0
    if (typeof value === 'number') return value
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  const loadItems = async (orderId: string) => {
    setItemsLoading(true)
    setItemsError(null)
    try {
      const res = await fetch(`/service-orders/${encodeURIComponent(orderId)}/items`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const rawItems = Array.isArray(data.data) ? data.data : []
      setItems(rawItems.map((item: any) => ({
        ...item,
        unitPrice: parseDecimalValue(item.unitPrice),
        totalPrice: parseDecimalValue(item.totalPrice),
      })))
    } catch (err) {
      setItems([])
      setItemsError(err instanceof Error ? err.message : 'Erro ao carregar itens da OS')
    } finally {
      setItemsLoading(false)
    }
  }

  useEffect(() => {
    if (selectedOrderId) {
      loadItems(selectedOrderId)
      loadActivities(selectedOrderId)
      const currentOrder = orders.find((order) => order.id === selectedOrderId)
      setStatusForm((currentOrder?.status ?? 'ABERTA').toUpperCase())
    } else {
      setItems([])
      setActivities([])
      setStatusForm('ABERTA')
    }
  }, [selectedOrderId, orders])

  const resetItemForm = () => {
    setItemForm({
      id: '',
      type: 'SERVICO',
      serviceCatalogId: '',
      partCatalogId: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
    })
    setItemFeedback(null)
  }

  const openItemEdit = (item: OrderItem) => {
    setItemForm({
      id: item.id,
      type: item.type,
      serviceCatalogId: item.serviceCatalog?.id ?? item.serviceCatalogId ?? '',
      partCatalogId: item.partCatalog?.id ?? item.partCatalogId ?? '',
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })
    setItemFeedback(null)
  }

  const addOrUpdateItem = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedOrderId) return

    setItemSubmitting(true)
    setItemFeedback(null)

    try {
      const payload = {
        type: itemForm.type,
        serviceCatalogId: itemForm.type === 'SERVICO' ? itemForm.serviceCatalogId || undefined : undefined,
        partCatalogId: itemForm.type === 'PARTE' ? itemForm.partCatalogId || undefined : undefined,
        description: itemForm.description.trim(),
        quantity: itemForm.quantity,
        unitPrice: itemForm.unitPrice,
      }

      const url = itemForm.id
        ? `/service-orders/${encodeURIComponent(selectedOrderId)}/items/${encodeURIComponent(itemForm.id)}`
        : `/service-orders/${encodeURIComponent(selectedOrderId)}/items`
      const method = itemForm.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      await loadItems(selectedOrderId)
      resetItemForm()
      setItemFeedback(itemForm.id ? 'Item atualizado com sucesso.' : 'Item adicionado à OS com sucesso.')
    } catch (err) {
      setItemFeedback(err instanceof Error ? err.message : 'Erro ao salvar item')
    } finally {
      setItemSubmitting(false)
    }
  }

  const deleteItem = async (itemId: string) => {
    if (!selectedOrderId) return
    if (!window.confirm('Remover item da OS?')) return
    try {
      const res = await fetch(`/service-orders/${encodeURIComponent(selectedOrderId)}/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      await loadItems(selectedOrderId)
      setItemFeedback('Item removido com sucesso.')
    } catch (err) {
      setItemFeedback(err instanceof Error ? err.message : 'Erro ao remover item')
    }
  }

  const loadActivities = async (orderId: string) => {
    setActivitiesLoading(true)
    setActivityFeedback(null)
    try {
      const res = await fetch(`/service-orders/${encodeURIComponent(orderId)}/activities`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const rawActivities = Array.isArray(data.data) ? data.data : []
      setActivities(rawActivities)
    } catch (err) {
      setActivities([])
      setActivityFeedback(err instanceof Error ? err.message : 'Erro ao carregar atividades')
    } finally {
      setActivitiesLoading(false)
    }
  }

  const submitActivity = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedOrderId) return

    setActivitySubmitting(true)
    setActivityFeedback(null)
    try {
      const res = await fetch(`/service-orders/${encodeURIComponent(selectedOrderId)}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: activityForm.message.trim(), author: activityForm.author.trim() || undefined }),
      })
      if (!res.ok) throw new Error(await res.text())
      setActivityForm({ message: '', author: '' })
      await loadActivities(selectedOrderId)
      setActivityFeedback('Atividade registrada com sucesso.')
    } catch (err) {
      setActivityFeedback(err instanceof Error ? err.message : 'Erro ao registrar atividade')
    } finally {
      setActivitySubmitting(false)
    }
  }

  const updateOrderStatus = async () => {
    if (!selectedOrderId) return

    setStatusSubmitting(true)
    setStatusFeedback(null)
    try {
      const res = await fetch(`/service-orders/${encodeURIComponent(selectedOrderId)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusForm, message: `Status atualizado para ${getServiceOrderStatusLabel(statusForm)}.` }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setOrders((currentOrders) => currentOrders.map((order) => order.id === selectedOrderId ? { ...order, status: data.serviceOrder?.status ?? order.status } : order))
      await loadActivities(selectedOrderId)
      setStatusFeedback('Status atualizado com sucesso.')
    } catch (err) {
      setStatusFeedback(err instanceof Error ? err.message : 'Erro ao atualizar status')
    } finally {
      setStatusSubmitting(false)
    }
  }

  const [invoiceDiscount, setInvoiceDiscount] = useState(0)

  const generateInvoice = async () => {
    if (!selectedOrderId) return
    setInvoiceLoading(true)
    setInvoiceFeedback(null)
    try {
      const res = await fetch(`/service-orders/${encodeURIComponent(selectedOrderId)}/invoices/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountAmount: invoiceDiscount }),
      })
      if (!res.ok) throw new Error(await res.text())
      setInvoiceFeedback('Fatura gerada com sucesso.')
    } catch (err) {
      setInvoiceFeedback(err instanceof Error ? err.message : 'Erro ao gerar fatura')
    } finally {
      setInvoiceLoading(false)
    }
  }

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0)
  }, [items])

  const openConversation = (conversation: ConversationSummary) => {
    setActiveConversationId(conversation.id)
    setActiveConversation(conversation)
  }

  const statusClassName = (status?: string) => {
    const normalized = (status || '').toUpperCase()
    if (normalized.includes('CONCL')) return 'status-pill status-done'
    if (normalized.includes('ABER') || normalized.includes('DIAGN')) return 'status-pill status-open'
    if (normalized.includes('AGUARD') || normalized.includes('PEND')) return 'status-pill status-pending'
    return 'status-pill'
  }

  return (
    <div className="service-orders-layout">
      <aside className="service-orders-sidebar">
        <div className="sidebar-card">
          <h3 style={{ marginBottom: 8 }}>Ordens de Serviço</h3>
          <p>Selecione uma ordem para abrir o laudo técnico associado.</p>

          {loading && <p>Carregando ordens...</p>}
          {error && <p className="feedback-error">Erro: {error}</p>}

          {!loading && !error && (
            <div className="table-scroll">
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
            </div>
          )}
        </div>
      </aside>

      <section className="service-orders-content">
        {selectedOrderId ? (
          <>
            {selectedReportId ? (
              <TechnicalReportTabs reportId={selectedReportId} />
            ) : (
              <div className="sheet" style={{ padding: 24 }}>
                <p>Carregando laudo para a OS selecionada...</p>
              </div>
            )}

            <div className="sheet" style={{ marginTop: 24, padding: 24 }}>
              <div className="section-heading" style={{ marginBottom: 16 }}>
                <h3>Status e atividades</h3>
                <p style={{ margin: 0, color: '#555' }}>Atualize o andamento da ordem e registre atividades de acompanhamento.</p>
              </div>

              {statusFeedback && <p className="feedback-success">{statusFeedback}</p>}
              <div className="form-grid" style={{ gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'end', marginBottom: 24 }}>
                <div className="field">
                  <label className="field-label">Status atual</label>
                  <select value={statusForm} onChange={(event) => setStatusForm(event.target.value)}>
                    {SERVICE_ORDER_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <button className="button-primary" type="button" onClick={updateOrderStatus} disabled={statusSubmitting}>
                    {statusSubmitting ? 'Atualizando...' : 'Salvar status'}
                  </button>
                </div>
              </div>

              <form onSubmit={submitActivity} className="form-section" style={{ marginBottom: 24 }}>
                <div className="section-heading" style={{ marginBottom: 16 }}>
                  <h4>Registrar atividade</h4>
                </div>
                <div className="form-grid" style={{ gridTemplateColumns: '1.4fr 0.8fr', gap: 16 }}>
                  <div className="field">
                    <label className="field-label">Mensagem</label>
                    <textarea value={activityForm.message} onChange={(event) => setActivityForm((prev) => ({ ...prev, message: event.target.value }))} rows={3} required />
                  </div>
                  <div className="field">
                    <label className="field-label">Responsável</label>
                    <input value={activityForm.author} onChange={(event) => setActivityForm((prev) => ({ ...prev, author: event.target.value }))} placeholder="Técnico / cliente" />
                  </div>
                </div>
                <div className="form-actions" style={{ marginTop: 12 }}>
                  <button className="button-primary" type="submit" disabled={activitySubmitting}>Registrar atividade</button>
                </div>
              </form>

              {activityFeedback && <p className="feedback-success">{activityFeedback}</p>}
              {activitiesLoading ? (
                <p>Carregando atividades...</p>
              ) : (
                <div className="activity-list">
                  {activities.length === 0 ? (
                    <p>Nenhuma atividade registrada ainda.</p>
                  ) : (
                    activities.map((activity) => (
                      <div key={activity.id} className="activity-item">
                        <div className="activity-meta">
                          <strong>{activity.author || 'Sistema'}</strong>
                          <span>{new Date(activity.createdAt).toLocaleString()}</span>
                        </div>
                        <p style={{ margin: 0 }}>{activity.message}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="sheet" style={{ marginTop: 24, padding: 24 }}>
              <div className="section-heading" style={{ marginBottom: 16 }}>
                <h3>Itens da OS</h3>
                <p style={{ margin: 0, color: '#555' }}>Gerencie serviços e peças vinculados a esta ordem.</p>
              </div>

              {itemFeedback && <p className="feedback-success">{itemFeedback}</p>}
              {itemsError && <p className="feedback-error">Erro: {itemsError}</p>}

              <form onSubmit={addOrUpdateItem} className="form-section" style={{ marginBottom: 24 }}>
                <div className="section-heading" style={{ marginBottom: 16 }}>
                  <h4>{itemForm.id ? 'Editar item' : 'Adicionar item'}</h4>
                </div>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="field">
                    <label className="field-label">Tipo</label>
                    <select value={itemForm.type} onChange={(event) => setItemForm((prev) => ({ ...prev, type: event.target.value as 'SERVICO' | 'PARTE', serviceCatalogId: '', partCatalogId: '' }))}>
                      <option value="SERVICO">Serviço</option>
                      <option value="PARTE">Peça / Material</option>
                    </select>
                  </div>

                  {itemForm.type === 'SERVICO' ? (
                    <div className="field">
                      <label className="field-label">Serviço</label>
                      <select
                        value={itemForm.serviceCatalogId}
                        onChange={(event) => {
                          const selectedId = event.target.value
                          const selection = services.find((item) => item.id === selectedId)
                          setItemForm((prev) => ({
                            ...prev,
                            serviceCatalogId: selectedId,
                            partCatalogId: '',
                            description: selection?.name || prev.description,
                            unitPrice: selection ? parseDecimalValue(selection.price) : prev.unitPrice,
                          }))
                        }}
                      >
                        <option value="">Selecione um serviço</option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>{service.name} – R$ {parseDecimalValue(service.price).toFixed(2)}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="field">
                      <label className="field-label">Peça / Material</label>
                      <select
                        value={itemForm.partCatalogId}
                        onChange={(event) => {
                          const selectedId = event.target.value
                          const selection = parts.find((item) => item.id === selectedId)
                          setItemForm((prev) => ({
                            ...prev,
                            partCatalogId: selectedId,
                            serviceCatalogId: '',
                            description: selection?.name || prev.description,
                            unitPrice: selection ? parseDecimalValue(selection.price) : prev.unitPrice,
                          }))
                        }}
                      >
                        <option value="">Selecione uma peça</option>
                        {parts.map((part) => (
                          <option key={part.id} value={part.id}>{part.name} – R$ {parseDecimalValue(part.price).toFixed(2)}</option>
                        ))}
                      </select>
                      {itemForm.partCatalogId && (() => {
                        const selectedPart = parts.find((part) => part.id === itemForm.partCatalogId)
                        if (!selectedPart) return null
                        const lowStock = Number(selectedPart.stockQuantity ?? 0) < Number(selectedPart.minimumStock ?? 0)
                        return (
                          <div style={{ marginTop: 8, fontSize: 13, color: lowStock ? '#b45309' : '#2563eb' }}>
                            <strong>Estoque:</strong> {selectedPart.stockQuantity ?? 0} {lowStock ? '⚠️' : '✓'}
                            {' '}<span>(mínimo {selectedPart.minimumStock ?? 0})</span>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  <div className="field">
                    <label className="field-label">Quantidade</label>
                    <input type="number" min="1" value={itemForm.quantity} onChange={(event) => setItemForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))} required />
                  </div>

                  <div className="field">
                    <label className="field-label">Preço unitário</label>
                    <input type="number" min="0" step="0.01" value={itemForm.unitPrice} onChange={(event) => setItemForm((prev) => ({ ...prev, unitPrice: Number(event.target.value) }))} required />
                  </div>

                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label className="field-label">Descrição</label>
                    <textarea value={itemForm.description} onChange={(event) => setItemForm((prev) => ({ ...prev, description: event.target.value }))} required rows={3} />
                  </div>
                </div>

                <div className="form-actions">
                  <button className="button-primary" type="submit" disabled={itemSubmitting}>{itemForm.id ? 'Salvar item' : 'Adicionar item'}</button>
                  {itemForm.id && (
                    <button type="button" className="table-action" onClick={resetItemForm}>Cancelar</button>
                  )}
                </div>
              </form>

              <div className="section-heading" style={{ marginBottom: 16 }}>
                <h4>Resumo de itens</h4>
                <div style={{ textAlign: 'right' }}>
                  <strong>Subtotal: R$ {subtotal.toFixed(2)}</strong>
                </div>
              </div>

              {itemsLoading ? (
                <p>Carregando itens...</p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Descrição</th>
                        <th>Qtd.</th>
                        <th>Unitário</th>
                        <th>Total</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.type === 'SERVICO' ? 'Serviço' : 'Peça'}</td>
                          <td>{item.description}</td>
                          <td>{item.quantity}</td>
                          <td>R$ {item.unitPrice.toFixed(2)}</td>
                          <td>R$ {item.totalPrice.toFixed(2)}</td>
                          <td>
                            <button type="button" className="table-action" onClick={() => openItemEdit(item)}>Editar</button>
                            <button type="button" className="table-action" onClick={() => deleteItem(item.id)}>Remover</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="section-heading" style={{ marginTop: 24, marginBottom: 16 }}>
                <h3>Faturamento</h3>
                <p style={{ margin: 0, color: '#555' }}>Gere uma cobrança com base nos itens desta ordem.</p>
              </div>

              {invoiceFeedback && <p className="feedback-success">{invoiceFeedback}</p>}

              <div className="form-grid" style={{ gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'end', marginBottom: 16 }}>
                <div className="field">
                  <label className="field-label">Desconto (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoiceDiscount}
                    onChange={(event) => setInvoiceDiscount(Number(event.target.value))}
                  />
                </div>
                <div>
                  <button className="button-primary" type="button" onClick={generateInvoice} disabled={invoiceLoading || items.length === 0}>
                    {invoiceLoading ? 'Gerando...' : 'Gerar cobrança'}
                  </button>
                </div>
              </div>
            </div>

            <div className="sheet" style={{ marginTop: 24, padding: 24 }}>
              <div className="section-heading" style={{ marginBottom: 16 }}>
                <h3>Conversas da OS</h3>
                <p style={{ margin: 0, color: '#555' }}>Visualize os canais de comunicação vinculados a esta ordem.</p>
              </div>
              {conversationsLoading && <p>Carregando conversas...</p>}
              {conversationsError && <p className="feedback-error">Erro: {conversationsError}</p>}
              {!conversationsLoading && !conversationsError && orderConversations.length === 0 && (
                <p>Nenhuma conversa encontrada para esta ordem.</p>
              )}
              {!conversationsLoading && !conversationsError && orderConversations.length > 0 && (
                <>
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Canal</th>
                          <th>ID externo</th>
                          <th>Status</th>
                          <th>Última atualização</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderConversations.map((conversation) => (
                          <tr key={conversation.id}>
                            <td>{conversation.channel?.name || '—'}</td>
                            <td>{conversation.externalId || '—'}</td>
                            <td>{conversation.status || '—'}</td>
                            <td>{conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleString() : '—'}</td>
                            <td>
                              <button type="button" className="table-action" onClick={() => openConversation(conversation)}>
                                Abrir chat
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {activeConversationId && activeConversation && (
                    <div className="sheet" style={{ marginTop: 24, padding: 0 }}>
                      <ConversationChat
                        conversationId={activeConversationId}
                        conversation={activeConversation}
                        onClose={() => setActiveConversationId(null)}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="sheet" style={{ padding: 24 }}>
            <p>Selecione uma OS para visualizar o laudo.</p>
          </div>
        )}
      </section>
    </div>
  )
}
