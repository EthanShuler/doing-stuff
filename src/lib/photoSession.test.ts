import { describe, expect, it } from 'vitest'
import { createPhotoTracker } from './photoSession'

const setup = () => {
  const removed: string[] = []
  const tracker = createPhotoTracker((url) => removed.push(url))
  return { tracker, removed }
}

describe('createPhotoTracker', () => {
  it('deletes a picked photo when the modal is cancelled', async () => {
    const { tracker, removed } = setup()
    tracker.begin('')
    await tracker.track(Promise.resolve('a'))
    tracker.discard()
    expect(removed).toEqual(['a'])
  })

  it('never deletes the opened-with photo on discard', async () => {
    const { tracker, removed } = setup()
    tracker.begin('orig')
    await tracker.track(Promise.resolve('a'))
    tracker.discard()
    expect(removed).toEqual(['a'])
  })

  it('deletes the previous session upload on a second pick, not the original', async () => {
    const { tracker, removed } = setup()
    tracker.begin('orig')
    await tracker.track(Promise.resolve('a'))
    await tracker.track(Promise.resolve('b'))
    expect(removed).toEqual(['a'])
  })

  it('on save, deletes the replaced original and keeps the saved upload', async () => {
    const { tracker, removed } = setup()
    tracker.begin('orig')
    await tracker.track(Promise.resolve('a'))
    tracker.commit('a')
    expect(removed).toEqual(['orig'])
  })

  it('on save of a removed photo, deletes the original and any session upload', async () => {
    const { tracker, removed } = setup()
    tracker.begin('orig')
    await tracker.track(Promise.resolve('a'))
    tracker.commit('')
    expect(removed).toEqual(['a', 'orig'])
  })

  it('an unchanged photo is never deleted — even if the live row moved on', () => {
    // The partner replaced orig → y meanwhile; our text-only save must not touch y.
    const { tracker, removed } = setup()
    tracker.begin('orig')
    tracker.commit('orig')
    expect(removed).toEqual([])
  })

  it('clearing the photo deletes nothing until the save lands', () => {
    const { tracker, removed } = setup()
    tracker.begin('orig')
    // (A failed save leaves the session open; then the user cancels.)
    tracker.discard()
    expect(removed).toEqual([])
  })

  it('discard right after commit is a no-op', async () => {
    const { tracker, removed } = setup()
    tracker.begin('')
    await tracker.track(Promise.resolve('a'))
    tracker.commit('a')
    tracker.discard()
    expect(removed).toEqual([])
  })

  it('an upload that lands after the session ended is deleted and dropped', async () => {
    const { tracker, removed } = setup()
    tracker.begin('')
    let resolve!: (url: string) => void
    const pending = tracker.track(new Promise((r) => (resolve = r)))
    tracker.discard()
    tracker.begin('other')
    resolve('late')
    expect(await pending).toBeNull()
    expect(removed).toEqual(['late'])
    // …and it isn't swept into the next session's bookkeeping.
    tracker.discard()
    expect(removed).toEqual(['late'])
  })

  it('a failed upload tracks nothing', async () => {
    const { tracker, removed } = setup()
    tracker.begin('')
    await expect(tracker.track(Promise.reject(new Error('nope')))).rejects.toThrow('nope')
    tracker.discard()
    expect(removed).toEqual([])
  })
})
