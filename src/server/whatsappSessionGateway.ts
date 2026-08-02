import { normalizeWhatsAppConnectionStatus, type NormalizedWhatsAppConnectionStatus, type WhatsAppProvider } from './whatsappConnectionStatus.js'
import { sendWhatsAppTextMessage } from '../whatsappGateway.js'

export type WhatsAppSessionGatewayConfig = {
  provider: WhatsAppProvider
  gatewayBaseUrl: string
  gatewayToken: string
  instanceName: string
}

type GatewayResponse = {
  status: number
  body: any
}

export type SafeHttpResponse = {
  status: number
  ok: boolean
  contentType: string
  jsonBody: any | null
  textBody: string
}

export type NormalizedEvolutionConnectResponse = {
  status: 'WAITING_QR' | 'CONNECTING' | 'CONNECTED'
  qrCodeBase64: string | null
  pairingCode: string | null
  rawCode: string | null
}

export type WhatsAppSessionResult = {
  status: NormalizedWhatsAppConnectionStatus
  providerStatus?: string
  qrCodeBase64?: string | null
  phoneNumber?: string | null
  pairingCode?: string | null
  rawCode?: string | null
  errorCode?: string | null
  errorMessage?: string | null
  endpoint?: string
  technicalDetails?: {
    statusCode?: number
    contentType?: string
    preview?: string
  }
}

const sanitizeUrl = (raw: string) => {
  const parsed = new URL(raw)
  parsed.username = ''
  parsed.password = ''
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString().replace(/\/$/, '')
}

const toSafePreview = (text: string, maxLength = 200) => {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.slice(0, maxLength)
}

const maskSecrets = (text: string, secrets: string[]) => {
  return secrets.reduce((acc, secret) => {
    if (!secret) return acc
    return acc.split(secret).join('[redacted]')
  }, text)
}

export const parseHttpResponseSafely = async (
  response: Response,
  options?: { secrets?: string[] }
): Promise<SafeHttpResponse> => {
  const responseLike = response as any
  const status = typeof responseLike?.status === 'number' ? responseLike.status : 500
  const ok = typeof responseLike?.ok === 'boolean' ? responseLike.ok : status >= 200 && status < 300
  const contentType = typeof responseLike?.headers?.get === 'function'
    ? String(responseLike.headers.get('content-type') || '').toLowerCase()
    : ''
  const textBody = typeof responseLike?.text === 'function'
    ? await responseLike.text().catch(() => '')
    : ''
  const sanitizedText = maskSecrets(textBody, options?.secrets ?? [])
  const trimmedBody = sanitizedText.trim()
  const isJson = contentType.includes('application/json') || contentType.includes('+json')
  const isJsonLike = isJson || (!contentType && (trimmedBody.startsWith('{') || trimmedBody.startsWith('[')))

  if (!isJsonLike) {
    return {
      status,
      ok,
      contentType,
      jsonBody: null,
      textBody: sanitizedText,
    }
  }

  if (!trimmedBody) {
    return {
      status,
      ok,
      contentType,
      jsonBody: {},
      textBody: sanitizedText,
    }
  }

  try {
    return {
      status,
      ok,
      contentType,
      jsonBody: JSON.parse(sanitizedText),
      textBody: sanitizedText,
    }
  } catch {
    return {
      status,
      ok: false,
      contentType,
      jsonBody: null,
      textBody: sanitizedText,
    }
  }
}

const normalizeQrCodeData = (qrValue: unknown): string | null => {
  if (typeof qrValue !== 'string' || !qrValue.trim()) return null
  const trimmed = qrValue.trim()
  if (trimmed.startsWith('data:image')) return trimmed
  return `data:image/png;base64,${trimmed}`
}

const toOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

const extractNestedValue = (body: any, paths: string[]): unknown => {
  for (const path of paths) {
    const fragments = path.split('.')
    let cursor: any = body
    let found = true
    for (const fragment of fragments) {
      if (cursor && typeof cursor === 'object' && fragment in cursor) {
        cursor = cursor[fragment]
      } else {
        found = false
        break
      }
    }
    if (found && cursor !== undefined && cursor !== null) return cursor
  }
  return undefined
}

