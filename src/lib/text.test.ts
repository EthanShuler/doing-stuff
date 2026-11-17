import { describe, expect, it } from 'vitest'
import { firstGrapheme, titleKey } from './text'

describe('titleKey', () => {
  it('ignores case and surrounding whitespace', () => {
    expect(titleKey('  Spirited Away ')).toBe('spirited away')
    expect(titleKey('SPIRITED AWAY')).toBe(titleKey('spirited away'))
  })

  it('collapses inner whitespace runs, tabs and newlines included', () => {
    expect(titleKey('The   Princess\tBride')).toBe('the princess bride')
    expect(titleKey('Paddington\n2')).toBe('paddington 2')
  })

  it('keeps punctuation, so different titles stay different', () => {
    expect(titleKey('Tomorrow, and Tomorrow')).not.toBe(titleKey('Tomorrow and Tomorrow'))
  })

  it('is empty for a blank title', () => {
    expect(titleKey('   ')).toBe('')
  })
})

describe('firstGrapheme', () => {
  it('keeps one whole emoji, ZWJ sequences included', () => {
    expect(firstGrapheme(' 👨‍👩‍👧x ')).toBe('👨‍👩‍👧')
    expect(firstGrapheme('')).toBe('')
  })
})
