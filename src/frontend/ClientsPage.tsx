import React, { useEffect, useMemo, useState } from 'react'
import { formatCep, formatDocument, getDocumentValidationError, getZipCodeValidationError, onlyDigits, parseClientApiErrors } from './clientFormatting'

type Client = {
  id: string
  name: string
  type: 'PF' | 'PJ'
  document?: string | null
  street?: string | null
  number?: string | null
  complement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  accountStatus?: string | null
  createdAt?: string
  updatedAt?: string
}

type ClientFormState = {
  name: string
  type: 'PF' | 'PJ'
  document: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
  accountStatus: string
}

const emptyForm = (): ClientFormState => ({ name: '', type: 'PF', document: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', accountStatus: 'ATIVO' })

const buildClientFormState = (client: Partial<Client> | null | undefined): ClientFormState => ({
  name: client?.name || '',
  type: client?.type === 'PJ' ? 'PJ' : 'PF',
  document: client?.document || '',
  street: client?.street || '',
  number: client?.number || '',
  complement: client?.complement || '',
  neighborhood: client?.neighborhood || '',
  city: client?.city || '',
  state: client?.state || '',
  zipCode: client?.zipCode || '',
  accountStatus: client?.accountStatus || 'ATIVO',
})

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [form, setForm] = useState<ClientFormState>(emptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [zipCodeError, setZipCodeError] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formGeneralError, setFormGeneralError] = useState<string | null>(null)
  const [duplicateClient, setDuplicateClient] = useState<Client | null>(null)

  const isEditingClient = Boolean(selectedClient)

  const loadClients = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/clients')
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json()
      const list = Array.isArray(data) ? data : data.data || []
      setClients(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClients()
  }, [])

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return clients

    return clients.filter((client) => {
      const haystack = [client.name, client.document, client.type].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [clients, search])

  const openCreate = () => {
    setSelectedClient(null)
    setForm(emptyForm())
    setFeedback(null)
    setFormErrors({})
    setFormGeneralError(null)
    setDuplicateClient(null)
    setIsModalOpen(true)
  }

  const openEdit = (client: Client) => {
    setSelectedClient(client)
    setForm(buildClientFormState(client))
    setFeedback(null)
    setDuplicateClient(null)
    setIsModalOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setFeedback(null)
    setFormErrors({})
    setFormGeneralError(null)

    const normalizedDocument = onlyDigits(form.document)
    const normalizedZipCode = onlyDigits(form.zipCode)
    const nextDocumentError = getDocumentValidationError(normalizedDocument, form.type)
    const nextZipCodeError = getZipCodeValidationError(normalizedZipCode)
    setDocumentError(nextDocumentError)
    setZipCodeError(nextZipCodeError)

    if (nextDocumentError || nextZipCodeError) {
      setSubmitting(false)
      return
    }

    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        document: normalizedDocument || undefined,
        street: form.street.trim() || undefined,
        number: form.number.trim() || undefined,
        complement: form.complement.trim() || undefined,
        neighborhood: form.neighborhood.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim().toUpperCase() || undefined,
        zipCode: normalizedZipCode || undefined,
        accountStatus: form.accountStatus || 'ATIVO',
      }

      const response = selectedClient
        ? await fetch(`/clients/${selectedClient.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      if (!response.ok) {
        const responseText = await response.text()
        let parsedError: unknown = responseText
        try {
          parsedError = JSON.parse(responseText)
        } catch {
          // keep plain text error
        }

        const { fieldErrors, generalError } = parseClientApiErrors(parsedError)
        setFormErrors(fieldErrors)
        setFormGeneralError(generalError ?? 'Erro ao salvar cliente')

        const duplicateError = fieldErrors.document?.toLowerCase().includes('já existe') || fieldErrors.document?.toLowerCase().includes('duplic')
        if (duplicateError) {
          const duplicateCandidate = clients.find((client) => onlyDigits(client.document || '') === normalizedDocument)
          setDuplicateClient(duplicateCandidate ?? null)
        } else {
          setDuplicateClient(null)
        }

        return
      }

      setDuplicateClient(null)
      setIsModalOpen(false)
      setFeedback(selectedClient ? 'Cliente atualizado com sucesso.' : 'Cliente criado com sucesso.')
      await loadClients()
    } catch (err) {
      setFormGeneralError(err instanceof Error ? err.message : 'Erro ao salvar cliente')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sheet">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Clientes</p>
          <h2>Gestão de clientes</h2>
          <p style={{ marginBottom: 0 }}>Lista, busca e cadastro rápido de clientes.</p>
        </div>
        <div className="page-actions">
          <button className="button-primary" type="button" onClick={openCreate}>Novo cliente</button>
        </div>
      </div>

      <div className="report-content">
        <div className="section-block">
          <div className="section-heading">
            <h3>Clientes</h3>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou documento"
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #dbe3ee', minWidth: 260 }}
            />
          </div>

          {feedback && <p className={selectedClient ? 'feedback-success' : 'feedback-success'}>{feedback}</p>}

          {loading && <p>Carregando clientes...</p>}
          {error && <p className="feedback-error">Erro: {error}</p>}

          {!loading && !error && (
            <div className="clients-table-wrapper table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Documento</th>
                    <th>Cidade/UF</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr key={client.id}>
                      <td>
                        <strong>{client.name}</strong>
                        <div className="table-subtle">{client.type}</div>
                      </td>
                      <td>{client.document || '-'}</td>
                      <td>{[client.city, client.state].filter(Boolean).join('/') || '-'}</td>
                      <td>{client.accountStatus || 'ATIVO'}</td>
                      <td>
                        <button type="button" className="table-action" onClick={() => openEdit(client)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxHeight: '90vh', overflowY: 'auto', width: 'min(560px, 100%)' }}>
            <div className="section-heading">
              <h3>{selectedClient ? 'Editar cliente' : 'Novo cliente'}</h3>
              <button type="button" className="table-action" onClick={() => setIsModalOpen(false)}>Fechar</button>
            </div>

            <form onSubmit={handleSubmit} className="form-grid" style={{ gap: 10 }}>
              {formGeneralError && <p className="feedback-error" style={{ gridColumn: '1 / -1' }}>{formGeneralError}</p>}

              <div className="form-section">
                <div className="form-section-title">Dados básicos</div>
                <div className="form-section-subtitle">Defina o tipo de cliente e o documento principal.</div>
                <div className="form-grid">
                  <label className="field">
                    <span className="field-label">Nome</span>
                    <input
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      required
                      aria-invalid={Boolean(formErrors.name)}
                      className={formErrors.name ? 'input-error' : ''}
                    />
                    {formErrors.name && <small className="field-error-message">{formErrors.name}</small>}
                  </label>
                  <label className="field">
                    <span className="field-label">Tipo</span>
                    <select value={form.type} onChange={(event) => {
                      const nextType = event.target.value as 'PF' | 'PJ'
                      setForm({
                        ...form,
                        type: nextType,
                        document: form.document ? formatDocument(form.document, nextType) : '',
                      })
                    }}>
                      <option value="PF">PF</option>
                      <option value="PJ">PJ</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">Documento</span>
                    <input
                      value={form.document}
                      onChange={(event) => {
                        const nextValue = formatDocument(event.target.value, form.type)
                        setForm({ ...form, document: nextValue })
                        setDocumentError(getDocumentValidationError(onlyDigits(nextValue), form.type))
                        setFormErrors((current) => ({ ...current, document: '' }))
                      }}
                      inputMode="numeric"
                      aria-invalid={Boolean(formErrors.document || documentError)}
                      className={formErrors.document || documentError ? 'input-error' : ''}
                      disabled={isEditingClient}
                      readOnly={isEditingClient}
                    />
                    {isEditingClient && <small className="field-hint">CPF/CNPJ não pode ser alterado na edição.</small>}
                    {(formErrors.document || documentError) && <small className="field-error-message">{formErrors.document || documentError}</small>}
                  </label>
                  <label className="field">
                    <span className="field-label">Status</span>
                    <select value={form.accountStatus} onChange={(event) => setForm({ ...form, accountStatus: event.target.value })}>
                      <option value="ATIVO">ATIVO</option>
                      <option value="INATIVO">INATIVO</option>
                    </select>
                  </label>
                </div>
              </div>

              {duplicateClient && (
                <div className="form-section" style={{ borderColor: '#dbeafe', background: '#f8fbff' }}>
                  <div className="form-section-title">Cadastro já existente</div>
                  <div className="form-section-subtitle">Encontramos um cliente com o mesmo documento. Você pode carregar esse cadastro para revisar.</div>
                  <div className="page-actions" style={{ justifyContent: 'flex-start' }}>
                    <button
                      type="button"
                      className="table-action"
                      onClick={() => {
                        setSelectedClient(duplicateClient)
                        setForm(buildClientFormState(duplicateClient))
                        setDuplicateClient(null)
                      }}
                    >
                      Ver cliente existente
                    </button>
                  </div>
                </div>
              )}

              <div className="form-section">
                <div className="form-section-title">Endereço</div>
                <div className="form-section-subtitle">Complete os dados de correspondência do cliente.</div>
                <div className="form-grid">
                  <label className="field">
                    <span className="field-label">Logradouro</span>
                    <input
                      value={form.street}
                      onChange={(event) => setForm({ ...form, street: event.target.value })}
                      aria-invalid={Boolean(formErrors.street)}
                      className={formErrors.street ? 'input-error' : ''}
                    />
                    {formErrors.street && <small className="field-error-message">{formErrors.street}</small>}
                  </label>
                  <div className="grid-2">
                    <label className="field">
                      <span className="field-label">Número</span>
                      <input
                        value={form.number}
                        onChange={(event) => setForm({ ...form, number: event.target.value })}
                        aria-invalid={Boolean(formErrors.number)}
                        className={formErrors.number ? 'input-error' : ''}
                      />
                      {formErrors.number && <small className="field-error-message">{formErrors.number}</small>}
                    </label>
                    <label className="field">
                      <span className="field-label">Complemento</span>
                      <input value={form.complement} onChange={(event) => setForm({ ...form, complement: event.target.value })} />
                    </label>
                  </div>
                  <label className="field">
                    <span className="field-label">Bairro</span>
                    <input
                      value={form.neighborhood}
                      onChange={(event) => setForm({ ...form, neighborhood: event.target.value })}
                      aria-invalid={Boolean(formErrors.neighborhood)}
                      className={formErrors.neighborhood ? 'input-error' : ''}
                    />
                    {formErrors.neighborhood && <small className="field-error-message">{formErrors.neighborhood}</small>}
                  </label>
                  <div className="grid-2">
                    <label className="field">
                      <span className="field-label">Cidade</span>
                      <input
                        value={form.city}
                        onChange={(event) => setForm({ ...form, city: event.target.value })}
                        aria-invalid={Boolean(formErrors.city)}
                        className={formErrors.city ? 'input-error' : ''}
                      />
                      {formErrors.city && <small className="field-error-message">{formErrors.city}</small>}
                    </label>
                    <label className="field">
                      <span className="field-label">UF</span>
                      <input
                        value={form.state}
                        onChange={(event) => setForm({ ...form, state: event.target.value.toUpperCase() })}
                        maxLength={2}
                        aria-invalid={Boolean(formErrors.state)}
                        className={formErrors.state ? 'input-error' : ''}
                      />
                      {formErrors.state && <small className="field-error-message">{formErrors.state}</small>}
                    </label>
                  </div>
                  <label className="field">
                    <span className="field-label">CEP</span>
                    <input
                      value={form.zipCode}
                      onChange={(event) => {
                        const nextValue = formatCep(event.target.value)
                        setForm({ ...form, zipCode: nextValue })
                        setZipCodeError(getZipCodeValidationError(onlyDigits(nextValue)))
                        setFormErrors((current) => ({ ...current, zipCode: '' }))
                      }}
                      inputMode="numeric"
                      aria-invalid={Boolean(formErrors.zipCode || zipCodeError)}
                      className={formErrors.zipCode || zipCodeError ? 'input-error' : ''}
                    />
                    {(formErrors.zipCode || zipCodeError) && <small className="field-error-message">{formErrors.zipCode || zipCodeError}</small>}
                  </label>
                </div>
              </div>

              <div className="form-actions" style={{ position: 'sticky', bottom: 0, paddingTop: 8, background: 'var(--bg-surface)' }}>
                <button type="button" className="table-action" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="button-primary" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar cliente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
