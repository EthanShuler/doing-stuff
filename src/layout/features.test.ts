import { describe, expect, it } from 'vitest'
import { FEATURES, enabledFeatures, featureForPath, isActive, landingPath } from './features'

const keys = (fs: readonly { key: string }[]) => fs.map((f) => f.key)

describe('FEATURES', () => {
  it('has unique keys and paths', () => {
    expect(new Set(keys(FEATURES)).size).toBe(FEATURES.length)
    expect(new Set(FEATURES.map((f) => f.path)).size).toBe(FEATURES.length)
  })

  it('keeps the stored keys stable (spaces persist them)', () => {
    expect(keys(FEATURES).sort()).toEqual(
      [
        'alignment',
        'doing-stuff',
        'lists',
        'little-guys',
        'music-practice',
        'parks',
        'recipes',
        'seasons',
        'spoons',
        'tier-lists',
      ].sort(),
    )
  })

  it('every feature lands on a path it matches', () => {
    for (const f of FEATURES) expect(isActive(f.matches, f.path)).toBe(true)
  })
})

describe('featureForPath', () => {
  it('claims a feature’s routes and their sub-paths', () => {
    expect(featureForPath('/log')?.key).toBe('doing-stuff')
    expect(featureForPath('/calendar')?.key).toBe('doing-stuff')
    expect(featureForPath('/recipes/abc')?.key).toBe('recipes')
    expect(featureForPath('/recipes/plan')?.key).toBe('recipes')
    expect(featureForPath('/tiers/xyz')?.key).toBe('tier-lists')
    expect(featureForPath('/games')?.key).toBe('tier-lists')
    expect(featureForPath('/lists/books')?.key).toBe('lists')
    expect(featureForPath('/seasons/fall-2026')?.key).toBe('seasons')
  })

  it('returns null for the hub, admin, placeholders and unknown paths', () => {
    expect(featureForPath('/')).toBeNull()
    expect(featureForPath('/admin')).toBeNull()
    expect(featureForPath('/french-toast')).toBeNull()
    expect(featureForPath('/nope')).toBeNull()
  })

  it('does not match on a bare prefix', () => {
    // '/listsx' isn't under '/lists'.
    expect(featureForPath('/listsx')).toBeNull()
  })
})

describe('enabledFeatures', () => {
  it('null means every feature, in nav order', () => {
    expect(keys(enabledFeatures(null))).toEqual(keys(FEATURES))
  })

  it('an allow-list keeps nav order regardless of the stored order', () => {
    expect(keys(enabledFeatures(['seasons', 'recipes', 'tier-lists']))).toEqual(['tier-lists', 'recipes', 'seasons'])
  })

  it('ignores unknown keys', () => {
    expect(keys(enabledFeatures(['gone-feature', 'spoons']))).toEqual(['spoons'])
  })

  it('an empty allow-list is empty — no fallback to everything', () => {
    expect(enabledFeatures([])).toEqual([])
  })

  it('returns a copy, never FEATURES itself', () => {
    expect(enabledFeatures(null)).not.toBe(FEATURES)
  })
})

describe('landingPath', () => {
  const friends = enabledFeatures(['tier-lists', 'lists', 'recipes', 'seasons'])

  it('keeps the feature but drops the id-bearing sub-path', () => {
    expect(landingPath('/recipes/abc', friends)).toBe('/recipes')
    expect(landingPath('/recipes/plan', friends)).toBe('/recipes')
    expect(landingPath('/tiers/xyz', friends)).toBe('/movies')
    expect(landingPath('/lists/g1', friends)).toBe('/lists/movies')
    expect(landingPath('/seasons/fall-2026', friends)).toBe('/seasons')
  })

  it('goes to the hub when the new space lacks the feature', () => {
    expect(landingPath('/spoons', friends)).toBe('/')
    expect(landingPath('/calendar', friends)).toBe('/')
    expect(landingPath('/recipes', enabledFeatures([]))).toBe('/')
  })

  it('goes to the hub from pages that aren’t a feature', () => {
    expect(landingPath('/', friends)).toBe('/')
    expect(landingPath('/admin', friends)).toBe('/')
    expect(landingPath('/french-toast', enabledFeatures(null))).toBe('/')
  })
})
