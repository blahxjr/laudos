import assert from 'node:assert/strict'
import test from 'node:test'
import { applyStockDelta, isLowStock } from '../src/server/stockFlow.ts'

test('decrement updates stock quantity and flags low stock when below minimum', () => {
  const result = applyStockDelta({ currentStock: 5, minimumStock: 3, quantity: 2, direction: 'decrement' })

  assert.equal(result.valid, true)
  assert.equal(result.stockQuantity, 3)
  assert.equal(isLowStock(result.stockQuantity, 3), false)
})

test('blocks decrement when it would make stock negative', () => {
  const result = applyStockDelta({ currentStock: 2, minimumStock: 3, quantity: 3, direction: 'decrement' })

  assert.equal(result.valid, false)
  assert.match(result.error ?? '', /não pode ficar negativo/)
})
