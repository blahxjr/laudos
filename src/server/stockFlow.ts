export type StockDeltaDirection = 'increment' | 'decrement'

export type StockDeltaResult = {
  valid: boolean
  stockQuantity: number
  error?: string
}

export function applyStockDelta({
  currentStock,
  minimumStock,
  quantity,
  direction,
}: {
  currentStock: number
  minimumStock: number
  quantity: number
  direction: StockDeltaDirection
}): StockDeltaResult {
  const normalizedQuantity = Number(quantity)
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    return { valid: false, stockQuantity: currentStock, error: 'quantity must be a positive number' }
  }

  const normalizedCurrentStock = Number(currentStock)
  const normalizedMinimumStock = Number(minimumStock)

  const nextStock = direction === 'decrement'
    ? normalizedCurrentStock - normalizedQuantity
    : normalizedCurrentStock + normalizedQuantity

  if (nextStock < 0) {
    return { valid: false, stockQuantity: normalizedCurrentStock, error: 'o estoque não pode ficar negativo' }
  }

  return {
    valid: true,
    stockQuantity: nextStock,
  }
}

export function isLowStock(stockQuantity: number, minimumStock: number) {
  return Number(stockQuantity) < Number(minimumStock)
}
