import type { ListKey, TierKind, TierList } from '../../types'
import { listIdOf } from './derive'

/**
 * Per-kind wording + iconography, so the components stay kind-agnostic.
 * Movies and TV are "watched" (one shared date on the pool item — we watch
 * together); books are "read", and read state is per person (a
 * `tier_item_completions` row). A space-defined list ("Ice Cream") tracks no
 * done date at all — no date field, no second shelf — so its `dates` is null.
 * `datesArePersonal()` / `hasUndatedShelf()` in derive.ts are the behavior
 * switches; this file is just the words.
 */
export interface KindCopy {
  /** Browser-tab / nav title for the kind's route. */
  pageTitle: string
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
  /** The date words — null on a board that tracks no date (a custom list),
   *  where the item modal shows no date field and the board has no second
   *  shelf: an item is either ranked or Unranked. Mirrors `hasUndatedShelf()`
   *  in derive.ts, which decides the same thing from the key. */
  dates: DateCopy | null
  /** Modal hint under the fields for a board add/edit. */
  boardHint: string
  /** Search-provider credit appended to the modal hint. */
  attribution: string
}

/** The date-flavored wording of a board that tracks one. */
export interface DateCopy {
  /** Heading of the shelf holding items with no date for the viewer. */
  shelfLabel: string
  /** Past participle, lowercase: "haven't read it yet". */
  past: string
  /** Date field label in the item modal. */
  fieldLabel: string
}

export const KIND_COPY: Record<TierKind, KindCopy> = {
  movie: {
    pageTitle: 'Movies',
    noun: 'movie',
    emoji: '🎬',
    example: 'Paddington 2',
    imageLabel: 'Poster image URL',
    creatorLabel: 'Director',
    dates: { shelfLabel: 'Unwatched', past: 'watched', fieldLabel: 'Watched on' },
    boardHint: 'New movies land on both of your unranked shelves — or unwatched, with no watched date.',
    attribution: 'Title search by TMDB (not endorsed or certified by TMDB).',
  },
  tv: {
    pageTitle: 'TV',
    noun: 'show',
    emoji: '📺',
    example: 'Severance',
    imageLabel: 'Poster image URL',
    creatorLabel: 'Creator',
    dates: { shelfLabel: 'Unwatched', past: 'watched', fieldLabel: 'Watched on' },
    boardHint: 'New shows land on both of your unranked shelves — or unwatched, with no watched date.',
    attribution: 'Title search by TMDB (not endorsed or certified by TMDB).',
  },
  book: {
    pageTitle: 'Books',
    noun: 'book',
    emoji: '📖',
    example: 'Piranesi',
    imageLabel: 'Cover image URL',
    creatorLabel: 'Author',
    dates: { shelfLabel: 'Unread', past: 'read', fieldLabel: 'Read on' },
    boardHint:
      'New books land on your unranked shelf — or Unread with no date. Read dates are per person; your partner marks their own.',
    attribution: 'Book search by Open Library.',
  },
}

// --- Space-defined lists ------------------------------------------------------
// A custom list has no entry above: its behavior is fixed to one template
// (shared pool, no dates and so one shelf, hand-pasted image URLs, no search
// provider) and its WORDS come from the `tier_lists` row. So the copy is
// templated here rather than stored. Only movies/TV/books stay built in, for
// their search providers and want-to lists.

/** Fallback emoji for a list whose row left it blank. */
const LIST_EMOJI = '🏷️'

/** Build one custom list's wording from its row. */
export function customCopy(list: TierList): KindCopy {
  const { name, noun, shared } = list
  return {
    pageTitle: name,
    noun,
    emoji: list.emoji || LIST_EMOJI,
    // No provider knows what's on this list, so there's no example title to
    // suggest — the placeholder falls back to a plain prompt.
    example: '',
    imageLabel: 'Photo URL',
    creatorLabel: 'Source',
    // No done date: an item is ranked, or it's unranked.
    dates: null,
    // A shared list has one board, so there's only one shelf to land on.
    boardHint: shared
      ? `New ${noun}s land on the unranked shelf — drag one into a tier to rank it.`
      : `New ${noun}s land on both of your unranked shelves — drag one into a tier to rank it.`,
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
    list ?? { id: listId, name: 'List', emoji: '', noun: 'item', shared: false, createdBy: null, createdAt: '' },
  )
}
