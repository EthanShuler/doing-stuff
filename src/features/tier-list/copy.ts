import type { ListKey, TierKind, TierList } from '../../types'
import { listIdOf } from './derive'

/**
 * Per-kind wording + iconography, so the components stay kind-agnostic.
 * Movies and TV are "watched" (one shared date on the pool item — we watch
 * together); books are "read", and read state is per person (a
 * `tier_item_completions` row); ice cream is "tried" — shared like movies/TV,
 * but with no visible date (the item's shared `done_on` is just its
 * tried/not-tried marker). The reading list is also per person — each member
 * keeps their own (see `listIsPersonal`). `datesArePersonal()` / `listIsPersonal()` in
 * derive.ts are the behavior switches — this file is just the words.
 */
export interface KindCopy {
  /** Browser-tab / nav title for the kind's route. */
  pageTitle: string
  /** Whether dates appear in the UI at all. False = the item modal has no
   *  date field (tried/not-tried is managed by dragging on/off the shelf) and
   *  the watchlist rows drop the date. */
  usesDates: boolean
  /** Lowercase noun used inline in sentences: "Add a book". */
  noun: string
  /** Card / thumbnail fallback when there's no image. */
  emoji: string
  /** Example title for the modal's placeholder. */
  example: string
  /** Image URL field label in the item modal. */
  imageLabel: string
  /** Label of the item's shared `creator` field: who made it. */
  creatorLabel: string
  /** Tab label for the "want to" list. */
  listLabel: string
  /** Label of the second shelf (no date for the viewer yet). */
  shelfLabel: string
  /** Infinitive: "Add a book to read". */
  verb: string
  /** Past participle, lowercase: "haven't read it yet". */
  past: string
  /** Past participle, capitalized: "Read Jun 3". */
  pastCap: string
  /** Date field label in the item modal. */
  dateLabel: string
  /** Modal hint under the fields for a board add/edit. */
  boardHint: string
  /** Modal hint for a watchlist/reading-list add/edit. */
  listHint: string
  listEmptyTitle: string
  listEmptyBlurb: string
  /** Checked-off list row when the viewer has no date of their own. */
  onBoardNote: string
  /** Search-provider credit appended to the modal hint. */
  attribution: string
}

export const KIND_COPY: Record<TierKind, KindCopy> = {
  movie: {
    pageTitle: 'Movies',
    usesDates: true,
    noun: 'movie',
    emoji: '🎬',
    example: 'Paddington 2',
    imageLabel: 'Poster image URL',
    creatorLabel: 'Director',
    listLabel: 'Watchlist',
    shelfLabel: 'Unwatched',
    verb: 'watch',
    past: 'watched',
    pastCap: 'Watched',
    dateLabel: 'Watched on',
    boardHint: 'New movies land on both of your unranked shelves — or unwatched, with no watched date.',
    listHint: 'Check it off later and it joins both of your unranked shelves.',
    listEmptyTitle: 'Nothing to watch yet',
    listEmptyBlurb: 'Add a movie you both want to see. Check it off and it lands on your tier board, ready to rank.',
    onBoardNote: 'On your tier board — go rank it.',
    attribution: 'Title search by TMDB (not endorsed or certified by TMDB).',
  },
  tv: {
    pageTitle: 'TV',
    usesDates: true,
    noun: 'show',
    emoji: '📺',
    example: 'Severance',
    imageLabel: 'Poster image URL',
    creatorLabel: 'Creator',
    listLabel: 'Watchlist',
    shelfLabel: 'Unwatched',
    verb: 'watch',
    past: 'watched',
    pastCap: 'Watched',
    dateLabel: 'Watched on',
    boardHint: 'New shows land on both of your unranked shelves — or unwatched, with no watched date.',
    listHint: 'Check it off later and it joins both of your unranked shelves.',
    listEmptyTitle: 'Nothing to watch yet',
    listEmptyBlurb: 'Add a show you both want to see. Check it off and it lands on your tier board, ready to rank.',
    onBoardNote: 'On your tier board — go rank it.',
    attribution: 'Title search by TMDB (not endorsed or certified by TMDB).',
  },
  book: {
    pageTitle: 'Books',
    usesDates: true,
    noun: 'book',
    emoji: '📖',
    example: 'Piranesi',
    imageLabel: 'Cover image URL',
    creatorLabel: 'Author',
    listLabel: 'Reading list',
    shelfLabel: 'Unread',
    verb: 'read',
    past: 'read',
    pastCap: 'Read',
    dateLabel: 'Read on',
    boardHint:
      'New books land on your unranked shelf — or Unread with no date. Read dates are per person; your partner marks their own.',
    listHint:
      'This list is just yours. Check it off when you finish — it lands ready to rank for you, and unread for your partner.',
    listEmptyTitle: 'Nothing to read yet',
    listEmptyBlurb:
      'Add a book you want to read — this list is yours alone. Check it off when you finish and it lands on your tier board, ready to rank.',
    onBoardNote: 'On the board — it stays on your Unread shelf until you mark it read.',
    attribution: 'Book search by Open Library.',
  },
  'ice-cream': {
    pageTitle: 'Ice Cream',
    usesDates: false,
    noun: 'flavor',
    emoji: '🍦',
    example: 'Mint chocolate chip',
    imageLabel: 'Photo URL',
    creatorLabel: 'Brand or shop',
    listLabel: 'To-try list',
    shelfLabel: 'Not tried',
    verb: 'try',
    past: 'tried',
    pastCap: 'Tried',
    dateLabel: 'Tried on',
    boardHint: "New flavors land on both of your unranked shelves — drag one to Not tried if you haven't had it yet.",
    listHint: 'Check it off later and it joins both of your unranked shelves.',
    listEmptyTitle: 'Nothing to try yet',
    listEmptyBlurb: 'Add a flavor you both want to try. Check it off and it lands on your tier board, ready to rank.',
    onBoardNote: 'On your tier board — go rank it.',
    attribution: '',
  },
}

