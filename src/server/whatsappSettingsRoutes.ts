import type { Express, Request, Response } from 'express'
import {
  getWhatsAppSettings,
  normalizeWhatsAppSettingsPayload,
  toWhatsAppSettingsResponse,
  updateWhatsAppSettings,
  validateWhatsAppSettingsInput,
} from './settingsService.js'
import { sendWhatsAppTextMessage, testWhatsAppGatewayConnection } from '../whatsappGateway.js'
import { createWhatsAppSessionGateway } from './whatsappSessionGateway.js'
import { getWhatsAppConnectionStatusLabel, type NormalizedWhatsAppConnectionStatus, type WhatsAppProvider } from './whatsappConnectionStatus.js'

type SettingsPrismaClient = Parameters<typeof getWhatsAppSettings>[0] & {
  whatsAppConnection?: {
    findFirst: (args?: { orderBy?: { updatedAt: 'desc' } }) => Promise<any>
    findUnique: (args: { where: { instanceName: string } }) => Promise<any>
    upsert: (args: {
      where: { instanceName: string }
      update: Record<string, unknown>
      create: Record<string, unknown>
    }) => Promise<any>
    update: (args: { where: { instanceName: string }; data: Record<string, unknown> }) => Promise<any>
  }
}

const hasWhatsAppConnectionModel = (prisma: SettingsPrismaClient) => {
  return Boolean(prisma.whatsAppConnection)
}

const normalizeText = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

const normalizePhoneToE164 = (value: string) => {
  const digitsOnly = value.replace(/[^0-9]/g, '')
  return digitsOnly ? `+${digitsOnly}` : ''
}

const isValidPhone = (value: string) => /^\+[1-9]\d{9,14}$/.test(normalizePhoneToE164(value))

type TechnicalDetails = {
  statusCode?: number
  endpoint?: string
  errorCode?: string
  errorMessage?: string
  contentType?: string
  preview?: string
}

const buildErrorResponse = (
  message: string,
  technicalDetails?: TechnicalDetails
) => {
  const safeDetails: TechnicalDetails = {}
  if (technicalDetails?.statusCode !== undefined) safeDetails.statusCode = technicalDetails.statusCode
  if (technicalDetails?.endpoint) safeDetails.endpoint = technicalDetails.endpoint
  if (technicalDetails?.errorCode) safeDetails.errorCode = technicalDetails.errorCode
  if (technicalDetails?.errorMessage) safeDetails.errorMessage = technicalDetails.errorMessage
  if (technicalDetails?.contentType) safeDetails.contentType = technicalDetails.contentType
  if (technicalDetails?.preview) safeDetails.preview = technicalDetails.preview

  return {
    ok: false,
    message,
    technicalDetails: safeDetails,
  }
}

type ConnectionPayload = {
  provider: WhatsAppProvider
  instanceName: string
  status: NormalizedWhatsAppConnectionStatus
  qrCodeBase64: string | null
  pairingCode: string | null
  rawCode: string | null
  phoneNumber: string | null
  connectedAt: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  lastSeenAt: string | null
  updatedAt: string | null
}

const toIsoOrNull = (value: unknown) => {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const cast = new Date(String(value))
  return Number.isNaN(cast.getTime()) ? null : cast.toISOString()
}

const parseProvider = (value: string | null | undefined): WhatsAppProvider => {
  const normalized = String(value ?? '').trim().toUpperCase()
  return normalized === 'WAHA' ? 'WAHA' : 'EVOLUTION'
}

