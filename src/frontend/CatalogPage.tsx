import React, { useEffect, useState } from 'react'

type CatalogItem = {
  id: string
  name: string
  description?: string | null
  price: number
  stockQuantity?: number
  minimumStock?: number
  isActive: boolean
}

type CatalogPageProps = {
  title: string
  subtitle: string
  apiList: string
  apiCreate: string
  apiUpdate: string
  apiDelete: string
  typeLabel: string
}

export default function CatalogPage({ title, subtitle, apiList, apiCreate, apiUpdate, apiDelete, typeLabel }: CatalogPageProps) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [stockQuantity, setStockQuantity] = useState('0')
  const [minimumStock, setMinimumStock] = useState('0')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const loadItems = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(apiList)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setItems(Array.isArray(data) ? data : data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar itens')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [apiList])

  const resetForm = () => {
    setName('')
    setDescription('')
    setPrice('0')
    setStockQuantity('0')
    setMinimumStock('0')
    setEditingItemId(null)
    setFeedback(null)
  }

  const openEdit = (item: CatalogItem) => {
    setEditingItemId(item.id)
    setName(item.name)
    setDescription(item.description ?? '')
    setPrice(String(item.price))
    setStockQuantity(String(item.stockQuantity ?? 0))
    setMinimumStock(String(item.minimumStock ?? 0))
    setFeedback(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setFeedback(null)

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price),
        stockQuantity: Number(stockQuantity),
        minimumStock: Number(minimumStock),
      }
      const url = editingItemId ? `${apiUpdate.replace(':id', editingItemId)}` : apiCreate
      const method = editingItemId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      await loadItems()
      resetForm()
      setFeedback(editingItemId ? `${typeLabel} atualizado com sucesso.` : `${typeLabel} criado com sucesso.`)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao salvar item')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (item: CatalogItem) => {
    if (!window.confirm(`Inativar ${typeLabel} "${item.name}"?`)) return
    try {
      const res = await fetch(apiDelete.replace(':id', item.id), { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      await loadItems()
      setFeedback(`${typeLabel} inativado com sucesso.`)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao inativar item')
    }
  }

  return (
    <div className="sheet">
      <div className="toolbar">
        <div>
          <p className="eyebrow">{title}</p>
          <h2>{subtitle}</h2>
        </div>
      </div>

      <div className="report-content">
        {feedback && <p className="feedback-success">{feedback}</p>}
        {error && <p className="feedback-error">Erro: {error}</p>}

        <div className="form-section">
          <h3>{editingItemId ? `Editar ${typeLabel}` : `Novo ${typeLabel}`}</h3>
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="name">Nome</label>
              <input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="price">Preço unitário</label>
              <input id="price" type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="stockQuantity">Estoque atual</label>
              <input id="stockQuantity" type="number" min="0" step="1" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} required />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="minimumStock">Estoque mínimo</label>
              <input id="minimumStock" type="number" min="0" step="1" value={minimumStock} onChange={(event) => setMinimumStock(event.target.value)} required />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field-label" htmlFor="description">Descrição</label>
              <textarea id="description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div className="form-actions">
              <button className="button-primary" type="submit" disabled={submitting}>{editingItemId ? 'Salvar alteração' : 'Criar item'}</button>
              {editingItemId && (
                <button type="button" className="table-action" onClick={resetForm}>Cancelar</button>
              )}
            </div>
          </form>
        </div>

        <div className="section-block">
          <div className="section-heading">
            <h3>{title}</h3>
          </div>
          {loading ? (
            <p>Carregando {typeLabel.toLowerCase()}...</p>
          ) : (
            <div className="clients-table-wrapper table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Preço</th>
                    <th>Estoque</th>
                    <th>Mínimo</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>R$ {item.price.toFixed(2)}</td>
                      <td>{item.stockQuantity ?? 0}</td>
                      <td>{item.minimumStock ?? 0}</td>
                      <td>{item.isActive ? 'Ativo' : 'Inativo'}</td>
                      <td>
                        <button type="button" className="table-action" onClick={() => openEdit(item)}>Editar</button>
                        <button type="button" className="table-action" onClick={() => handleDelete(item)}>Inativar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
