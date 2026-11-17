import { describe, expect, it } from 'vitest'
import { originOf } from './lineage'

describe('originOf', () => {
  it('is the row’s own id for a row made here', () => {
    expect(originOf({ id: 'a', copiedFrom: null })).toBe('a')
  })

  it('is the root for a pulled row, so a copy of a copy matches the original', () => {
    const original = { id: 'a', copiedFrom: null }
    const copy = { id: 'b', copiedFrom: originOf(original) }
    const copyOfCopy = { id: 'c', copiedFrom: originOf(copy) }
    expect(originOf(copy)).toBe('a')
    expect(originOf(copyOfCopy)).toBe('a')
  })
})
