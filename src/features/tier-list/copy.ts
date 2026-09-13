import type { ListKey, TierKind, TierList } from '../../types'
import { listIdOf } from './derive'

/**
 * Per-kind wording + iconography, so the components stay kind-agnostic.
 * Movies and TV are "watched" (one shared date on the pool item — we watch
 * together); books are "read", and read state is per person (a
 * `tier_item_completions` row); ice cream is "tried" — shared like movies/TV,
 * but with no visible date (the item's shared `done_on` is just its
 * tried/not-tried marker). `datesArePersonal()` in derive.ts is the behavior
 * switch — this file is just the words.
 */
export interface KindCopy {
  /** Browser-tab / nav title for the kind's route. */
  pageTitle: string
  /** Whether dates appear in the UI at all. False = the item modal has no
   *  date field (tried/not-tried is managed by dragging on/off the shelf). */
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
  /** Label of the second shelf (no date for the viewer yet). */
  shelfLabel: string
  /** Past participle, lowercase: "haven't read it yet". */
  past: string
  /** Date field label in the item modal. */
  dateLabel: string
  /** Modal hint under the fields for a board add/edit. */
  boardHint: string
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
    shelfLabel: 'Unwatched',
    past: 'watched',
    dateLabel: 'Watched on',
    boardHint: 'New movies land on both of your unranked shelves — or unwatched, with no watched date.',
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
    shelfLabel: 'Unwatched',
    past: 'watched',
    dateLabel: 'Watched on',
    boardHint: 'New shows land on both of your unranked shelves — or unwatched, with no watched date.',
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
    shelfLabel: 'Unread',
    past: 'read',
    dateLabel: 'Read on',
    boardHint:
      'New books land on your unranked shelf — or Unread with no date. Read dates are per person; your partner marks their own.',
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
    shelfLabel: 'Not tried',
    past: 'tried',
    dateLabel: 'Tried on',
    boardHint: "New flavors land on both of your unranked shelves — drag one to Not tried if you haven't had it yet.",
    attribution: '',
  },
}

// --- Space-defined lists ------------------------------------------------------
// A custom list has no entry above: its behavior is fixed to the ice-cream
// template (shared pool, no visible dates, hand-pasted image URLs, no search
// provider) and its WORDS come from the `tier_lists` row. So the copy is
// templated here rather than stored.

/** Capitalize a lowercase participle for a sentence start ("tried" → "Tried"). */
const capitalize = (word: string): string => (word ? word[0].toUpperCase() + word.slice(1) : word)

/** Fallback emoji for a list whose row left it blank. */
const LIST_EMOJI = '🏷️'

/** Build one custom list's wording from its row. */
export function customCopy(list: TierList): KindCopy {
  const { name, noun, past, shared } = list
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
    shelfLabel: `Not ${past}`,
    past,
    dateLabel: `${capitalize(past)} on`,
    // A shared list has one board, so there's only one shelf to land on.
    boardHint: shared
      ? `New ${noun}s land on the unranked shelf — drag one to Not ${past} if you haven't ${past} it yet.`
      : `New ${noun}s land on both of your unranked shelves — drag one to Not ${past} if you haven't ${past} it yet.`,
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
    list ?? { id: listId, name: 'List', emoji: '', noun: 'item', past: 'tried', shared: false, createdBy: null, createdAt: '' },
  )
}
