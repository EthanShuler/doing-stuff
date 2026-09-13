import { describe, expect, it } from 'vitest'
import { posterSrc } from './imageUrl'

// Every case passes `dpr` explicitly — the default reads window.devicePixelRatio,
// which would make these depend on the test environment.

const TMDB = 'https://image.tmdb.org/t/p/w342/abc123.jpg'
const OL = 'https://covers.openlibrary.org/b/id/240727-L.jpg'

describe('posterSrc — TMDB', () => {
  it('shrinks a w342 poster to w154 for the 76px board card at 2x', () => {
    expect(posterSrc(TMDB, 76, 2)).toBe('https://image.tmdb.org/t/p/w154/abc123.jpg')
  })

  it('shrinks to w92 for the 38px list-row thumb at 2x', () => {
    expect(posterSrc(TMDB, 38, 2)).toBe('https://image.tmdb.org/t/p/w92/abc123.jpg')
  })

  it('picks the smallest width at or above the device pixels', () => {
    expect(posterSrc(TMDB, 76, 1)).toBe('https://image.tmdb.org/t/p/w92/abc123.jpg')
    expect(posterSrc(TMDB, 92, 1)).toBe('https://image.tmdb.org/t/p/w92/abc123.jpg')
    expect(posterSrc(TMDB, 93, 1)).toBe('https://image.tmdb.org/t/p/w154/abc123.jpg')
    expect(posterSrc(TMDB, 200, 1)).toBe('https://image.tmdb.org/t/p/w342/abc123.jpg')
  })

  it('caps the dpr multiplier at 2', () => {
    expect(posterSrc(TMDB, 76, 3)).toBe(posterSrc(TMDB, 76, 2))
    expect(posterSrc(TMDB, 76, 4)).toBe('https://image.tmdb.org/t/p/w154/abc123.jpg')
  })

  it('rewrites an `original` path too', () => {
    expect(posterSrc('https://image.tmdb.org/t/p/original/abc123.jpg', 76, 2)).toBe(
      'https://image.tmdb.org/t/p/w154/abc123.jpg',
    )
  })

  it('falls back to `original` when the box is wider than every served width', () => {
    expect(posterSrc(TMDB, 500, 2)).toBe('https://image.tmdb.org/t/p/original/abc123.jpg')
  })

  it('handles http as well as https', () => {
    expect(posterSrc('http://image.tmdb.org/t/p/w500/abc123.jpg', 38, 2)).toBe(
      'http://image.tmdb.org/t/p/w92/abc123.jpg',
    )
  })
})

describe('posterSrc — Open Library', () => {
  it('uses -S for a thumb, -M for a card, -L for anything bigger', () => {
    expect(posterSrc(OL, 20, 1)).toBe('https://covers.openlibrary.org/b/id/240727-S.jpg')
    expect(posterSrc(OL, 76, 1)).toBe('https://covers.openlibrary.org/b/id/240727-M.jpg')
    expect(posterSrc(OL, 76, 2)).toBe('https://covers.openlibrary.org/b/id/240727-M.jpg')
    expect(posterSrc(OL, 200, 1)).toBe('https://covers.openlibrary.org/b/id/240727-L.jpg')
  })

  it('handles the isbn and olid key variants', () => {
    expect(posterSrc('https://covers.openlibrary.org/b/isbn/9780140328721-M.jpg', 20, 1)).toBe(
      'https://covers.openlibrary.org/b/isbn/9780140328721-S.jpg',
    )
    expect(posterSrc('https://covers.openlibrary.org/b/olid/OL7353617M-S.jpg', 200, 1)).toBe(
      'https://covers.openlibrary.org/b/olid/OL7353617M-L.jpg',
    )
  })

  it('caps the dpr multiplier at 2', () => {
    expect(posterSrc(OL, 38, 4)).toBe(posterSrc(OL, 38, 2))
  })
})

describe('posterSrc — passthroughs', () => {
  it('leaves everything it does not recognise alone', () => {
    const untouched = [
      '',
      'blob:http://localhost:5173/8f0d-1234',
      'https://xyz.supabase.co/storage/v1/object/public/spoons/space/abc.jpg',
      'https://example.com/poster.jpg',
      // Near-misses: a different host, and a size segment we don't match.
      'https://image.tmdb.example.com/t/p/w342/abc.jpg',
      'https://covers.openlibrary.org/b/id/240727-XL.jpg',
    ]
    for (const url of untouched) expect(posterSrc(url, 76, 2)).toBe(url)
  })
})