// --- Space-defined lists ------------------------------------------------------
// A custom list has no entry above: its behavior is fixed to the ice-cream
// template (shared pool, no visible dates, a shared to-<verb> list, hand-pasted
// image URLs, no search provider) and its WORDS come from the `tier_lists` row.
// So the copy is templated here rather than stored.

/** Capitalize a lowercase participle for a sentence start ("tried" → "Tried"). */
const capitalize = (word: string): string => (word ? word[0].toUpperCase() + word.slice(1) : word)

/** Fallback emoji for a list whose row left it blank. */
const LIST_EMOJI = '🏷️'

/** Build one custom list's wording from its row. */
export function customCopy(list: TierList): KindCopy {
  const { name, noun, verb, past } = list
  const listLabel = `To-${verb} list`
  return {
    pageTitle: name,
    // Custom lists follow ice cream: the shared done date is only a
    // done/not-done marker, managed by dragging on and off the shelf.
    usesDates: false,
    noun,
    emoji: list.emoji || LIST_EMOJI,
    // No provider knows what's on this list, so there's no example title to
    // suggest — the placeholder falls back to a plain prompt.
    example: '',
    imageLabel: 'Photo URL',
    creatorLabel: 'Source',
    listLabel,
    shelfLabel: `Not ${past}`,
    verb,
    past,
    pastCap: capitalize(past),
    dateLabel: `${capitalize(past)} on`,
    boardHint: `New ${noun}s land on both of your unranked shelves — drag one to Not ${past} if you haven't ${past} it yet.`,
    listHint: 'Check it off later and it joins both of your unranked shelves.',
    listEmptyTitle: `Nothing to ${verb} yet`,
    listEmptyBlurb: `Add a ${noun} you both want to ${verb}. Check it off and it lands on your tier board, ready to rank.`,
    onBoardNote: 'On your tier board — go rank it.',
    attribution: '',
  }
}

/**
 * The wording for whichever board is showing. Built-in keys read KIND_COPY;
 * a `list:<id>` key templates its row. A key whose row is missing — a partner
 * deleted the list a moment ago, and the realtime DELETE landed before the
 * page redirected — yields neutral placeholder copy instead of throwing, so
 * that render survives until the <Navigate> fires.
 */
export function copyFor(key: ListKey, lists: TierList[]): KindCopy {
  const listId = listIdOf(key)
  if (!listId) return KIND_COPY[key as TierKind]
  const list = lists.find((l) => l.id === listId)
  return customCopy(
    list ?? { id: listId, name: 'List', emoji: '', noun: 'item', verb: 'try', past: 'tried', createdBy: null, createdAt: '' },
  )
}
