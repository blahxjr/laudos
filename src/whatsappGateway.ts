export type SendWhatsAppTextMessageInput = {
  phone: string
  text: string
  gatewayBaseUrl?: string | null
  gatewayToken?: string | null
  provider?: string | null
  instanceName?: string | null
}

export type SendWhatsAppTextMessageResult = {
  ok: boolean
  error?: string
  response?: unknown
  technicalDetails?: {
    statusCode?: number
    endpoint?: string
    errorCode?: string
    errorMessage?: string
  }
}

export type WhatsAppGatewayConnectionInput = {
  gatewayBaseUrl?: string | null
  gatewayToken?: string | null
}

export type WhatsAppGatewayConnectionResult = {
  ok: boolean
  message: string
  status?: number
  technicalDetails?: {
    statusCode?: number
    endpoint?: string
    errorCode?: string
    errorMessage?: string
  }
}

const buildSafeEndpoint = (gatewayBaseUrl: string, path: string) => {
  try {
    const url = new URL(gatewayBaseUrl)
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    url.pathname = `${url.pathname.replace(/\/$/, '')}${normalizedPath}`
    return url.toString()
  } catch {
    return `${gatewayBaseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  }
}

const resolveGatewayConfig = (input?: {
  gatewayBaseUrl?: string | null
  gatewayToken?: string | null
  provider?: string | null
  instanceName?: string | null
}) => {
  const gatewayBaseUrl = input?.gatewayBaseUrl?.trim() || process.env.WHATSAPP_GATEWAY_BASE_URL?.trim()
  const gatewayToken = input?.gatewayToken?.trim() || process.env.WHATSAPP_GATEWAY_TOKEN?.trim()
  const provider = input?.provider?.trim()?.toUpperCase()
    || process.env.WHATSAPP_PROVIDER?.trim()?.toUpperCase()
    || 'EVOLUTION'
  const instanceName = input?.instanceName?.trim()
    || process.env.WHATSAPP_INSTANCE_NAME?.trim()
    || 'assist-tech-main'

  return { gatewayBaseUrl, gatewayToken, provider, instanceName }
}

const normalizePhoneDigits = (value: string) => value.replace(/[^0-9]/g, '')

export async function testWhatsAppGatewayConnection(input?: WhatsAppGatewayConnectionInput): Promise<WhatsAppGatewayConnectionResult> {
  const { gatewayBaseUrl, gatewayToken } = resolveGatewayConfig(input)
  if (!gatewayBaseUrl || !gatewayToken) {
    return {
      ok: false,
      message: 'Configuração do gateway WhatsApp ausente.',
      technicalDetails: {
        errorCode: 'MISSING_GATEWAY_CONFIG',
        errorMessage: 'gatewayBaseUrl e/ou gatewayToken ausentes.',
      },
    }
  }

  try {
    const normalizedBaseUrl = gatewayBaseUrl.replace(/\/$/, '')
    const candidates = ['/health', '/instance/fetchInstances', '/']
    let lastFailure: WhatsAppGatewayConnectionResult | null = null

    for (const path of candidates) {
      const endpoint = buildSafeEndpoint(normalizedBaseUrl, path)
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${gatewayToken}`,
          apikey: gatewayToken,
          'x-api-key': gatewayToken,
        },
      })

      if (response.ok) {
        return { ok: true, message: 'Conexão com gateway OK.', status: response.status }
      }

      const responseText = await response.text().catch(() => '')
      lastFailure = {
        ok: false,
        message: responseText || `Falha ao conectar ao gateway (${response.status}).`,
        status: response.status,
        technicalDetails: {
          statusCode: response.status,
          endpoint,
          errorCode: 'HTTP_ERROR',
          errorMessage: responseText || `Resposta HTTP ${response.status}`,
        },
      }

      if (response.status === 401 || response.status === 403) {
        return lastFailure
      }
    }

    if (lastFailure) {
      return lastFailure
    }

    return {
      ok: false,
      message: 'Falha ao conectar ao gateway.',
      technicalDetails: {
        errorCode: 'HTTP_ERROR',
        errorMessage: 'Nenhum endpoint de verificação respondeu com sucesso.',
      },
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Falha inesperada ao conectar ao gateway.',
      technicalDetails: {
        endpoint: buildSafeEndpoint(gatewayBaseUrl, '/health'),
        errorCode: 'NETWORK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Falha inesperada ao conectar ao gateway.',
      },
    }
  }
}