export const normalizeEvolutionConnectResponse = (payload: any): NormalizedEvolutionConnectResponse => {
  const qrCandidate = extractNestedValue(payload, [
    'base64',
    'response.base64',
    'qrcode.base64',
    'response.qrcode.base64',
    'qrcode',
    'response.qrcode',
    'instance.qrcode',
    'instance.qrCode',
    'data.qrcode',
    'data.qrCode',
  ])

  const pairingCode = toOptionalString(extractNestedValue(payload, [
    'pairingCode',
    'response.pairingCode',
    'pairing.code',
    'response.pairing.code',
  ]))

  const rawCode = toOptionalString(extractNestedValue(payload, [
    'code',
    'response.code',
    'qrcode.code',
    'response.qrcode.code',
  ]))

  const qrCodeBase64 = normalizeQrCodeData(qrCandidate)
  const providerStatus = extractProviderStatus(payload)
  const mappedStatus = normalizeWhatsAppConnectionStatus(providerStatus || 'CONNECTING', 'EVOLUTION')

  if (mappedStatus === 'CONNECTED') {
    return {
      status: 'CONNECTED',
      qrCodeBase64: null,
      pairingCode,
      rawCode,
    }
  }

  if (qrCodeBase64 || pairingCode || rawCode) {
    return {
      status: 'WAITING_QR',
      qrCodeBase64,
      pairingCode,
      rawCode,
    }
  }

  return {
    status: 'CONNECTING',
    qrCodeBase64: null,
    pairingCode,
    rawCode,
  }
}

const extractProviderStatus = (body: any): string => {
  return String(
    body?.status
      ?? body?.state
      ?? body?.instance?.status
      ?? body?.instance?.state
      ?? body?.connectionStatus
      ?? body?.session?.status
      ?? ''
  )
}

const extractPhoneNumber = (body: any): string | null => {
  const candidate = body?.phoneNumber
    ?? body?.number
    ?? body?.instance?.phone
    ?? body?.instance?.number
    ?? body?.session?.phone
    ?? body?.session?.number

  if (typeof candidate !== 'string') return null
  const trimmed = candidate.trim()
  return trimmed || null
}

const extractQrCode = (body: any): string | null => {
  const candidate = body?.qrCode
    ?? body?.qrcode
    ?? body?.qr
    ?? body?.base64
    ?? body?.instance?.qrCode
    ?? body?.instance?.qrcode
    ?? body?.session?.qr

  return normalizeQrCodeData(candidate)
}

const isAlreadyInUseError = (status: number, body: any) => {
  if (status !== 403) return false
  const combined = [body?.message, body?.error, body?.response?.message]
    .map((item) => String(item ?? '').toLowerCase())
    .join(' ')
  return combined.includes('already in use') || combined.includes('already exists')
}

const extractTechnicalDetails = (body: any): { statusCode?: number; contentType?: string; preview?: string } | null => {
  const source = body?.technicalDetails
  if (!source || typeof source !== 'object') return null

  const details: { statusCode?: number; contentType?: string; preview?: string } = {}

  if (typeof source.statusCode === 'number') details.statusCode = source.statusCode
  if (typeof source.contentType === 'string' && source.contentType.trim()) details.contentType = source.contentType
  if (typeof source.preview === 'string' && source.preview.trim()) details.preview = source.preview

  return Object.keys(details).length > 0 ? details : null
}

const requestCandidates = async (
  baseUrl: string,
  token: string,
  candidates: Array<{ method: 'GET' | 'POST' | 'DELETE'; path: string; body?: unknown }>
): Promise<GatewayResponse> => {
  let lastResponse: GatewayResponse = { status: 500, body: { error: 'No endpoint candidates executed.' } }

  for (const candidate of candidates) {
    const endpoint = `${baseUrl}${candidate.path}`
    try {
      const requestInit: RequestInit = {
        method: candidate.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: token,
          'x-api-key': token,
        },
      }
      if (candidate.body) {
        requestInit.body = JSON.stringify(candidate.body)
      }

      const response = await fetch(endpoint, requestInit)

      const safe = await parseHttpResponseSafely(response, { secrets: [token] })

      if (!safe.jsonBody && safe.textBody) {
        lastResponse = {
          status: safe.status,
          body: {
            _endpoint: endpoint,
            errorCode: 'UNEXPECTED_CONTENT_TYPE',
            message: 'Gateway respondeu em formato inesperado',
            technicalDetails: {
              statusCode: safe.status,
              contentType: safe.contentType || 'unknown',
              preview: toSafePreview(safe.textBody),
            },
          },
        }
      } else {
        lastResponse = {
          status: safe.status,
          body: {
            ...(safe.jsonBody ?? {}),
            _endpoint: endpoint,
            _contentType: safe.contentType || 'application/json',
          },
        }
      }

      if (response.ok || response.status !== 404) {
        return lastResponse
      }
    } catch (error) {
      lastResponse = {
        status: 503,
        body: {
          _endpoint: endpoint,
          errorCode: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Gateway request failed',
        },
      }
      return lastResponse
    }
  }

  return lastResponse
}

