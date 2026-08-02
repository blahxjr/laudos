import React from 'react'

export type UiConnectionStatus = 'DISCONNECTED' | 'STARTING' | 'WAITING_QR' | 'CONNECTING' | 'CONNECTED' | 'FAILED'

export const getConnectionStatusLabel = (status: UiConnectionStatus) => {
  switch (status) {
    case 'DISCONNECTED':
      return 'Desconectado'
    case 'STARTING':
      return 'Iniciando'
    case 'WAITING_QR':
      return 'Aguardando QR Code'
    case 'CONNECTING':
      return 'Conectando'
    case 'CONNECTED':
      return 'Conectado'
    case 'FAILED':
      return 'Falha'
    default:
      return status
  }
}

export const getConnectionStatusClassName = (status: UiConnectionStatus) => {
  switch (status) {
    case 'CONNECTED':
      return 'status-pill status-connected'
    case 'WAITING_QR':
      return 'status-pill status-waiting-qr'
    case 'CONNECTING':
      return 'status-pill status-connecting'
    case 'STARTING':
      return 'status-pill status-pending'
    case 'FAILED':
      return 'status-pill status-failed'
    case 'DISCONNECTED':
    default:
      return 'status-pill status-disconnected'
  }
}

export const shouldShowQrCode = (status: UiConnectionStatus, qrCodeBase64?: string | null) => {
  return status === 'WAITING_QR' && Boolean(qrCodeBase64)
}

export const isSessionReadyForTestMessage = (status: UiConnectionStatus) => status === 'CONNECTED'

export function WhatsAppConnectionStatusBadge({ status }: { status: UiConnectionStatus }) {
  return <span className={getConnectionStatusClassName(status)}>{getConnectionStatusLabel(status)}</span>
}

export function WhatsAppQrCodePanel({
  status,
  qrCodeBase64,
  pairingCode,
  rawCode,
}: {
  status: UiConnectionStatus
  qrCodeBase64?: string | null
  pairingCode?: string | null
  rawCode?: string | null
}) {
  if (shouldShowQrCode(status, qrCodeBase64)) {
    return (
      <div className="section-block" style={{ padding: 16 }}>
        <img src={qrCodeBase64 || ''} alt="QR Code WhatsApp" style={{ width: 260, maxWidth: '100%', borderRadius: 12, border: '1px solid #dbe3ee', background: '#fff' }} />
        {pairingCode ? (
          <p style={{ marginTop: 10, marginBottom: 0 }}>
            <strong>Codigo de pareamento:</strong> {pairingCode}
          </p>
        ) : null}
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          Abra o WhatsApp no celular, vá em Aparelhos conectados, clique em Conectar aparelho e escaneie o QR Code.
        </p>
      </div>
    )
  }

  if ((status === 'WAITING_QR' || status === 'CONNECTING') && pairingCode) {
    return (
      <div className="section-block" style={{ padding: 16 }}>
        <p style={{ marginBottom: 6 }}><strong>Codigo de pareamento:</strong></p>
        <p style={{ fontFamily: 'monospace', fontSize: 18, marginTop: 0 }}>{pairingCode}</p>
        <p style={{ marginBottom: 0 }}>
          Use este codigo no WhatsApp caso o gateway nao forneca imagem do QR Code.
        </p>
      </div>
    )
  }

  if (status === 'CONNECTED') {
    return (
      <div className="section-block" style={{ padding: 16 }}>
        <p className="feedback-success" style={{ marginBottom: 0 }}>Sessão conectada e pronta para envio.</p>
      </div>
    )
  }

  if (status === 'FAILED') {
    return (
      <div className="section-block" style={{ padding: 16 }}>
        <p className="feedback-error" style={{ marginBottom: 0 }}>Falha na autenticação da sessão. Gere um novo QR Code.</p>
      </div>
    )
  }

  return (
    <div className="section-block" style={{ padding: 16 }}>
      <p style={{ marginBottom: 0 }}>Nenhum QR Code disponível no momento.</p>
      {rawCode ? (
        <p className="field-hint" style={{ marginBottom: 0 }}>
          Codigo retornado pelo gateway: {rawCode}
        </p>
      ) : null}
    </div>
  )
}