const getGatewayContext = async (prisma: SettingsPrismaClient) => {
  const settings = await getWhatsAppSettings(prisma)
  const provider = parseProvider(settings.provider)
  const instanceName = (settings.instanceName || 'assist-tech-main').trim()

  if (!settings.gatewayBaseUrl || !settings.gatewayToken) {
    return {
      ok: false as const,
      error: buildErrorResponse('Configuração do gateway WhatsApp incompleta.', {
        errorCode: 'MISSING_GATEWAY_CONFIG',
        errorMessage: 'Preencha URL e token do gateway antes de conectar a instância.',
      }),
    }
  }

  const gateway = createWhatsAppSessionGateway({
    provider,
    instanceName,
    gatewayBaseUrl: settings.gatewayBaseUrl,
    gatewayToken: settings.gatewayToken,
  })

  return {
    ok: true as const,
    settings,
    provider,
    instanceName,
    gateway,
  }
}

const persistConnection = async (
  prisma: SettingsPrismaClient,
  input: {
    provider: WhatsAppProvider
    instanceName: string
    status: NormalizedWhatsAppConnectionStatus
    qrCodeBase64?: string | null
    phoneNumber?: string | null
    lastErrorCode?: string | null
    lastErrorMessage?: string | null
    connectedAt?: Date | null
  }
) => {
  if (!prisma.whatsAppConnection) {
    return {
      provider: input.provider,
      instanceName: input.instanceName,
      status: input.status,
      qrCodeBase64: input.qrCodeBase64 ?? null,
      phoneNumber: input.phoneNumber ?? null,
      lastErrorCode: input.lastErrorCode ?? null,
      lastErrorMessage: input.lastErrorMessage ?? null,
      connectedAt: input.connectedAt ?? (input.status === 'CONNECTED' ? new Date() : null),
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    }
  }

  const now = new Date()
  const createPayload = {
    provider: input.provider,
    instanceName: input.instanceName,
    status: input.status,
    qrCodeBase64: input.qrCodeBase64 ?? null,
    phoneNumber: input.phoneNumber ?? null,
    lastErrorCode: input.lastErrorCode ?? null,
    lastErrorMessage: input.lastErrorMessage ?? null,
    connectedAt: input.connectedAt ?? (input.status === 'CONNECTED' ? now : null),
    lastSeenAt: now,
  }

  const updatePayload = {
    provider: input.provider,
    status: input.status,
    qrCodeBase64: input.qrCodeBase64 ?? null,
    phoneNumber: input.phoneNumber ?? null,
    lastErrorCode: input.lastErrorCode ?? null,
    lastErrorMessage: input.lastErrorMessage ?? null,
    connectedAt: input.connectedAt ?? (input.status === 'CONNECTED' ? now : undefined),
    lastSeenAt: now,
  }

  return prisma.whatsAppConnection.upsert({
    where: { instanceName: input.instanceName },
    create: createPayload,
    update: updatePayload,
  })
}

const toConnectionPayload = (record: any): ConnectionPayload => {
  return {
    provider: parseProvider(record?.provider),
    instanceName: String(record?.instanceName || 'assist-tech-main'),
    status: (record?.status || 'DISCONNECTED') as NormalizedWhatsAppConnectionStatus,
    qrCodeBase64: record?.qrCodeBase64 || null,
    pairingCode: record?.pairingCode || null,
    rawCode: record?.rawCode || null,
    phoneNumber: record?.phoneNumber || null,
    connectedAt: toIsoOrNull(record?.connectedAt),
    lastErrorCode: record?.lastErrorCode || null,
    lastErrorMessage: record?.lastErrorMessage || null,
    lastSeenAt: toIsoOrNull(record?.lastSeenAt),
    updatedAt: toIsoOrNull(record?.updatedAt),
  }
}

