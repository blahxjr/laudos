import React, { useEffect, useMemo, useState } from 'react'
import { WhatsAppConnectionStatusBadge, WhatsAppQrCodePanel, getConnectionStatusLabel, isSessionReadyForTestMessage, type UiConnectionStatus } from './whatsappConnectionUi.js'
import { parseHttpResponseSafely, type SafeApiTechnicalDetails } from './httpResponse.js'

type WhatsAppSettingsResponse = {
  gatewayBaseUrl: string | null
  appBaseUrl: string | null
  defaultTestPhone: string | null
  provider: string | null
  instanceName: string | null
  hasGatewayToken: boolean
  hasGatewayWebhookToken: boolean
}

type WhatsAppSettingsForm = {
  gatewayBaseUrl: string
  gatewayToken: string
  gatewayWebhookToken: string
  appBaseUrl: string
  defaultTestPhone: string
  provider: 'EVOLUTION' | 'WAHA'
  instanceName: string
}

type ApiActionResponse = {
  ok: boolean
  message?: string
  phone?: string
  technicalDetails?: {
    statusCode?: number
    endpoint?: string
    errorCode?: string
    errorMessage?: string
  }
}

type TechnicalDetails = {
  statusCode?: number
  endpoint?: string
  errorCode?: string
  errorMessage?: string
  contentType?: string
  preview?: string
}

type WhatsAppConnectionPayload = {
  ok: boolean
  provider: 'EVOLUTION' | 'WAHA'
  instanceName: string
  status: UiConnectionStatus
  statusLabel?: string
  qrCodeBase64: string | null
  pairingCode?: string | null
  rawCode?: string | null
  phoneNumber: string | null
  connectedAt: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  lastSeenAt: string | null
  updatedAt: string | null
  technicalDetails?: TechnicalDetails
  message?: string
}

const buildEmptyForm = (): WhatsAppSettingsForm => ({
  gatewayBaseUrl: '',
  gatewayToken: '',
  gatewayWebhookToken: '',
  appBaseUrl: '',
  defaultTestPhone: '',
  provider: 'EVOLUTION',
  instanceName: 'assist-tech-main',
})

const toInputText = (value: string | null | undefined) => value ?? ''

const extractApiError = async (response: Response, fallbackMessage: string) => {
  const bodyText = await response.text()
  if (!bodyText) return `${fallbackMessage} (HTTP ${response.status})`

  try {
    const parsed = JSON.parse(bodyText) as { message?: string; errors?: Array<{ message?: string }> }
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((error) => error.message).filter(Boolean).join(' ')
    }
    if (parsed.message) return parsed.message
  } catch {
    if (bodyText.includes('<!DOCTYPE html>') || bodyText.includes('<html')) {
      return `${fallbackMessage} (HTTP ${response.status})`
    }
  }

  return bodyText
}