export async function sendWhatsAppTextMessage({
  phone,
  text,
  gatewayBaseUrl: inputGatewayBaseUrl,
  gatewayToken: inputGatewayToken,
  provider: inputProvider,
  instanceName: inputInstanceName,
}: SendWhatsAppTextMessageInput): Promise<SendWhatsAppTextMessageResult> {
  const gatewayConfigOverride: {
    gatewayBaseUrl?: string | null
    gatewayToken?: string | null
    provider?: string | null
    instanceName?: string | null
  } = {}
  if (inputGatewayBaseUrl !== undefined) gatewayConfigOverride.gatewayBaseUrl = inputGatewayBaseUrl
  if (inputGatewayToken !== undefined) gatewayConfigOverride.gatewayToken = inputGatewayToken
  if (inputProvider !== undefined) gatewayConfigOverride.provider = inputProvider
  if (inputInstanceName !== undefined) gatewayConfigOverride.instanceName = inputInstanceName
  const { gatewayBaseUrl, gatewayToken, provider, instanceName } = resolveGatewayConfig(gatewayConfigOverride)

  if (!gatewayBaseUrl || !gatewayToken) {
    return {
      ok: false,
      error: 'Configuração do gateway WhatsApp ausente.',
      technicalDetails: {
        errorCode: 'MISSING_GATEWAY_CONFIG',
        errorMessage: 'gatewayBaseUrl e/ou gatewayToken ausentes.',
      },
    }
  }

  if (!phone || !text) {
    return {
      ok: false,
      error: 'Phone e text são obrigatórios.',
      technicalDetails: {
        errorCode: 'INVALID_PAYLOAD',
        errorMessage: 'Campos obrigatórios ausentes para envio de mensagem.',
      },
    }
  }

  try {
    const phoneDigits = normalizePhoneDigits(phone)
    const evolutionCandidates = [
      {
        path: `/message/sendText/${encodeURIComponent(instanceName)}`,
        body: { number: phoneDigits, text },
      },
      {
        path: `/message/sendText/${encodeURIComponent(instanceName)}`,
        body: { phone: phoneDigits, text },
      },
      {
        path: '/message/sendText',
        body: { instanceName, number: phoneDigits, text },
      },
      {
        path: '/messages',
        body: { phone, text, token: gatewayToken },
      },
    ]

    const wahaCandidates = [
      {
        path: '/api/sendText',
        body: { session: instanceName, chatId: `${phoneDigits}@c.us`, text },
      },
      {
        path: '/messages',
        body: { phone, text, token: gatewayToken },
      },
    ]

    const candidates = provider === 'WAHA' ? wahaCandidates : evolutionCandidates
    let lastFailure: SendWhatsAppTextMessageResult | null = null

    for (const candidate of candidates) {
      const endpoint = buildSafeEndpoint(gatewayBaseUrl, candidate.path)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gatewayToken}`,
          apikey: gatewayToken,
          'x-api-key': gatewayToken,
        },
        body: JSON.stringify(candidate.body),
      })

      const responseText = await response.text().catch(() => '')
      if (response.ok) {
        return { ok: true, response: responseText || { ok: true } }
      }

      lastFailure = {
        ok: false,
        error: responseText || `Falha ao enviar mensagem via gateway (${response.status}).`,
        technicalDetails: {
          statusCode: response.status,
          endpoint,
          errorCode: 'HTTP_ERROR',
          errorMessage: responseText || `Resposta HTTP ${response.status}`,
        },
      }

      if (response.status !== 404) {
        return lastFailure
      }
    }

    if (lastFailure) {
      return lastFailure
    }

    return {
      ok: false,
      error: 'Falha ao enviar mensagem via gateway.',
      technicalDetails: {
        errorCode: 'HTTP_ERROR',
        errorMessage: 'Nenhum endpoint de envio de texto disponível respondeu com sucesso.',
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Falha inesperada ao enviar mensagem via gateway.',
      technicalDetails: {
        endpoint: buildSafeEndpoint(gatewayBaseUrl, '/message/sendText'),
        errorCode: 'NETWORK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Falha inesperada ao enviar mensagem via gateway.',
      },
    }
  }
}
