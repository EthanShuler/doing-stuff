import { describe, expect, it } from 'vitest'
import type { Spoon } from '../../types'
import { markerBounds, sortSpoons, spoonMarkers } from './derive'

let counter = 0
function spoon(overrides: Partial<Spoon> = {}): Spoon {
  counter += 1
  return {
    id: `s${counter}`,
    name: `Spoon ${counter}`,
    imageUrl: '',
    place: '',
    lat: null,
    lng: null,
    acquiredOn: null,
    notes: '',
    createdBy: null,
    createdAt: `2026-01-01T00:00:${String(counter).padStart(2, '0')}Z`,
    ...overrides,
  }
}

describe('sortSpoons', () => {
  it('orders dated spoons newest first, undated last', () => {
    const old = spoon({ acquiredOn: '2025-03-01' })
    const recent = spoon({ acquiredOn: '2026-06-15' })
    const undated = spoon({ acquiredOn: null })
    expect(sortSpoons([old, undated, recent]).map((s) => s.id)).toEqual([recent.id, old.id, undated.id])
  })

  it('breaks ties (same date, and among undated) by newest createdAt', () => {
    const a = spoon({ acquiredOn: '2026-05-01', createdAt: '2026-05-01T08:00:00Z' })
    const b = spoon({ acquiredOn: '2026-05-01', createdAt: '2026-05-02T08:00:00Z' })
    const u1 = spoon({ createdAt: '2026-04-01T08:00:00Z' })
    const u2 = spoon({ createdAt: '2026-04-09T08:00:00Z' })
    expect(sortSpoons([a, u1, b, u2]).map((s) => s.id)).toEqual([b.id, a.id, u2.id, u1.id])
  })

  it('does not mutate its input', () => {
    const list = [spoon({ acquiredOn: '2025-01-01' }), spoon({ acquiredOn: '2026-01-01' })]
    const before = list.map((s) => s.id)
    sortSpoons(list)
    expect(list.map((s) => s.id)).toEqual(before)
  })
})

describe('spoonMarkers', () => {
  it('drops spoons without coords and keeps lone pins exactly in place', () => {
    const located = spoon({ lat: 48.8566, lng: 2.3522 })
    const unlocated = spoon()
    const markers = spoonMarkers([located, unlocated])
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({ lat: 48.8566, lng: 2.3522 })
    expect(markers[0].spoon.id).toBe(located.id)
  })

  it('fans out spoons sharing (nearly) identical coords into distinct clickable pins', () => {
    // Slight wobble within ~11m still counts as the same place.
    const a = spoon({ lat: 48.8566, lng: 2.3522 })
    const b = spoon({ lat: 48.85661, lng: 2.35219 })
    const c = spoon({ lat: 48.8566, lng: 2.3522 })
    const markers = spoonMarkers([a, b, c])
    expect(markers).toHaveLength(3)
    const keys = markers.map((m) => `${m.lat},${m.lng}`)
    expect(new Set(keys).size).toBe(3)
    // Each pin stays near the shared point (well under ~100m of drift).
    for (const m of markers) {
      expect(Math.abs(m.lat - 48.8566)).toBeLessThan(0.001)
      expect(Math.abs(m.lng - 2.3522)).toBeLessThan(0.001)
    }
  })

  it('is deterministic — same data, same layout', () => {
    const spoons = [
      spoon({ lat: 48.8566, lng: 2.3522, acquiredOn: '2026-05-04' }),
      spoon({ lat: 48.8566, lng: 2.3522, acquiredOn: '2026-05-06' }),
    ]
    expect(spoonMarkers(spoons)).toEqual(spoonMarkers([...spoons].reverse()))
  })

  it('leaves distinct places untouched', () => {
    const paris = spoon({ lat: 48.8566, lng: 2.3522 })
    const banff = spoon({ lat: 51.1784, lng: -115.5708 })
    const markers = spoonMarkers([paris, banff])
    expect(markers.map((m) => [m.lat, m.lng])).toEqual(
      expect.arrayContaining([
        [48.8566, 2.3522],
        [51.1784, -115.5708],
      ]),
    )
  })
})

describe('markerBounds', () => {
  it('returns null with no pins', () => {
    expect(markerBounds([])).toBeNull()
  })

  it('encloses every pin', () => {
    const markers = spoonMarkers([
      spoon({ lat: 48.8566, lng: 2.3522 }),
      spoon({ lat: 37.7749, lng: -122.4194 }),
      spoon({ lat: 51.1784, lng: -115.5708 }),
    ])
    expect(markerBounds(markers)).toEqual([
      [37.7749, -122.4194],
      [51.1784, 2.3522],
    ])
  })
})