function WhatsAppSettingsSection() {
  const [form, setForm] = useState<WhatsAppSettingsForm>(buildEmptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [hasGatewayToken, setHasGatewayToken] = useState(false)
  const [hasGatewayWebhookToken, setHasGatewayWebhookToken] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatusMessage, setConnectionStatusMessage] = useState<string | null>(null)
  const [connectionStatusOk, setConnectionStatusOk] = useState<boolean | null>(null)
  const [connectionTechnicalDetails, setConnectionTechnicalDetails] = useState<TechnicalDetails | null>(null)
  const [showConnectionTechnicalDetails, setShowConnectionTechnicalDetails] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [sendingTestMessage, setSendingTestMessage] = useState(false)
  const [testSendFeedback, setTestSendFeedback] = useState<{ ok: boolean; message: string; technicalDetails?: TechnicalDetails } | null>(null)
  const [showTestSendTechnicalDetails, setShowTestSendTechnicalDetails] = useState(false)
  const [connectionData, setConnectionData] = useState<WhatsAppConnectionPayload | null>(null)
  const [connectionLoading, setConnectionLoading] = useState(false)
  const [connectionActionLoading, setConnectionActionLoading] = useState<string | null>(null)
  const [connectionFeedback, setConnectionFeedback] = useState<{ ok: boolean; message: string } | null>(null)

  const connectionStatus: UiConnectionStatus = connectionData?.status || 'DISCONNECTED'
  const connectionReady = isSessionReadyForTestMessage(connectionStatus)

  const hasTechnicalDetails = (details: TechnicalDetails | null | undefined) => {
    return Boolean(details && (details.statusCode !== undefined || details.endpoint || details.errorCode || details.errorMessage || details.contentType || details.preview))
  }

  const mergeTechnicalDetails = (base: TechnicalDetails | undefined, safe?: SafeApiTechnicalDetails): TechnicalDetails | undefined => {
    if (!base && !safe) return undefined
    const merged: TechnicalDetails = {}

    const statusCode = base?.statusCode ?? safe?.statusCode
    if (statusCode !== undefined) merged.statusCode = statusCode

    if (base?.endpoint) merged.endpoint = base.endpoint
    if (base?.errorCode) merged.errorCode = base.errorCode
    if (base?.errorMessage) merged.errorMessage = base.errorMessage

    const contentType = base?.contentType ?? safe?.contentType
    if (contentType) merged.contentType = contentType

    const preview = base?.preview ?? safe?.preview
    if (preview) merged.preview = preview

    return merged
  }

  const tokenHint = useMemo(() => {
    if (hasGatewayToken) return 'Token já configurado. Preencha apenas se quiser substituir.'
    return 'Token ainda não configurado.'
  }, [hasGatewayToken])

  const webhookTokenHint = useMemo(() => {
    if (hasGatewayWebhookToken) return 'Token de webhook já configurado. Preencha apenas se quiser substituir.'
    return 'Token de webhook ainda não configurado.'
  }, [hasGatewayWebhookToken])

  const loadSettings = async () => {
    try {
      setLoading(true)
      setLoadError(null)

      const response = await fetch('/settings/whatsapp')
      if (!response.ok) throw new Error(await extractApiError(response, 'Falha ao carregar configurações.'))

      const data = (await response.json()) as WhatsAppSettingsResponse
      if (import.meta.env.DEV) {
        console.info('[settings-whatsapp-ui] GET response gatewayBaseUrl', {
          gatewayBaseUrl: data.gatewayBaseUrl,
        })
      }

      const nextGatewayBaseUrl = toInputText(data.gatewayBaseUrl)
      setForm((current) => ({
        ...current,
        gatewayBaseUrl: nextGatewayBaseUrl,
        appBaseUrl: toInputText(data.appBaseUrl),
        defaultTestPhone: toInputText(data.defaultTestPhone),
        provider: data.provider?.toUpperCase() === 'WAHA' ? 'WAHA' : 'EVOLUTION',
        instanceName: toInputText(data.instanceName) || current.instanceName,
        gatewayToken: '',
        gatewayWebhookToken: '',
      }))
      if (import.meta.env.DEV) {
        console.info('[settings-whatsapp-ui] Applied form gatewayBaseUrl', {
          gatewayBaseUrl: nextGatewayBaseUrl,
        })
      }
      setTestPhone(toInputText(data.defaultTestPhone))
      setHasGatewayToken(Boolean(data.hasGatewayToken))
      setHasGatewayWebhookToken(Boolean(data.hasGatewayWebhookToken))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Erro ao carregar configurações de WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  const loadConnectionInfo = async () => {
    try {
      setConnectionLoading(true)
      const response = await fetch('/settings/whatsapp/instance')
      const parsedResponse = await parseHttpResponseSafely<WhatsAppConnectionPayload>(response)
      const parsed = parsedResponse.data

      if (!parsedResponse.ok || !parsed?.ok) {
        const message = parsed?.message
          || parsedResponse.message
          || `Falha ao carregar conexão (HTTP ${response.status}).`
        setConnectionFeedback({ ok: false, message })
        return
      }

      setConnectionData(parsed)
      setConnectionFeedback(null)
    } catch (error) {
      setConnectionFeedback({ ok: false, message: error instanceof Error ? error.message : 'Falha ao carregar conexão.' })
    } finally {
      setConnectionLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
    loadConnectionInfo()
  }, [])

  useEffect(() => {
    if (!connectionData) return
    if (!(connectionData.status === 'WAITING_QR' || connectionData.status === 'CONNECTING')) return

    const timer = setInterval(() => {
      runConnectionAction('status', 'Status atualizado com sucesso.')
    }, 5000)

    return () => clearInterval(timer)
  }, [connectionData?.status])

  const onChangeField = (field: keyof WhatsAppSettingsForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFeedbackSuccess(null)
    setFeedbackError(null)

    try {
      const payload: Record<string, string | null> = {
        gatewayBaseUrl: form.gatewayBaseUrl.trim() || null,
        appBaseUrl: form.appBaseUrl.trim() || null,
        defaultTestPhone: form.defaultTestPhone.trim() || null,
        provider: form.provider,
        instanceName: form.instanceName.trim() || null,
      }

      if (form.gatewayToken.trim()) {
        payload.gatewayToken = form.gatewayToken.trim()
      }

      if (form.gatewayWebhookToken.trim()) {
        payload.gatewayWebhookToken = form.gatewayWebhookToken.trim()
      }

      const response = await fetch('/settings/whatsapp', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (import.meta.env.DEV) {
        console.info('[settings-whatsapp-ui] PUT payload gatewayBaseUrl', {
          gatewayBaseUrl: payload.gatewayBaseUrl,
        })
      }

      if (!response.ok) throw new Error(await extractApiError(response, 'Falha ao salvar configurações.'))

      const updated = (await response.json()) as WhatsAppSettingsResponse
      setForm((current) => ({
        ...current,
        gatewayBaseUrl: toInputText(updated.gatewayBaseUrl),
        appBaseUrl: toInputText(updated.appBaseUrl),
        defaultTestPhone: toInputText(updated.defaultTestPhone),
        provider: updated.provider?.toUpperCase() === 'WAHA' ? 'WAHA' : 'EVOLUTION',
        instanceName: toInputText(updated.instanceName) || current.instanceName,
        gatewayToken: '',
        gatewayWebhookToken: '',
      }))
      setTestPhone((current) => current.trim() || toInputText(updated.defaultTestPhone))
      setHasGatewayToken(Boolean(updated.hasGatewayToken))
      setHasGatewayWebhookToken(Boolean(updated.hasGatewayWebhookToken))
      setFeedbackSuccess('Configurações do WhatsApp salvas com sucesso.')
      await loadConnectionInfo()
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : 'Falha ao salvar configurações de WhatsApp.')
    } finally {
      setSaving(false)
    }
  }

  const runConnectionAction = async (
    action: 'create' | 'connect' | 'refresh-qr' | 'disconnect' | 'status',
    successMessage: string
  ) => {
    try {
      setConnectionActionLoading(action)
      setConnectionFeedback(null)
      const endpoint = action === 'status'
        ? '/settings/whatsapp/instance/status'
        : `/settings/whatsapp/instance/${action}`

      const response = await fetch(endpoint, {
        method: action === 'status' ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json' },
      })

      const parsedResponse = await parseHttpResponseSafely<WhatsAppConnectionPayload>(response)
      const parsed = parsedResponse.data
      if (!parsedResponse.ok || !parsed?.ok) {
        const message = parsed?.message
          || parsedResponse.message
          || `Falha na ação ${action}.`
        setConnectionFeedback({ ok: false, message })
        return
      }

      setConnectionData((current) => {
        if (action !== 'status' || !current) {
          return parsed
        }

        const hasVisualCode = Boolean(current.qrCodeBase64 || current.pairingCode || current.rawCode)
        const shouldPreserveVisualCode = hasVisualCode
          && (parsed.status === 'CONNECTING' || parsed.status === 'WAITING_QR')
          && !parsed.qrCodeBase64
          && !parsed.pairingCode
          && !parsed.rawCode

        if (!shouldPreserveVisualCode) {
          return parsed
        }

        return {
          ...parsed,
          status: current.qrCodeBase64 ? 'WAITING_QR' : parsed.status,
          qrCodeBase64: parsed.qrCodeBase64 ?? current.qrCodeBase64,
          pairingCode: parsed.pairingCode ?? current.pairingCode ?? null,
          rawCode: parsed.rawCode ?? current.rawCode ?? null,
        }
      })
      setConnectionFeedback({ ok: true, message: parsed.message || successMessage })
    } catch (error) {
      setConnectionFeedback({ ok: false, message: error instanceof Error ? error.message : 'Erro ao executar ação de conexão.' })
    } finally {
      setConnectionActionLoading(null)
    }
  }

  const runConnectionTest = async () => {
    setTestingConnection(true)
    setConnectionStatusMessage(null)
    setConnectionStatusOk(null)
    setConnectionTechnicalDetails(null)
    setShowConnectionTechnicalDetails(false)

    try {
      const response = await fetch('/settings/whatsapp/test-connection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      })

      const parsedResponse = await parseHttpResponseSafely<ApiActionResponse>(response)
      const parsed = parsedResponse.data

      const message = parsed?.message || parsedResponse.message || parsedResponse.rawText || 'Falha ao testar conexão com o gateway.'
      if (!parsedResponse.ok || !parsed?.ok) {
        setConnectionStatusOk(false)
        setConnectionStatusMessage(message)
        setConnectionTechnicalDetails(mergeTechnicalDetails(parsed?.technicalDetails, parsedResponse.technicalDetails) ?? null)
        return
      }

      setConnectionStatusOk(true)
      setConnectionStatusMessage(parsed.message || 'Conexão com gateway OK.')
      setConnectionTechnicalDetails(null)
    } catch (error) {
      setConnectionStatusOk(false)
      setConnectionStatusMessage(error instanceof Error ? error.message : 'Erro ao testar conexão com gateway.')
      setConnectionTechnicalDetails({
        errorCode: 'REQUEST_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Erro ao testar conexão com gateway.',
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const sendTestMessage = async () => {
    setSendingTestMessage(true)
    setTestSendFeedback(null)
    setShowTestSendTechnicalDetails(false)

    try {
      const response = await fetch('/settings/whatsapp/send-test-message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone.trim() || undefined,
          message: testMessage.trim() || undefined,
        }),
      })

      const parsedResponse = await parseHttpResponseSafely<ApiActionResponse>(response)
      const parsed = parsedResponse.data

      if (!parsedResponse.ok || !parsed?.ok) {
        const nextFeedback: { ok: boolean; message: string; technicalDetails?: TechnicalDetails } = {
          ok: false,
          message: parsed?.message || parsedResponse.message || parsedResponse.rawText || 'Falha ao enviar mensagem de teste.',
        }
        const mergedTechnical = mergeTechnicalDetails(parsed?.technicalDetails, parsedResponse.technicalDetails)
        if (mergedTechnical) {
          nextFeedback.technicalDetails = mergedTechnical
        }

        setTestSendFeedback({
          ...nextFeedback,
        })
        return
      }

      setTestSendFeedback({
        ok: true,
        message: parsed.message || 'Mensagem de teste enviada com sucesso.',
      })

      if (parsed.phone) {
        setTestPhone(parsed.phone)
      }
    } catch (error) {
      setTestSendFeedback({
        ok: false,
        message: error instanceof Error ? error.message : 'Erro ao enviar mensagem de teste.',
        technicalDetails: {
          errorCode: 'REQUEST_ERROR',
          errorMessage: error instanceof Error ? error.message : 'Erro ao enviar mensagem de teste.',
        },
      })
    } finally {
      setSendingTestMessage(false)
    }
  }

  if (loading) {
    return (
      <div className="section-block">
        <p>Carregando configurações de WhatsApp...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="section-block">
        <p className="feedback-error">Erro ao carregar: {loadError}</p>
        <button type="button" className="table-action" onClick={loadSettings}>Tentar novamente</button>
      </div>
    )
  }

  return (
    <div className="section-block">
      <div className="section-heading">
        <div>
          <h3>Configurações de WhatsApp</h3>
          <p style={{ marginBottom: 0 }}>Persistência de credenciais e URLs de integração com o gateway.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="form-grid">
        <div className="grid-2">
          <label className="field">
            <span className="field-label">URL do gateway</span>
            <input
              type="text"
              value={form.gatewayBaseUrl}
              placeholder="https://gateway.exemplo.com"
              onChange={(event) => onChangeField('gatewayBaseUrl', event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">URL pública do app</span>
            <input
              type="text"
              value={form.appBaseUrl}
              placeholder="https://app.exemplo.com"
              onChange={(event) => onChangeField('appBaseUrl', event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Token da API</span>
            <input
              type="password"
              value={form.gatewayToken}
              placeholder={hasGatewayToken ? '********' : 'Digite o token'}
              onChange={(event) => onChangeField('gatewayToken', event.target.value)}
            />
            <span className="field-hint">{tokenHint}</span>
          </label>

          <label className="field">
            <span className="field-label">Token do webhook</span>
            <input
              type="password"
              value={form.gatewayWebhookToken}
              placeholder={hasGatewayWebhookToken ? '********' : 'Digite o token do webhook'}
              onChange={(event) => onChangeField('gatewayWebhookToken', event.target.value)}
            />
            <span className="field-hint">{webhookTokenHint}</span>
          </label>

          <label className="field">
            <span className="field-label">Número padrão para teste</span>
            <input
              type="tel"
              value={form.defaultTestPhone}
              placeholder="+5511999999999"
              onChange={(event) => onChangeField('defaultTestPhone', event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Provider</span>
            <select value={form.provider} onChange={(event) => onChangeField('provider', event.target.value as 'EVOLUTION' | 'WAHA')}>
              <option value="EVOLUTION">EVOLUTION</option>
              <option value="WAHA">WAHA</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">Nome da instância</span>
            <input
              type="text"
              value={form.instanceName}
              placeholder="assist-tech-main"
              onChange={(event) => onChangeField('instanceName', event.target.value)}
            />
          </label>
        </div>

        {feedbackSuccess ? <p className="feedback-success">{feedbackSuccess}</p> : null}
        {feedbackError ? <p className="feedback-error">{feedbackError}</p> : null}

        <div className="form-actions">
          <button className="button-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </form>

      <div className="section-block soft" style={{ marginTop: 16 }}>
        <div className="section-heading" style={{ marginBottom: 10 }}>
          <div>
            <h4 style={{ marginBottom: 6 }}>Conexão do WhatsApp</h4>
            <p style={{ marginBottom: 0 }}>Crie a instância, gere o QR Code e acompanhe o status da sessão.</p>
          </div>
        </div>

        {connectionLoading ? <p>Carregando dados de conexão...</p> : null}
        {connectionFeedback ? <p className={connectionFeedback.ok ? 'feedback-success' : 'feedback-error'}>{connectionFeedback.message}</p> : null}

        <div className="grid-2" style={{ marginBottom: 12 }}>
          <div className="info-row"><strong>Provider</strong><span>{connectionData?.provider || form.provider}</span></div>
          <div className="info-row"><strong>Instância</strong><span>{connectionData?.instanceName || form.instanceName || '-'}</span></div>
          <div className="info-row"><strong>Status atual</strong><span><WhatsAppConnectionStatusBadge status={connectionStatus} /></span></div>
          <div className="info-row"><strong>Número conectado</strong><span>{connectionData?.phoneNumber || '-'}</span></div>
          <div className="info-row"><strong>Pairing code</strong><span>{connectionData?.pairingCode || '-'}</span></div>
          <div className="info-row"><strong>Última atualização</strong><span>{connectionData?.updatedAt ? new Date(connectionData.updatedAt).toLocaleString('pt-BR') : '-'}</span></div>
          <div className="info-row"><strong>Resumo</strong><span>{connectionData?.statusLabel || getConnectionStatusLabel(connectionStatus)}</span></div>
        </div>

        <WhatsAppQrCodePanel
          status={connectionStatus}
          qrCodeBase64={connectionData?.qrCodeBase64 || null}
          pairingCode={connectionData?.pairingCode || null}
          rawCode={connectionData?.rawCode || null}
        />

        <div className="form-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 12 }}>
          <button className="table-action" type="button" disabled={Boolean(connectionActionLoading)} onClick={() => runConnectionAction('create', 'Instância criada com sucesso.')}>{connectionActionLoading === 'create' ? 'Criando instância...' : 'Criar instância'}</button>
          <button className="table-action" type="button" disabled={Boolean(connectionActionLoading)} onClick={() => runConnectionAction('connect', 'Conexão iniciada. QR Code atualizado.')}>{connectionActionLoading === 'connect' ? 'Gerando conexão...' : 'Gerar / conectar QR Code'}</button>
          <button className="table-action" type="button" disabled={Boolean(connectionActionLoading)} onClick={() => runConnectionAction('status', 'Status atualizado com sucesso.')}>{connectionActionLoading === 'status' ? 'Atualizando status...' : 'Atualizar status'}</button>
          <button className="table-action" type="button" disabled={Boolean(connectionActionLoading)} onClick={() => runConnectionAction('refresh-qr', 'QR Code atualizado com sucesso.')}>{connectionActionLoading === 'refresh-qr' ? 'Atualizando QR Code...' : 'Atualizar QR Code'}</button>
          <button className="table-action" type="button" disabled={Boolean(connectionActionLoading)} onClick={() => runConnectionAction('disconnect', 'Instância desconectada com sucesso.')}>{connectionActionLoading === 'disconnect' ? 'Desconectando...' : 'Desconectar'}</button>
        </div>
      </div>

      <div className="section-block soft" style={{ marginTop: 16 }}>
        <div className="section-heading" style={{ marginBottom: 10 }}>
          <div>
            <h4 style={{ marginBottom: 6 }}>Status da conexão</h4>
            <p style={{ marginBottom: 0 }}>Verifique se o gateway está acessível com as credenciais configuradas.</p>
          </div>
        </div>
        {connectionStatusMessage ? (
          <p className={connectionStatusOk ? 'feedback-success' : 'feedback-error'}>{connectionStatusMessage}</p>
        ) : (
          <p className="field-hint">Nenhum teste executado ainda.</p>
        )}

        {!connectionStatusOk && hasTechnicalDetails(connectionTechnicalDetails) ? (
          <div>
            <button
              type="button"
              className="table-action"
              onClick={() => setShowConnectionTechnicalDetails((current) => !current)}
            >
              {showConnectionTechnicalDetails ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos'}
            </button>
            {showConnectionTechnicalDetails ? (
              <div className="section-block" style={{ marginTop: 10, padding: 12 }}>
                {connectionTechnicalDetails?.statusCode !== undefined ? <p><strong>Status HTTP:</strong> {connectionTechnicalDetails.statusCode}</p> : null}
                {connectionTechnicalDetails?.endpoint ? <p><strong>Endpoint:</strong> {connectionTechnicalDetails.endpoint}</p> : null}
                {connectionTechnicalDetails?.contentType ? <p><strong>Content-Type:</strong> {connectionTechnicalDetails.contentType}</p> : null}
                {connectionTechnicalDetails?.preview ? <p><strong>Preview:</strong> {connectionTechnicalDetails.preview}</p> : null}
                {connectionTechnicalDetails?.errorCode ? <p><strong>Código:</strong> {connectionTechnicalDetails.errorCode}</p> : null}
                {connectionTechnicalDetails?.errorMessage ? <p><strong>Descrição:</strong> {connectionTechnicalDetails.errorMessage}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="button-primary" type="button" onClick={runConnectionTest} disabled={testingConnection}>
            {testingConnection ? 'Testando conexão...' : 'Testar conexão'}
          </button>
        </div>
      </div>

      <div className="section-block soft" style={{ marginTop: 16 }}>
        <div className="section-heading" style={{ marginBottom: 10 }}>
          <div>
            <h4 style={{ marginBottom: 6 }}>Envio de mensagem de teste</h4>
            <p style={{ marginBottom: 0 }}>Dispare um texto simples para validar integração de envio.</p>
          </div>
        </div>

        <p className={connectionReady ? 'feedback-success' : 'feedback-error'}>
          {connectionReady
            ? 'Sessão conectada e pronta para envio.'
            : 'Conecte o WhatsApp via QR Code antes de enviar mensagens de teste.'}
        </p>

        <div className="form-grid">
          <label className="field">
            <span className="field-label">Número para teste</span>
            <input
              type="tel"
              value={testPhone}
              placeholder="+5511999999999"
              onChange={(event) => setTestPhone(event.target.value)}
            />
            <span className="field-hint">Se ficar vazio, o backend tenta usar o número padrão salvo nas configurações.</span>
          </label>

          <label className="field">
            <span className="field-label">Mensagem de teste (opcional)</span>
            <textarea
              value={testMessage}
              placeholder="Teste de integração WhatsApp do Assist Tech Laudos."
              onChange={(event) => setTestMessage(event.target.value)}
              rows={4}
            />
          </label>
        </div>

        {testSendFeedback ? (
          <p className={testSendFeedback.ok ? 'feedback-success' : 'feedback-error'}>{testSendFeedback.message}</p>
        ) : (
          <p className="field-hint">Nenhum envio de teste realizado ainda.</p>
        )}

        {testSendFeedback && !testSendFeedback.ok && hasTechnicalDetails(testSendFeedback.technicalDetails) ? (
          <div>
            <button
              type="button"
              className="table-action"
              onClick={() => setShowTestSendTechnicalDetails((current) => !current)}
            >
              {showTestSendTechnicalDetails ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos'}
            </button>
            {showTestSendTechnicalDetails ? (
              <div className="section-block" style={{ marginTop: 10, padding: 12 }}>
                {testSendFeedback.technicalDetails?.statusCode !== undefined ? <p><strong>Status HTTP:</strong> {testSendFeedback.technicalDetails.statusCode}</p> : null}
                {testSendFeedback.technicalDetails?.endpoint ? <p><strong>Endpoint:</strong> {testSendFeedback.technicalDetails.endpoint}</p> : null}
                {testSendFeedback.technicalDetails?.contentType ? <p><strong>Content-Type:</strong> {testSendFeedback.technicalDetails.contentType}</p> : null}
                {testSendFeedback.technicalDetails?.preview ? <p><strong>Preview:</strong> {testSendFeedback.technicalDetails.preview}</p> : null}
                {testSendFeedback.technicalDetails?.errorCode ? <p><strong>Código:</strong> {testSendFeedback.technicalDetails.errorCode}</p> : null}
                {testSendFeedback.technicalDetails?.errorMessage ? <p><strong>Descrição:</strong> {testSendFeedback.technicalDetails.errorMessage}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="button-primary" type="button" onClick={sendTestMessage} disabled={sendingTestMessage || !connectionReady}>
            {sendingTestMessage ? 'Enviando teste...' : 'Enviar mensagem de teste'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="sheet">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Configurações</p>
          <h2>Integrações</h2>
          <p style={{ marginBottom: 0 }}>Gerencie parâmetros de integração sem editar variáveis de ambiente manualmente.</p>
        </div>
      </div>

      <div className="report-content">
        <WhatsAppSettingsSection />
        <div className="section-block soft">
          <h4 style={{ marginBottom: 8 }}>Próximo passo</h4>
          <p style={{ marginBottom: 0 }}>
            Nesta etapa, o módulo cobre leitura e gravação das configurações, teste de conexão com gateway, sessão por QR Code e envio de mensagem de teste em texto.
          </p>
        </div>
      </div>
    </div>
  )
}
