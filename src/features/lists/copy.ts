import type { ListDef, ListRef } from '../../types'
import type { SearchKind } from '../../components/TitleSearchInput'
import { listIdOf } from './derive'

/**
 * Per-list wording, so the components stay list-agnostic. Movies and TV are
 * "watched", books are "read" (and that list is per person — see
 * `listIsPersonal` in derive.ts), a free-form list is just "done".
 *
 * The behavior switches live in derive.ts; this file is only the words —
 * except for the three flags at the bottom, which say what a list HAS
 * (a board to promote onto, images, a title-lookup provider) rather than what
 * it's called.
 */
export interface ListCopy {
  /** Picker pill label and page title: "Movies", "Groceries". */
  label: string
  /** Pill / fallback-thumb emoji. */
  emoji: string
  /** Lowercase singular noun used inline: "+ Add a movie…". */
  noun: string
  /** Infinitive: "3 to watch". */
  verb: string
  /** Past participle, lowercase: "2 watched", "Mark watched". */
  past: string
  /** Label of the row's `creator` field: who made it (a free-form list reuses
   *  the column as a plain note). */
  creatorLabel: string
  /** Image URL field label in the edit modal. */
  imageLabel: string
  /** Quick-add field placeholder: "+ Add a movie…", "+ Add to Groceries…". */
  addPlaceholder: string
  /** Example title for the quick-add / modal placeholder. '' = none. */
  example: string
  /** Hint under the edit modal's fields. */
  hint: string
  emptyTitle: string
  emptyBlurb: string
  /** Caption under a checked-off row, when checking off made a tier card. */
  onBoardNote: string
  /** Search-provider credit appended to the modal hint. */
  attribution: string
  /** Which provider backs title suggestions (null = plain hand entry). */
  searchKind: SearchKind
  /** Checking a row off creates a tier item on the matching board. False for
   *  a free-form list: it just stamps the row done. */
  linksToBoard: boolean
  /** Whether rows carry a poster/cover at all. */
  hasImage: boolean
}

export const LIST_COPY: Record<'movie' | 'tv' | 'book', ListCopy> = {
  movie: {
    label: 'Movies',
    emoji: '🎬',
    noun: 'movie',
    addPlaceholder: '+ Add a movie…',
    verb: 'watch',
    past: 'watched',
    creatorLabel: 'Director',
    imageLabel: 'Poster image URL',
    example: 'Paddington 2',
    hint: 'Check it off later and it joins both of your unranked shelves.',
    emptyTitle: 'Nothing to watch yet',
    emptyBlurb: 'Add a movie you both want to see. Check it off and it lands on your tier board, ready to rank.',
    onBoardNote: 'On your tier board — go rank it.',
    attribution: 'Title search by TMDB (not endorsed or certified by TMDB).',
    searchKind: 'movie',
    linksToBoard: true,
    hasImage: true,
  },
  tv: {
    label: 'TV',
    emoji: '📺',
    noun: 'show',
    addPlaceholder: '+ Add a show…',
    verb: 'watch',
    past: 'watched',
    creatorLabel: 'Creator',
    imageLabel: 'Poster image URL',
    example: 'Severance',
    hint: 'Check it off later and it joins both of your unranked shelves.',
    emptyTitle: 'Nothing to watch yet',
    emptyBlurb: 'Add a show you both want to see. Check it off and it lands on your tier board, ready to rank.',
    onBoardNote: 'On your tier board — go rank it.',
    attribution: 'Title search by TMDB (not endorsed or certified by TMDB).',
    searchKind: 'tv',
    linksToBoard: true,
    hasImage: true,
  },
  book: {
    label: 'Books',
    emoji: '📖',
    noun: 'book',
    addPlaceholder: '+ Add a book…',
    verb: 'read',
    past: 'read',
    creatorLabel: 'Author',
    imageLabel: 'Cover image URL',
    example: 'Piranesi',
    hint: 'This list is just yours. Check it off when you finish — it lands ready to rank for you, and unread for your partner.',
    emptyTitle: 'Nothing to read yet',
    emptyBlurb:
      'Add a book you want to read — this list is yours alone. Check it off when you finish and it lands on your tier board, ready to rank.',
    onBoardNote: 'On the board — it stays on your Unread shelf until you mark it read.',
    attribution: 'Book search by Open Library.',
    searchKind: 'book',
    linksToBoard: true,
    hasImage: true,
  },
}

// --- Free-form lists ----------------------------------------------------------
// A free-form list has no entry above: its behavior is fixed (shared rows, no
// image, no search provider, nothing to promote onto — checking a row off just
// stamps it done) and the only thing it configures is its NAME. So the copy is
// templated here rather than stored.

/** Fallback emoji for a list whose row left it blank. */
const LIST_EMOJI = '🏷️'

/** Build one free-form list's wording from its row. */
export function customListCopy(def: ListDef): ListCopy {
  return {
    label: def.name,
    emoji: def.emoji || LIST_EMOJI,
    noun: 'item',
    // "a item" is wrong and "an item" reads like a form — name the list instead.
    addPlaceholder: `+ Add to ${def.name}…`,
    verb: 'do',
    past: 'done',
    // The `creator` column carries a free-text note on a free-form row.
    creatorLabel: 'Note',
    imageLabel: 'Image URL',
    // No provider knows what's on this list, so there's no example to suggest.
    example: '',
    hint: 'Check it off when it’s done — it stays on the list, below the open rows.',
    emptyTitle: `Nothing on ${def.name} yet`,
    emptyBlurb: 'Add the first thing above. Check rows off as you go — they drop into Done, not away.',
    onBoardNote: '',
    attribution: '',
    searchKind: null,
    linksToBoard: false,
    hasImage: false,
  }
}

/**
 * The wording for whichever list is showing. Built-in refs read LIST_COPY; a
 * `custom:<id>` ref templates its row. A ref whose row is missing — a partner
 * deleted the list a moment ago, and the realtime DELETE landed before the
 * page redirected — yields neutral placeholder copy instead of throwing, so
 * that render survives until the <Navigate> fires.
 */
export function copyFor(ref: ListRef, lists: ListDef[]): ListCopy {
  const listId = listIdOf(ref)
  if (!listId) return LIST_COPY[ref as 'movie' | 'tv' | 'book']
  const def = lists.find((l) => l.id === listId)
  return customListCopy(def ?? { id: listId, name: 'List', emoji: '', createdBy: null, createdAt: '' })
}