export const createWhatsAppSessionGateway = (config: WhatsAppSessionGatewayConfig) => {
  const baseUrl = sanitizeUrl(config.gatewayBaseUrl)

  const createInstance = async (): Promise<WhatsAppSessionResult> => {
    const candidates = config.provider === 'WAHA'
      ? [
          { method: 'POST' as const, path: `/api/sessions/${encodeURIComponent(config.instanceName)}/start` },
          { method: 'POST' as const, path: `/sessions/${encodeURIComponent(config.instanceName)}/start` },
        ]
      : [
          { method: 'POST' as const, path: '/instance/create', body: { instanceName: config.instanceName } },
          { method: 'POST' as const, path: '/instances', body: { name: config.instanceName } },
        ]

    const response = await requestCandidates(baseUrl, config.gatewayToken, candidates)
    const providerStatus = extractProviderStatus(response.body)
    const alreadyInUse = config.provider === 'EVOLUTION' && isAlreadyInUseError(response.status, response.body)
    const requestSucceeded = response.status < 400 || alreadyInUse
    const technicalDetails = extractTechnicalDetails(response.body)

    return {
      status: normalizeWhatsAppConnectionStatus(providerStatus || 'STARTING', config.provider),
      providerStatus,
      endpoint: response.body?._endpoint,
      errorCode: requestSucceeded ? null : String(response.body?.errorCode ?? 'HTTP_ERROR'),
      errorMessage: alreadyInUse
        ? 'Instância já existente. Reutilizando conexão.'
        : requestSucceeded
          ? null
          : String(response.body?.message ?? `HTTP ${response.status}`),
      ...(technicalDetails ? { technicalDetails } : {}),
    }
  }

  const connectInstance = async (): Promise<WhatsAppSessionResult> => {
    const candidates = config.provider === 'WAHA'
      ? [
          { method: 'POST' as const, path: `/api/sessions/${encodeURIComponent(config.instanceName)}/connect` },
          { method: 'POST' as const, path: `/sessions/${encodeURIComponent(config.instanceName)}/connect` },
        ]
      : [
          { method: 'GET' as const, path: `/instance/connect/${encodeURIComponent(config.instanceName)}` },
          { method: 'POST' as const, path: '/instance/connect', body: { instanceName: config.instanceName } },
        ]

    const response = await requestCandidates(baseUrl, config.gatewayToken, candidates)
    const providerStatus = extractProviderStatus(response.body)
    const evolutionData = config.provider === 'EVOLUTION'
      ? normalizeEvolutionConnectResponse(response.body)
      : null

    const status = evolutionData
      ? evolutionData.status
      : normalizeWhatsAppConnectionStatus(providerStatus || 'CONNECTING', config.provider)

    const qrCodeBase64 = evolutionData
      ? evolutionData.qrCodeBase64
      : extractQrCode(response.body)
    const technicalDetails = extractTechnicalDetails(response.body)

    return {
      status,
      providerStatus,
      qrCodeBase64,
      pairingCode: evolutionData?.pairingCode ?? null,
      rawCode: evolutionData?.rawCode ?? null,
      phoneNumber: extractPhoneNumber(response.body),
      endpoint: response.body?._endpoint,
      errorCode: response.status >= 400 ? String(response.body?.errorCode ?? 'HTTP_ERROR') : null,
      errorMessage: response.status >= 400 ? String(response.body?.message ?? `HTTP ${response.status}`) : null,
      ...(technicalDetails ? { technicalDetails } : {}),
    }
  }

  const fetchQrCode = async (): Promise<WhatsAppSessionResult> => {
    const candidates = config.provider === 'WAHA'
      ? [
          { method: 'GET' as const, path: `/api/sessions/${encodeURIComponent(config.instanceName)}/qr` },
          { method: 'GET' as const, path: `/sessions/${encodeURIComponent(config.instanceName)}/qr` },
        ]
      : [
          { method: 'GET' as const, path: `/instance/connect/${encodeURIComponent(config.instanceName)}` },
          { method: 'GET' as const, path: `/instance/qrcode/${encodeURIComponent(config.instanceName)}` },
        ]

    const response = await requestCandidates(baseUrl, config.gatewayToken, candidates)
    const providerStatus = extractProviderStatus(response.body)
    const evolutionData = config.provider === 'EVOLUTION'
      ? normalizeEvolutionConnectResponse(response.body)
      : null

    const qrCodeBase64 = evolutionData ? evolutionData.qrCodeBase64 : extractQrCode(response.body)
    const normalizedStatus = evolutionData
      ? evolutionData.status
      : qrCodeBase64
        ? 'WAITING_QR'
        : normalizeWhatsAppConnectionStatus(providerStatus || 'CONNECTING', config.provider)
    const technicalDetails = extractTechnicalDetails(response.body)

    return {
      status: normalizedStatus,
      providerStatus,
      qrCodeBase64,
      pairingCode: evolutionData?.pairingCode ?? null,
      rawCode: evolutionData?.rawCode ?? null,
      phoneNumber: extractPhoneNumber(response.body),
      endpoint: response.body?._endpoint,
      errorCode: response.status >= 400 ? String(response.body?.errorCode ?? 'HTTP_ERROR') : null,
      errorMessage: response.status >= 400 ? String(response.body?.message ?? `HTTP ${response.status}`) : null,
      ...(technicalDetails ? { technicalDetails } : {}),
    }
  }

  const getConnectionStatus = async (): Promise<WhatsAppSessionResult> => {
    const candidates = config.provider === 'WAHA'
      ? [
          { method: 'GET' as const, path: `/api/sessions/${encodeURIComponent(config.instanceName)}` },
          { method: 'GET' as const, path: `/sessions/${encodeURIComponent(config.instanceName)}` },
        ]
      : [
          { method: 'GET' as const, path: `/instance/connectionState/${encodeURIComponent(config.instanceName)}` },
          { method: 'GET' as const, path: `/instance/status/${encodeURIComponent(config.instanceName)}` },
        ]

    const response = await requestCandidates(baseUrl, config.gatewayToken, candidates)
    const providerStatus = extractProviderStatus(response.body)
    const technicalDetails = extractTechnicalDetails(response.body)
    return {
      status: normalizeWhatsAppConnectionStatus(providerStatus || 'DISCONNECTED', config.provider),
      providerStatus,
      phoneNumber: extractPhoneNumber(response.body),
      qrCodeBase64: extractQrCode(response.body),
      endpoint: response.body?._endpoint,
      errorCode: response.status >= 400 ? String(response.body?.errorCode ?? 'HTTP_ERROR') : null,
      errorMessage: response.status >= 400 ? String(response.body?.message ?? `HTTP ${response.status}`) : null,
      ...(technicalDetails ? { technicalDetails } : {}),
    }
  }

  const disconnectInstance = async (): Promise<WhatsAppSessionResult> => {
    const candidates = config.provider === 'WAHA'
      ? [
          { method: 'POST' as const, path: `/api/sessions/${encodeURIComponent(config.instanceName)}/logout` },
          { method: 'POST' as const, path: `/sessions/${encodeURIComponent(config.instanceName)}/logout` },
          { method: 'DELETE' as const, path: `/sessions/${encodeURIComponent(config.instanceName)}` },
        ]
      : [
          { method: 'DELETE' as const, path: `/instance/logout/${encodeURIComponent(config.instanceName)}` },
          { method: 'POST' as const, path: '/instance/logout', body: { instanceName: config.instanceName } },
        ]

    const response = await requestCandidates(baseUrl, config.gatewayToken, candidates)
    const technicalDetails = extractTechnicalDetails(response.body)
    return {
      status: 'DISCONNECTED',
      endpoint: response.body?._endpoint,
      errorCode: response.status >= 400 ? String(response.body?.errorCode ?? 'HTTP_ERROR') : null,
      errorMessage: response.status >= 400 ? String(response.body?.message ?? `HTTP ${response.status}`) : null,
      ...(technicalDetails ? { technicalDetails } : {}),
    }
  }

  const sendTestMessage = async (phone: string, text: string) => {
    return sendWhatsAppTextMessage({
      phone,
      text,
      gatewayBaseUrl: baseUrl,
      gatewayToken: config.gatewayToken,
      provider: config.provider,
      instanceName: config.instanceName,
    })
  }

  return {
    createInstance,
    connectInstance,
    fetchQrCode,
    getConnectionStatus,
    disconnectInstance,
    sendTestMessage,
  }
}
