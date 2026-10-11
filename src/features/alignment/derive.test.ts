import { describe, expect, it } from 'vitest'
import type { AlignmentChart } from '../../types'
import { ALIGNMENT_KEYS, alignmentLabel, defaultChart, emptyCells, filledCount, sortCharts, withCell } from './derive'
import { seed } from './useAlignmentStore'

const chart = (overrides: Partial<AlignmentChart>): AlignmentChart => ({
  id: 'c1',
  title: 'Chart',
  cells: emptyCells(),
  createdBy: null,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('ALIGNMENT_KEYS', () => {
  it('is the nine squares in reading order, Good row first', () => {
    expect(ALIGNMENT_KEYS.map(alignmentLabel)).toEqual([
      'Lawful Good',
      'Neutral Good',
      'Chaotic Good',
      'Lawful Neutral',
      'True Neutral',
      'Chaotic Neutral',
      'Lawful Evil',
      'Neutral Evil',
      'Chaotic Evil',
    ])
  })
})

describe('emptyCells', () => {
  it('has every square, all blank', () => {
    const cells = emptyCells()
    expect(Object.keys(cells).sort()).toEqual([...ALIGNMENT_KEYS].sort())
    expect(Object.values(cells).every((text) => text === '')).toBe(true)
  })
})

describe('sortCharts / defaultChart', () => {
  const older = chart({ id: 'b', createdAt: '2026-01-01T00:00:00Z' })
  const newer = chart({ id: 'a', createdAt: '2026-05-01T00:00:00Z' })

  it('orders oldest first without mutating', () => {
    const input = [newer, older]
    expect(sortCharts(input).map((c) => c.id)).toEqual(['b', 'a'])
    expect(input.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('forwards to the oldest chart, or none', () => {
    expect(defaultChart([newer, older])?.id).toBe('b')
    expect(defaultChart([])).toBeNull()
  })
})

describe('filledCount / withCell', () => {
  it('counts non-blank squares', () => {
    const c = chart({ cells: { ...emptyCells(), lawful_good: 'BLT', true_neutral: '   ' } })
    expect(filledCount(c)).toBe(1)
  })

  it('sets one trimmed square and leaves the rest', () => {
    const before = chart({ cells: { ...emptyCells(), lawful_good: 'BLT' } })
    const after = withCell(before, 'chaotic_evil', '  Pop-Tart ')
    expect(after.cells.chaotic_evil).toBe('Pop-Tart')
    expect(after.cells.lawful_good).toBe('BLT')
    expect(before.cells.chaotic_evil).toBe('')
  })
})

describe('seed', () => {
  it('has one full chart and one partly filled', () => {
    const charts = sortCharts(seed())
    expect(charts.map(filledCount)).toEqual([9, 5])
  })
})
