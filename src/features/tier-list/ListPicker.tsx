import type { ListKey, TierKind, TierList } from '../../types'
import { PickerRow } from '../../components/PickerRow'
import type { PickerEntry } from '../../components/PickerRow'
import { KIND_COPY } from './copy'
import { listKeyFor } from './derive'

/** The four built-in boards, in nav order. Each keeps its own URL, so the
 *  pills navigate rather than set local state — back/forward keeps working and
 *  the store (one component across all the routes) never refetches. */
const BUILT_INS: { kind: TierKind; path: string; label: string }[] = [
  { kind: 'movie', path: '/movies', label: 'Movies' },
  { kind: 'tv', path: '/tv', label: 'TV' },
  { kind: 'book', path: '/books', label: 'Books' },
  { kind: 'ice-cream', path: '/ice-cream', label: 'Ice Cream' },
]

/** The in-page board picker: the four built-ins, then the space's own lists.
 *  A thin wrapper over the shared PickerRow — all it does is turn boards into
 *  pill entries. */
export function ListPicker({
  lists,
  activeKey,
  onNew,
  onEdit,
}: {
  /** The space's own lists, in creation order (`tier_lists` rows). */
  lists: TierList[]
  /** The board showing right now — a built-in kind or `list:<id>`. */
  activeKey: ListKey
  /** Open the new-list modal. */
  onNew: () => void
  /** Re-word the list showing now — only offered on a custom board. */
  onEdit: () => void
}) {
  const entries: PickerEntry[] = [
    ...BUILT_INS.map((entry) => ({
      key: entry.kind,
      label: `${KIND_COPY[entry.kind].emoji} ${entry.label}`,
      path: entry.path,
    })),
    ...lists.map((list) => ({
      key: listKeyFor(list.id),
      label: `${list.emoji || '🏷️'} ${list.name}`,
      path: `/tiers/${list.id}`,
    })),
  ]

  return (
    <PickerRow
      entries={entries}
      activeKey={activeKey}
      onNew={onNew}
      // Only a space-defined list can be re-worded; the built-ins are fixed.
      onEdit={activeKey.startsWith('list:') ? onEdit : undefined}
    />
  )
}
