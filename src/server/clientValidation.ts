export type ClientPersonType = 'PF' | 'PJ'

export type ClientValidationError = {
  field: string
  message: string
  code?: string
}

export type ClientValidationResult = {
  valid: boolean
  errors: ClientValidationError[]
  payload: ClientPayload
}

export type ClientPayload = {
  name?: string
  type?: ClientPersonType | string
  document?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zipCode?: string
  accountStatus?: string
}

export type ClientPayloadInput = Record<string, unknown> | null | undefined

export const normalizeDocument = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/[^0-9]/g, '')
  return normalized || undefined
}

export const normalizeText = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

export const normalizeClientPayload = (payload: ClientPayloadInput): ClientPayload => {
  const value = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}
  const source = value as Record<string, unknown>
  const document = normalizeDocument(source.document)

  return {
    name: normalizeText(source.name),
    type: typeof source.type === 'string' ? source.type.toUpperCase() : undefined,
    document,
    street: normalizeText(source.street),
    number: normalizeText(source.number),
    complement: normalizeText(source.complement),
    neighborhood: normalizeText(source.neighborhood),
    city: normalizeText(source.city),
    state: normalizeText(source.state)?.toUpperCase(),
    zipCode: normalizeText(source.zipCode),
    accountStatus: normalizeText(source.accountStatus) ?? 'ATIVO',
  }
}

export const isValidCpf = (value: string) => {
  if (value.length !== 11 || /^(\d)\1{10}$/.test(value)) {
    return false
  }

  let sum = 0
  for (let i = 0; i < 9; i += 1) {
    sum += Number(value.charAt(i)) * (10 - i)
  }

  let remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) {
    remainder = 0
  }
  if (remainder !== Number(value.charAt(9))) {
    return false
  }

  sum = 0
  for (let i = 0; i < 10; i += 1) {
    sum += Number(value.charAt(i)) * (11 - i)
  }

  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) {
    remainder = 0
  }

  return remainder === Number(value.charAt(10))
}

export const isValidCnpj = (value: string) => {
  if (value.length !== 14) return false
  const digits = value.split('').map(Number)
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const calc = (weights: number[]) => {
    const sum = digits.slice(0, weights.length).reduce((acc, digit, index) => acc + digit * (weights[index] ?? 0), 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const check1 = calc(weights1)
  const check2 = calc(weights2)
  return digits[12] === check1 && digits[13] === check2
}

export const createClientValidationErrors = (payload: ClientPayload, existingDocumentMatch?: { document?: string | null } | null) => {
  const errors: ClientValidationError[] = []

  if (!payload.name || !payload.name.trim()) {
    errors.push({ field: 'name', message: 'Informe o nome do cliente.' })
  }

  if (!payload.type || (payload.type !== 'PF' && payload.type !== 'PJ')) {
    errors.push({ field: 'type', message: 'Selecione o tipo PF ou PJ.' })
  }

  const document = payload.document
  if (!document) {
    errors.push({ field: 'document', message: 'Informe o CPF ou CNPJ do cliente.' })
  } else {
    if (payload.type === 'PF') {
      if (document.length !== 11) {
        errors.push({ field: 'document', message: 'Tipo PF exige CPF com 11 dígitos.' })
      } else if (!isValidCpf(document)) {
        errors.push({ field: 'document', message: 'CPF inválido.' })
      }
    }

    if (payload.type === 'PJ') {
      if (document.length !== 14) {
        errors.push({ field: 'document', message: 'Tipo PJ exige CNPJ com 14 dígitos.' })
      } else if (!isValidCnpj(document)) {
        errors.push({ field: 'document', message: 'CNPJ inválido.' })
      }
    }
  }

  if (!payload.city || !payload.city.trim()) {
    errors.push({ field: 'city', message: 'Informe a cidade.' })
  }

  if (!payload.state || !payload.state.trim()) {
    errors.push({ field: 'state', message: 'Informe a UF.' })
  }

  if (!payload.zipCode || !payload.zipCode.trim()) {
    errors.push({ field: 'zipCode', message: 'Informe o CEP.' })
  }

  if (existingDocumentMatch && existingDocumentMatch.document && payload.document && payload.document === existingDocumentMatch.document) {
    errors.push({ field: 'document', code: 'DUPLICATE_DOCUMENT', message: 'Já existe um cliente com este CPF/CNPJ.' })
  }

  return errors
}

export const createClientApiErrorPayload = (errors: ClientValidationError[]) => ({
  errors,
  message: errors.map((error) => error.message).join(' '),
})
