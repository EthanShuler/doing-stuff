import type { TierKind } from '../../types'

/**
 * Per-kind wording + iconography, so the components stay kind-agnostic.
 * Movies and TV are "watched" (one shared date on the pool item — we watch
 * together); books are "read", and read state is per person (see
 * `tier_item_reads`); ice cream is "tried" — shared like movies/TV, but with
 * no visible date (the shared `watched_on` is just its tried/not-tried
 * marker). `datesArePersonal()` in derive.ts is the behavior switch — this
 * file is just the words.
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
    listLabel: 'Reading list',
    shelfLabel: 'Unread',
    verb: 'read',
    past: 'read',
    pastCap: 'Read',
    dateLabel: 'Read on',
    boardHint:
      'New books land on your unranked shelf — or Unread with no date. Read dates are per person; your partner marks their own.',
    listHint: 'Check it off when you finish — it lands ready to rank for you, and unread for your partner.',
    listEmptyTitle: 'Nothing to read yet',
    listEmptyBlurb:
      'Add a book either of you wants to read. Check it off when you finish and it lands on your tier board, ready to rank.',
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
