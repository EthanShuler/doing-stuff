import { describe, expect, it } from 'vitest'
import { parseReleaseYear, yearFromIsoDate, yearFromUnix } from './releaseYear'

describe('parseReleaseYear', () => {
  it('reads a four-digit year', () => {
    expect(parseReleaseYear('2019')).toBe(2019)
    expect(parseReleaseYear(' 1937 ')).toBe(1937)
  })

  it('blank clears', () => {
    expect(parseReleaseYear('')).toBeNull()
    expect(parseReleaseYear('   ')).toBeNull()
  })

  it('rejects anything that is not a year', () => {
    expect(parseReleaseYear('soon')).toBeUndefined()
    expect(parseReleaseYear('19')).toBeUndefined()
    expect(parseReleaseYear('2019-05-30')).toBeUndefined()
    expect(parseReleaseYear('0999')).toBeUndefined()
  })
})

describe('provider helpers', () => {
  it('yearFromIsoDate', () => {
    expect(yearFromIsoDate('2019-05-30')).toBe(2019)
    expect(yearFromIsoDate('')).toBeNull()
    expect(yearFromIsoDate(undefined)).toBeNull()
  })

  it('yearFromUnix uses UTC', () => {
    // 2020-01-01T00:00:00Z — a local-time read west of UTC would say 2019.
    expect(yearFromUnix(1577836800)).toBe(2020)
    expect(yearFromUnix(undefined)).toBeNull()
  })
})
