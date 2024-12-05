import { fromNano, toNano } from '@ton/core'
import { Decimal } from 'decimal.js'

export function fromDecimalToNano(value: Decimal) {
  return toNano(value.toDecimalPlaces(9, Decimal.ROUND_DOWN).toFixed(9))
}

export function fromNanoToDecimal(value: string | bigint | number) {
  if (typeof value === 'bigint') return new Decimal(fromNano(value))
  return new Decimal(value).div(1e9)
}

export const executeUntilOk = async <T>(fn: () => Promise<T>, interval: number = 1000): Promise<T> => {
  while (true) {
    try {
      return await fn()
    } catch {
      await new Promise(resolve => setTimeout(resolve, interval))
    }
  }
}