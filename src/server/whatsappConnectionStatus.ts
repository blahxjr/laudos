export type WhatsAppProvider = 'EVOLUTION' | 'WAHA'

export type NormalizedWhatsAppConnectionStatus =
  | 'DISCONNECTED'
  | 'STARTING'
  | 'WAITING_QR'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'FAILED'

const normalizeString = (value: unknown) => String(value ?? '').trim().toUpperCase()

export const normalizeWhatsAppConnectionStatus = (
  providerStatus: unknown,
  provider: WhatsAppProvider
): NormalizedWhatsAppConnectionStatus => {
  const status = normalizeString(providerStatus)

  if (!status) return 'DISCONNECTED'

  if (provider === 'WAHA') {
    if (status === 'STOPPED') return 'DISCONNECTED'
    if (status === 'STARTING') return 'STARTING'
    if (status === 'SCAN_QR_CODE' || status.includes('QR')) return 'WAITING_QR'
    if (status === 'WORKING' || status === 'CONNECTED') return 'CONNECTED'
    if (status === 'FAILED' || status.includes('ERROR') || status.includes('AUTH')) return 'FAILED'
    if (status.includes('CONNECT')) return 'CONNECTING'
    return 'CONNECTING'
  }

  // Evolution-style normalization by keywords to avoid rigid coupling.
  if (status.includes('OPEN') || status === 'CONNECTED' || status === 'ONLINE') return 'CONNECTED'
  if (status.includes('QR') || status.includes('SCAN')) return 'WAITING_QR'
  if (status.includes('START')) return 'STARTING'
  if (status.includes('CONNECT')) return 'CONNECTING'
  if (status.includes('FAIL') || status.includes('ERROR') || status.includes('AUTH')) return 'FAILED'
  if (status.includes('CLOSE') || status.includes('DISCONNECT') || status.includes('OFFLINE')) return 'DISCONNECTED'

  return 'CONNECTING'
}

export const getWhatsAppConnectionStatusLabel = (status: NormalizedWhatsAppConnectionStatus) => {
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
