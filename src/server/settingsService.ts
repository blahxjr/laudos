export const WHATSAPP_SETTINGS_CATEGORY = 'WHATSAPP'

export const WHATSAPP_SETTING_KEYS = {
  gatewayBaseUrl: 'WHATSAPP_GATEWAY_BASE_URL',
  gatewayToken: 'WHATSAPP_GATEWAY_TOKEN',
  gatewayWebhookToken: 'WHATSAPP_GATEWAY_WEBHOOK_TOKEN',
  appBaseUrl: 'APP_BASE_URL',
  defaultTestPhone: 'WHATSAPP_DEFAULT_TEST_PHONE',
  provider: 'WHATSAPP_PROVIDER',
  instanceName: 'WHATSAPP_INSTANCE_NAME',
} as const

type SettingKey = (typeof WHATSAPP_SETTING_KEYS)[keyof typeof WHATSAPP_SETTING_KEYS]

type AppSettingRecord = {
  category: string
  key: string
  value: string
}

type SettingsPrismaClient = {
  appSetting: {
    findMany: (args: { where: { category: string; key: { in: string[] } } }) => Promise<AppSettingRecord[]>
    upsert: (args: {
      where: { category_key: { category: string; key: string } }
      update: { value: string }
      create: { category: string; key: string; value: string }
    }) => Promise<unknown>
    deleteMany: (args: { where: { category: string; key: string } }) => Promise<unknown>
  }
  $transaction: <T>(operations: Promise<T>[]) => Promise<T[]>
}

export type WhatsAppSettings = {
  gatewayBaseUrl: string | null
  gatewayToken: string | null
  gatewayWebhookToken: string | null
  appBaseUrl: string | null
  defaultTestPhone: string | null
  provider: string | null
  instanceName: string | null
}

export type WhatsAppSettingsInput = Partial<{
  gatewayBaseUrl: string | null
  gatewayToken: string | null
  gatewayWebhookToken: string | null
  appBaseUrl: string | null
  defaultTestPhone: string | null
  provider: string | null
  instanceName: string | null
}>

export type WhatsAppSettingsValidationError = {
  field: string
  message: string
}

const WHATSAPP_SETTINGS_DEFAULTS: WhatsAppSettings = {
  gatewayBaseUrl: null,
  gatewayToken: null,
  gatewayWebhookToken: null,
  appBaseUrl: null,
  defaultTestPhone: null,
  provider: 'EVOLUTION',
  instanceName: 'assist-tech-main',
}

const VALUE_TO_KEY: Record<keyof WhatsAppSettings, SettingKey> = {
  gatewayBaseUrl: WHATSAPP_SETTING_KEYS.gatewayBaseUrl,
  gatewayToken: WHATSAPP_SETTING_KEYS.gatewayToken,
  gatewayWebhookToken: WHATSAPP_SETTING_KEYS.gatewayWebhookToken,
  appBaseUrl: WHATSAPP_SETTING_KEYS.appBaseUrl,
  defaultTestPhone: WHATSAPP_SETTING_KEYS.defaultTestPhone,
  provider: WHATSAPP_SETTING_KEYS.provider,
  instanceName: WHATSAPP_SETTING_KEYS.instanceName,
}

const KEY_TO_VALUE = Object.entries(VALUE_TO_KEY).reduce((acc, [field, key]) => {
  acc[key] = field as keyof WhatsAppSettings
  return acc
}, {} as Record<string, keyof WhatsAppSettings>)

const normalizeOptionalString = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const normalizePhoneToE164 = (value: string) => {
  const digitsOnly = value.replace(/[^0-9]/g, '')
  if (!digitsOnly) return ''
  return `+${digitsOnly}`
}

const isValidPhone = (value: string) => {
  const normalized = normalizePhoneToE164(value)
  return /^\+[1-9]\d{9,14}$/.test(normalized)
}

export const normalizeWhatsAppSettingsPayload = (payload: Record<string, unknown> | null | undefined): WhatsAppSettingsInput => {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {}

  const data = source as Record<string, unknown>

  const normalized: WhatsAppSettingsInput = {}
  const gatewayBaseUrl = normalizeOptionalString(data.gatewayBaseUrl ?? data.WHATSAPP_GATEWAY_BASE_URL)
  const gatewayToken = normalizeOptionalString(data.gatewayToken ?? data.WHATSAPP_GATEWAY_TOKEN)
  const gatewayWebhookToken = normalizeOptionalString(data.gatewayWebhookToken ?? data.WHATSAPP_GATEWAY_WEBHOOK_TOKEN)
  const appBaseUrl = normalizeOptionalString(data.appBaseUrl ?? data.APP_BASE_URL)
  const defaultTestPhone = normalizeOptionalString(data.defaultTestPhone ?? data.WHATSAPP_DEFAULT_TEST_PHONE)
  const provider = normalizeOptionalString(data.provider ?? data.WHATSAPP_PROVIDER)
  const instanceName = normalizeOptionalString(data.instanceName ?? data.WHATSAPP_INSTANCE_NAME)

  if (gatewayBaseUrl !== undefined) normalized.gatewayBaseUrl = gatewayBaseUrl
  if (gatewayToken !== undefined) normalized.gatewayToken = gatewayToken
  if (gatewayWebhookToken !== undefined) normalized.gatewayWebhookToken = gatewayWebhookToken
  if (appBaseUrl !== undefined) normalized.appBaseUrl = appBaseUrl
  if (defaultTestPhone !== undefined) normalized.defaultTestPhone = defaultTestPhone
  if (provider !== undefined) normalized.provider = provider?.toUpperCase() ?? null
  if (instanceName !== undefined) normalized.instanceName = instanceName

  return normalized
}

