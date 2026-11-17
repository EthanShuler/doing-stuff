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
 *
 * A space with Tier Lists turned off still gets the tier item written on
 * check-off (the data is there if the feature comes back), but nothing should
 * promise a board nobody can open — `copyFor(..., { boards: false })` swaps
 * in the board-free wording below.
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
  /** Checking a row off lands it on a tier board this space can see. False
   *  for a free-form list (it just stamps the row done) — and for the
   *  built-ins in a space with Tier Lists off, where the tier item is still
   *  written but no board shows it. */
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
    hint: 'Check it off later and it lands on everyone’s unranked shelf.',
    emptyTitle: 'Nothing to watch yet',
    emptyBlurb: 'Movies to watch. Checking one off adds it to your tier board.',
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
    hint: 'Check it off later and it lands on everyone’s unranked shelf.',
    emptyTitle: 'Nothing to watch yet',
    emptyBlurb: 'Shows to watch. Checking one off adds it to your tier board.',
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
    hint: 'Only you see this list. Checking a book off adds it to your board, unranked.',
    emptyTitle: 'Nothing to read yet',
    emptyBlurb:
      'Books to read. Only you see this list. Checking one off adds it to your board, unranked.',
    onBoardNote: 'On the board — it stays on your Unread shelf until you mark it read.',
    attribution: 'Book search by Open Library.',
    searchKind: 'book',
    linksToBoard: true,
    hasImage: true,
  },
}

// --- Without a tier board -----------------------------------------------------
// The built-ins' words when the space has Tier Lists off: checking a row off
// just moves it to Done, as far as anyone can see.

const NO_BOARD_COPY: Record<'movie' | 'tv' | 'book', Pick<ListCopy, 'hint' | 'emptyBlurb'>> = {
  movie: {
    hint: 'Checked-off movies move to Done.',
    emptyBlurb: 'Movies to watch. Checking one off moves it to Done.',
  },
  tv: {
    hint: 'Checked-off shows move to Done.',
    emptyBlurb: 'Shows to watch. Checking one off moves it to Done.',
  },
  book: {
    hint: 'Only you see this list. Checked-off books move to Done.',
    emptyBlurb: 'Books to read. Only you see this list.',
  },
}

/** A built-in list's wording with no board to promise. */
function withoutBoard(kind: 'movie' | 'tv' | 'book'): ListCopy {
  return { ...LIST_COPY[kind], ...NO_BOARD_COPY[kind], onBoardNote: '', linksToBoard: false }
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
    emptyBlurb: 'Checked-off rows move to Done.',
    onBoardNote: '',
    attribution: '',
    searchKind: null,
    linksToBoard: false,
    hasImage: false,
  }
}

/**
 * The wording for whichever list is showing. Built-in refs read LIST_COPY; a
 * `custom:<id>` ref templates its row. A ref whose row is missing — someone
 * deleted the list a moment ago, and the realtime DELETE landed before the
 * page redirected — yields neutral placeholder copy instead of throwing, so
 * that render survives until the <Navigate> fires. `boards: false` (the space
 * has Tier Lists off) drops every promise that a checked-off row lands on a
 * board.
 */
export function copyFor(ref: ListRef, lists: ListDef[], { boards = true }: { boards?: boolean } = {}): ListCopy {
  const listId = listIdOf(ref)
  if (!listId) {
    const kind = ref as 'movie' | 'tv' | 'book'
    return boards ? LIST_COPY[kind] : withoutBoard(kind)
  }
  const def = lists.find((l) => l.id === listId)
  return customListCopy(def ?? { id: listId, name: 'List', emoji: '', createdBy: null, createdAt: '' })
}
