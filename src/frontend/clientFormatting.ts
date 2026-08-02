export const onlyDigits = (value: string) => value.replace(/\D/g, '')

const formatCpfDigits = (digits: string) => {
  const limited = digits.slice(0, 11)
  if (limited.length <= 3) return limited
  if (limited.length <= 6) return `${limited.slice(0, 3)}.${limited.slice(3)}`
  if (limited.length <= 9) return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`
  return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9)}`
}

const formatCnpjDigits = (digits: string) => {
  const limited = digits.slice(0, 14)
  if (limited.length <= 2) return limited
  if (limited.length <= 5) return `${limited.slice(0, 2)}.${limited.slice(2)}`
  if (limited.length <= 8) return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5)}`
  if (limited.length <= 12) return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8)}`
  return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8, 12)}-${limited.slice(12)}`
}

export const formatDocument = (value: string, personType: 'PF' | 'PJ') => {
  const digits = onlyDigits(value)
  const maxLength = personType === 'PF' ? 11 : 14
  const limitedDigits = digits.slice(0, maxLength)

  if (personType === 'PF') {
    return formatCpfDigits(limitedDigits)
  }

  return formatCnpjDigits(limitedDigits)
}

export const formatCep = (value: string) => {
  const digits = onlyDigits(value)
  const limited = digits.slice(0, 8)
  if (limited.length <= 5) return limited
  return `${limited.slice(0, 5)}-${limited.slice(5)}`
}

export const getDocumentValidationError = (value: string, personType: 'PF' | 'PJ') => {
  const digits = onlyDigits(value)
  if (!digits) return null

  const expectedLength = personType === 'PF' ? 11 : 14
  const expectedLabel = personType === 'PF' ? 'CPF' : 'CNPJ'

  if (digits.length === expectedLength) return null
  return `Informe um ${expectedLabel} válido com ${expectedLength} dígitos`
}

export const getZipCodeValidationError = (value: string) => {
  const digits = onlyDigits(value)
  if (!digits) return null
  if (digits.length === 8) return null
  return 'Informe um CEP válido com 8 dígitos'
}

export type ClientFormField = 'name' | 'document' | 'city' | 'state' | 'zipCode' | 'street' | 'number' | 'complement' | 'neighborhood' | 'accountStatus'

export type ClientFormErrors = Partial<Record<ClientFormField, string>>

const getErrorText = (payload: unknown): string => {
  if (typeof payload === 'string') return payload
  if (payload && typeof payload === 'object') {
    const candidate = payload as Record<string, unknown>
    if (typeof candidate.error === 'string') return candidate.error
    if (typeof candidate.message === 'string') return candidate.message
    if (Array.isArray(candidate.errors)) {
      return candidate.errors.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('; ')
    }
  }
  return 'Erro ao salvar cliente'
}

export const parseClientApiErrors = (payload: unknown) => {
  const fieldErrors: ClientFormErrors = {}
  const errorText = getErrorText(payload)
  const normalized = errorText.toLowerCase()

  if (payload && typeof payload === 'object' && 'errors' in payload) {
    const candidate = payload as { errors?: unknown }
    const errors = Array.isArray(candidate.errors) ? candidate.errors : []
    for (const item of errors) {
      if (!item || typeof item !== 'object') continue
      const candidate = item as { field?: unknown; message?: unknown; code?: unknown }
      const field = typeof candidate.field === 'string' ? candidate.field : undefined
      const message = typeof candidate.message === 'string' ? candidate.message : undefined
      const code = typeof candidate.code === 'string' ? candidate.code : undefined
      if (!field || !message) continue
      const mappedField = field as ClientFormField
      fieldErrors[mappedField] = message
      if (code === 'DUPLICATE_DOCUMENT') {
        fieldErrors.document = 'Já existe um cliente com este CPF/CNPJ.'
      }
    }
  }

  if (Object.keys(fieldErrors).length === 0) {
    if (normalized.includes('name')) {
      fieldErrors.name = 'Informe o nome do cliente'
    }

    if (normalized.includes('cpf') || normalized.includes('cnpj') || normalized.includes('documento') || normalized.includes('document')) {
      fieldErrors.document = normalized.includes('já cadastrado') || normalized.includes('duplic')
        ? 'Já existe um cliente com este CPF/CNPJ'
        : 'Documento inválido para o tipo selecionado'
    }

    if (normalized.includes('zip') || normalized.includes('cep')) {
      fieldErrors.zipCode = 'Informe um CEP válido'
    }

    if (normalized.includes('city')) {
      fieldErrors.city = 'Informe a cidade'
    }

    if (normalized.includes('state')) {
      fieldErrors.state = 'Informe a UF'
    }

    if (normalized.includes('street')) {
      fieldErrors.street = 'Informe o logradouro'
    }

    if (normalized.includes('number')) {
      fieldErrors.number = 'Informe o número'
    }

    if (normalized.includes('neighborhood')) {
      fieldErrors.neighborhood = 'Informe o bairro'
    }
  }

  const generalError = Object.keys(fieldErrors).length > 0 ? null : errorText

  return { fieldErrors, generalError }
}