export const validateWhatsAppSettingsInput = (payload: WhatsAppSettingsInput): WhatsAppSettingsValidationError[] => {
  const errors: WhatsAppSettingsValidationError[] = []

  if (payload.gatewayBaseUrl && !isValidHttpUrl(payload.gatewayBaseUrl)) {
    errors.push({ field: 'gatewayBaseUrl', message: 'WHATSAPP_GATEWAY_BASE_URL deve ser uma URL HTTP/HTTPS válida.' })
  }

  if (payload.appBaseUrl && !isValidHttpUrl(payload.appBaseUrl)) {
    errors.push({ field: 'appBaseUrl', message: 'APP_BASE_URL deve ser uma URL HTTP/HTTPS válida.' })
  }

  if (payload.defaultTestPhone && !isValidPhone(payload.defaultTestPhone)) {
    errors.push({ field: 'defaultTestPhone', message: 'WHATSAPP_DEFAULT_TEST_PHONE deve estar no formato internacional (ex.: +5511999999999).' })
  }

  if (payload.provider && !['EVOLUTION', 'WAHA'].includes(payload.provider.toUpperCase())) {
    errors.push({ field: 'provider', message: 'WHATSAPP_PROVIDER deve ser EVOLUTION ou WAHA.' })
  }

  if (payload.instanceName !== undefined && payload.instanceName !== null && payload.instanceName.trim().length < 3) {
    errors.push({ field: 'instanceName', message: 'WHATSAPP_INSTANCE_NAME deve ter ao menos 3 caracteres.' })
  }

  return errors
}

export const getWhatsAppSettings = async (prisma: SettingsPrismaClient): Promise<WhatsAppSettings> => {
  const settings = await prisma.appSetting.findMany({
    where: {
      category: WHATSAPP_SETTINGS_CATEGORY,
      key: { in: Object.values(WHATSAPP_SETTING_KEYS) },
    },
  })

  return settings.reduce((acc, setting) => {
    const field = KEY_TO_VALUE[setting.key]
    if (!field) return acc

    if (field === 'defaultTestPhone') {
      acc[field] = normalizePhoneToE164(setting.value)
      return acc
    }

    acc[field] = setting.value
    return acc
  }, { ...WHATSAPP_SETTINGS_DEFAULTS })
}

export const updateWhatsAppSettings = async (
  prisma: SettingsPrismaClient,
  payload: WhatsAppSettingsInput
): Promise<WhatsAppSettings> => {
  const operations: Promise<unknown>[] = []

  for (const [field, key] of Object.entries(VALUE_TO_KEY) as [keyof WhatsAppSettings, SettingKey][]) {
    const value = payload[field]
    if (value === undefined) continue

    if (value === null) {
      operations.push(
        prisma.appSetting.deleteMany({
          where: {
            category: WHATSAPP_SETTINGS_CATEGORY,
            key,
          },
        })
      )
      continue
    }

    const normalizedValue = field === 'defaultTestPhone' ? normalizePhoneToE164(value) : value

    operations.push(
      prisma.appSetting.upsert({
        where: {
          category_key: {
            category: WHATSAPP_SETTINGS_CATEGORY,
            key,
          },
        },
        update: {
          value: normalizedValue,
        },
        create: {
          category: WHATSAPP_SETTINGS_CATEGORY,
          key,
          value: normalizedValue,
        },
      })
    )
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations)
  }

  return getWhatsAppSettings(prisma)
}

export const toWhatsAppSettingsResponse = (settings: WhatsAppSettings) => ({
  gatewayBaseUrl: settings.gatewayBaseUrl,
  appBaseUrl: settings.appBaseUrl,
  defaultTestPhone: settings.defaultTestPhone,
  provider: settings.provider,
  instanceName: settings.instanceName,
  hasGatewayToken: Boolean(settings.gatewayToken),
  hasGatewayWebhookToken: Boolean(settings.gatewayWebhookToken),
})
