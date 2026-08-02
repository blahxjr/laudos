export const SERVICE_ORDER_STATUS_OPTIONS = [
  { value: 'ABERTA', label: 'Aberta', color: 'open' },
  { value: 'EM_DIAGNOSTICO', label: 'Em diagnóstico', color: 'open' },
  { value: 'AGUARDANDO_CLIENTE', label: 'Aguardando cliente', color: 'pending' },
  { value: 'CONCLUIDA', label: 'Concluída', color: 'done' },
  { value: 'SEM_CONSERTO', label: 'Sem conserto', color: 'pending' },
] as const

export type ServiceOrderStatusValue = (typeof SERVICE_ORDER_STATUS_OPTIONS)[number]['value']

export function validateServiceOrderStatus(status: unknown): { valid: boolean; error: string | null } {
  if (typeof status !== 'string') {
    return { valid: false, error: 'O status da OS é obrigatório.' }
  }

  const normalized = status.toUpperCase()
  const exists = SERVICE_ORDER_STATUS_OPTIONS.some((option) => option.value === normalized)
  if (!exists) {
    return { valid: false, error: `Status inválido: ${status}` }
  }

  return { valid: true, error: null }
}

export function getServiceOrderStatusLabel(status: string | null | undefined): string {
  const normalized = (status ?? '').toUpperCase()
  const option = SERVICE_ORDER_STATUS_OPTIONS.find((entry) => entry.value === normalized)
  return option?.label ?? (normalized || 'Sem status')
}

export function getServiceOrderStatusColor(status: string | null | undefined): string {
  const normalized = (status ?? '').toUpperCase()
  const option = SERVICE_ORDER_STATUS_OPTIONS.find((entry) => entry.value === normalized)
  return option?.color ?? 'default'
}