export const registerWhatsAppSettingsRoutes = (app: Express, prisma: SettingsPrismaClient) => {
  app.get('/settings/whatsapp', async (_req: Request, res: Response) => {
    try {
      const settings = await getWhatsAppSettings(prisma)
      if (process.env.NODE_ENV !== 'production') {
        console.info('[settings-whatsapp] GET loaded gatewayBaseUrl', {
          gatewayBaseUrl: settings.gatewayBaseUrl,
        })
      }
      res.json(toWhatsAppSettingsResponse(settings))
    } catch (error) {
      console.error('GET /settings/whatsapp error:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.put('/settings/whatsapp', async (req: Request, res: Response) => {
    try {
      const payload = normalizeWhatsAppSettingsPayload(req.body as Record<string, unknown> | null | undefined)
      if (process.env.NODE_ENV !== 'production') {
        console.info('[settings-whatsapp] PUT payload gatewayBaseUrl', {
          gatewayBaseUrl: payload.gatewayBaseUrl ?? null,
        })
      }
      const errors = validateWhatsAppSettingsInput(payload)

      if (errors.length > 0) {
        return res.status(400).json({
          message: 'Payload de configurações do WhatsApp inválido.',
          errors,
        })
      }

      const updated = await updateWhatsAppSettings(prisma, payload)
      if (process.env.NODE_ENV !== 'production') {
        console.info('[settings-whatsapp] PUT saved gatewayBaseUrl', {
          gatewayBaseUrl: updated.gatewayBaseUrl,
        })
      }
      return res.json(toWhatsAppSettingsResponse(updated))
    } catch (error) {
      console.error('PUT /settings/whatsapp error:', error)
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.post('/settings/whatsapp/test-connection', async (_req: Request, res: Response) => {
    try {
      const settings = await getWhatsAppSettings(prisma)
      const result = await testWhatsAppGatewayConnection({
        gatewayBaseUrl: settings.gatewayBaseUrl,
        gatewayToken: settings.gatewayToken,
      })

      if (!result.ok) {
        const details: TechnicalDetails = {}
        const statusCode = result.technicalDetails?.statusCode ?? result.status
        if (statusCode !== undefined) details.statusCode = statusCode
        if (result.technicalDetails?.endpoint) details.endpoint = result.technicalDetails.endpoint
        if (result.technicalDetails?.errorCode) details.errorCode = result.technicalDetails.errorCode
        details.errorMessage = result.technicalDetails?.errorMessage ?? result.message

        return res.status(400).json(buildErrorResponse('Falha ao conectar ao gateway', {
          ...details,
        }))
      }

      return res.json({ ok: true, message: 'Conexão com gateway OK' })
    } catch (error) {
      console.error('POST /settings/whatsapp/test-connection error:', error)
      return res.status(500).json(buildErrorResponse('Falha ao conectar ao gateway', {
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
      }))
    }
  })

  app.post('/settings/whatsapp/send-test-message', async (req: Request, res: Response) => {
    try {
      const context = await getGatewayContext(prisma)
      if (!context.ok) {
        return res.status(400).json(context.error)
      }

      const { settings, gateway } = context
      const payload = req.body as Record<string, unknown> | null | undefined
      const phoneInput = normalizeText(payload?.phone) || settings.defaultTestPhone || undefined
      const messageInput = normalizeText(payload?.message) || 'Teste de integração WhatsApp do Assist Tech Laudos.'

      if (!phoneInput) {
        return res.status(400).json(buildErrorResponse('Falha ao enviar mensagem de teste', {
          errorCode: 'MISSING_TEST_PHONE',
          errorMessage: 'Informe um número para teste ou configure um número padrão.',
        }))
      }

      if (!isValidPhone(phoneInput)) {
        return res.status(400).json(buildErrorResponse('Falha ao enviar mensagem de teste', {
          errorCode: 'INVALID_TEST_PHONE',
          errorMessage: 'Número de teste inválido. Use formato internacional, ex.: +5511999999999.',
        }))
      }

      const normalizedPhone = normalizePhoneToE164(phoneInput)
      if (hasWhatsAppConnectionModel(prisma)) {
        const connection = await prisma.whatsAppConnection?.findUnique({ where: { instanceName: context.instanceName } })
        if (!connection || connection.status !== 'CONNECTED') {
          return res.status(400).json(buildErrorResponse('Conecte o WhatsApp via QR Code antes de enviar mensagens de teste.', {
            errorCode: 'SESSION_NOT_CONNECTED',
            errorMessage: 'A instância atual ainda não está conectada.',
          }))
        }
      }

      const result = await gateway.sendTestMessage(normalizedPhone, messageInput)

      if (!result.ok) {
        const details: TechnicalDetails = {}
        if (result.technicalDetails?.statusCode !== undefined) details.statusCode = result.technicalDetails.statusCode
        if (result.technicalDetails?.endpoint) details.endpoint = result.technicalDetails.endpoint
        if (result.technicalDetails?.errorCode) details.errorCode = result.technicalDetails.errorCode
        details.errorMessage = result.technicalDetails?.errorMessage ?? result.error ?? 'Erro desconhecido.'

        return res.status(400).json(buildErrorResponse('Falha ao enviar mensagem de teste', {
          ...details,
        }))
      }

      return res.json({ ok: true, message: 'Mensagem de teste enviada com sucesso.', phone: normalizedPhone })
    } catch (error) {
      console.error('POST /settings/whatsapp/send-test-message error:', error)
      return res.status(500).json(buildErrorResponse('Falha ao enviar mensagem de teste', {
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
      }))
    }
  })

  app.post('/settings/whatsapp/instance/create', async (_req: Request, res: Response) => {
    try {
      const context = await getGatewayContext(prisma)
      if (!context.ok) return res.status(400).json(context.error)

      const createResult = await context.gateway.createInstance()
      const record = await persistConnection(prisma, {
        provider: context.provider,
        instanceName: context.instanceName,
        status: createResult.status || 'STARTING',
        qrCodeBase64: createResult.qrCodeBase64 ?? null,
        phoneNumber: createResult.phoneNumber ?? null,
        lastErrorCode: createResult.errorCode ?? null,
        lastErrorMessage: createResult.errorMessage ?? null,
      })

      const message = createResult.errorMessage === 'Instância já existente. Reutilizando conexão.'
        ? createResult.errorMessage
        : 'Instância criada com sucesso.'

      return res.json({
        ok: true,
        message,
        ...toConnectionPayload(record),
        pairingCode: createResult.pairingCode ?? null,
        rawCode: createResult.rawCode ?? null,
      })
    } catch (error) {
      console.error('POST /settings/whatsapp/instance/create error:', error)
      return res.status(500).json(buildErrorResponse('Falha ao criar instância do WhatsApp.', {
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
      }))
    }
  })

  app.post('/settings/whatsapp/instance/connect', async (_req: Request, res: Response) => {
    try {
      const context = await getGatewayContext(prisma)
      if (!context.ok) return res.status(400).json(context.error)

      const connectResult = await context.gateway.connectInstance()
      const qrResult = await context.gateway.fetchQrCode()

      const fatalConnectError = (qrResult.errorCode || connectResult.errorCode)
        && !qrResult.qrCodeBase64
        && !connectResult.qrCodeBase64
        && !qrResult.pairingCode
        && !connectResult.pairingCode
        && connectResult.status !== 'CONNECTED'

      if (fatalConnectError) {
        const errorCode = qrResult.errorCode || connectResult.errorCode || 'GATEWAY_ERROR'
        const errorMessage = qrResult.errorMessage || connectResult.errorMessage || 'Falha ao iniciar sessão no gateway.'
        const endpoint = qrResult.endpoint || connectResult.endpoint
        const statusCode = qrResult.technicalDetails?.statusCode || connectResult.technicalDetails?.statusCode
        const details: TechnicalDetails = {
          errorCode,
          errorMessage,
        }
        if (endpoint) details.endpoint = endpoint
        if (statusCode !== undefined) details.statusCode = statusCode
        return res.status(400).json(buildErrorResponse('Falha ao iniciar conexão da instância.', details))
      }

      const mergedStatus = qrResult.qrCodeBase64 ? 'WAITING_QR' : connectResult.status
      const record = await persistConnection(prisma, {
        provider: context.provider,
        instanceName: context.instanceName,
        status: mergedStatus,
        qrCodeBase64: qrResult.qrCodeBase64 ?? connectResult.qrCodeBase64 ?? null,
        phoneNumber: connectResult.phoneNumber ?? qrResult.phoneNumber ?? null,
        lastErrorCode: qrResult.errorCode ?? connectResult.errorCode ?? null,
        lastErrorMessage: qrResult.errorMessage ?? connectResult.errorMessage ?? null,
      })

      const payload = toConnectionPayload(record)
      return res.json({
        ok: true,
        ...payload,
        pairingCode: qrResult.pairingCode ?? connectResult.pairingCode ?? payload.pairingCode,
        rawCode: qrResult.rawCode ?? connectResult.rawCode ?? payload.rawCode,
      })
    } catch (error) {
      console.error('POST /settings/whatsapp/instance/connect error:', error)
      return res.status(500).json(buildErrorResponse('Falha ao iniciar conexão da instância.', {
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
      }))
    }
  })

  app.get('/settings/whatsapp/instance/status', async (_req: Request, res: Response) => {
    try {
      const context = await getGatewayContext(prisma)
      if (!context.ok) return res.status(400).json(context.error)

      const statusResult = await context.gateway.getConnectionStatus()

      if (statusResult.errorCode && statusResult.status !== 'CONNECTED') {
        const details: TechnicalDetails = {
          errorCode: statusResult.errorCode,
          errorMessage: statusResult.errorMessage || 'Gateway retornou erro ao consultar status.',
        }
        if (statusResult.endpoint) details.endpoint = statusResult.endpoint
        if (statusResult.technicalDetails?.statusCode !== undefined) {
          details.statusCode = statusResult.technicalDetails.statusCode
        }
        return res.status(400).json(buildErrorResponse('Falha ao consultar status da instância.', details))
      }

      const record = await persistConnection(prisma, {
        provider: context.provider,
        instanceName: context.instanceName,
        status: statusResult.status,
        qrCodeBase64: statusResult.status === 'CONNECTED' ? null : statusResult.qrCodeBase64 ?? null,
        phoneNumber: statusResult.phoneNumber ?? null,
        lastErrorCode: statusResult.errorCode ?? null,
        lastErrorMessage: statusResult.errorMessage ?? null,
        connectedAt: statusResult.status === 'CONNECTED' ? new Date() : null,
      })

      const payload = toConnectionPayload(record)
      return res.json({
        ok: true,
        ...payload,
        pairingCode: statusResult.pairingCode ?? payload.pairingCode,
        rawCode: statusResult.rawCode ?? payload.rawCode,
      })
    } catch (error) {
      console.error('GET /settings/whatsapp/instance/status error:', error)
      return res.status(500).json(buildErrorResponse('Falha ao consultar status da instância.', {
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
      }))
    }
  })

  app.post('/settings/whatsapp/instance/refresh-qr', async (_req: Request, res: Response) => {
    try {
      const context = await getGatewayContext(prisma)
      if (!context.ok) return res.status(400).json(context.error)

      const qrResult = await context.gateway.fetchQrCode()

      if (qrResult.errorCode && !qrResult.qrCodeBase64 && qrResult.status !== 'CONNECTED') {
        const details: TechnicalDetails = {
          errorCode: qrResult.errorCode,
          errorMessage: qrResult.errorMessage || 'Gateway não retornou QR Code válido.',
        }
        if (qrResult.endpoint) details.endpoint = qrResult.endpoint
        if (qrResult.technicalDetails?.statusCode !== undefined) {
          details.statusCode = qrResult.technicalDetails.statusCode
        }
        return res.status(400).json(buildErrorResponse('Falha ao atualizar QR Code.', details))
      }

      const status = qrResult.qrCodeBase64 ? 'WAITING_QR' : qrResult.status
      const record = await persistConnection(prisma, {
        provider: context.provider,
        instanceName: context.instanceName,
        status,
        qrCodeBase64: qrResult.qrCodeBase64 ?? null,
        phoneNumber: qrResult.phoneNumber ?? null,
        lastErrorCode: qrResult.errorCode ?? null,
        lastErrorMessage: qrResult.errorMessage ?? null,
      })

      const payload = toConnectionPayload(record)
      return res.json({
        ok: true,
        ...payload,
        pairingCode: qrResult.pairingCode ?? payload.pairingCode,
        rawCode: qrResult.rawCode ?? payload.rawCode,
      })
    } catch (error) {
      console.error('POST /settings/whatsapp/instance/refresh-qr error:', error)
      return res.status(500).json(buildErrorResponse('Falha ao atualizar QR Code.', {
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
      }))
    }
  })

  app.post('/settings/whatsapp/instance/disconnect', async (_req: Request, res: Response) => {
    try {
      const context = await getGatewayContext(prisma)
      if (!context.ok) return res.status(400).json(context.error)

      await context.gateway.disconnectInstance()
      const record = await persistConnection(prisma, {
        provider: context.provider,
        instanceName: context.instanceName,
        status: 'DISCONNECTED',
        qrCodeBase64: null,
        phoneNumber: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        connectedAt: null,
      })

      return res.json({ ok: true, ...toConnectionPayload(record) })
    } catch (error) {
      console.error('POST /settings/whatsapp/instance/disconnect error:', error)
      return res.status(500).json(buildErrorResponse('Falha ao desconectar instância.', {
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
      }))
    }
  })

  app.get('/settings/whatsapp/instance', async (_req: Request, res: Response) => {
    try {
      const settings = await getWhatsAppSettings(prisma)
      const instanceName = (settings.instanceName || 'assist-tech-main').trim()
      const provider = parseProvider(settings.provider)

      if (!hasWhatsAppConnectionModel(prisma)) {
        if (!settings.gatewayBaseUrl || !settings.gatewayToken) {
          return res.json({
            ok: true,
            provider,
            instanceName,
            status: 'DISCONNECTED',
            qrCodeBase64: null,
            pairingCode: null,
            rawCode: null,
            phoneNumber: null,
            connectedAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            lastSeenAt: null,
            updatedAt: null,
            statusLabel: getWhatsAppConnectionStatusLabel('DISCONNECTED'),
          })
        }

        const gateway = createWhatsAppSessionGateway({
          provider,
          instanceName,
          gatewayBaseUrl: settings.gatewayBaseUrl,
          gatewayToken: settings.gatewayToken,
        })
        const liveStatus = await gateway.getConnectionStatus()
        return res.json({
          ok: true,
          provider,
          instanceName,
          status: liveStatus.status,
          statusLabel: getWhatsAppConnectionStatusLabel(liveStatus.status),
          qrCodeBase64: liveStatus.qrCodeBase64 ?? null,
          pairingCode: liveStatus.pairingCode ?? null,
          rawCode: liveStatus.rawCode ?? null,
          phoneNumber: liveStatus.phoneNumber ?? null,
          connectedAt: null,
          lastErrorCode: liveStatus.errorCode ?? null,
          lastErrorMessage: liveStatus.errorMessage ?? null,
          lastSeenAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      const current = await prisma.whatsAppConnection?.findUnique({ where: { instanceName } })

      if (!current) {
        return res.json({
          ok: true,
          provider,
          instanceName,
          status: 'DISCONNECTED',
          qrCodeBase64: null,
          pairingCode: null,
          rawCode: null,
          phoneNumber: null,
          connectedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastSeenAt: null,
          updatedAt: null,
          statusLabel: getWhatsAppConnectionStatusLabel('DISCONNECTED'),
        })
      }

      const payload = toConnectionPayload(current)
      return res.json({ ok: true, ...payload, statusLabel: getWhatsAppConnectionStatusLabel(payload.status) })
    } catch (error) {
      console.error('GET /settings/whatsapp/instance error:', error)
      return res.status(500).json(buildErrorResponse('Falha ao carregar dados da instância.', {
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
      }))
    }
  })
}
