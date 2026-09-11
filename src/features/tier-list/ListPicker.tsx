import { Button, Group } from '@mantine/core'
import { useNavigate } from 'react-router'
import type { ListKey, TierKind, TierList } from '../../types'
import { ACCENT, colors, fonts, text } from '../../theme'
import { Pill } from '../../components/Pill'
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

/** The in-page board picker, standing in for the header nav items the four
 *  tier lists used to have. Presentational: the page hands it the active key
 *  and the space's own lists; every pill is a plain navigation. */
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
  const navigate = useNavigate()
  const onCustom = activeKey.startsWith('list:')

  return (
    <Group gap={8} wrap="wrap" mb={14}>
      {BUILT_INS.map((entry) => (
        <Pill
          key={entry.path}
          label={`${KIND_COPY[entry.kind].emoji} ${entry.label}`}
          active={activeKey === entry.kind}
          activeBg={ACCENT}
          onClick={() => navigate(entry.path)}
        />
      ))}
      {lists.map((list) => (
        <Pill
          key={list.id}
          label={`${list.emoji || '🏷️'} ${list.name}`}
          active={activeKey === listKeyFor(list.id)}
          activeBg={ACCENT}
          onClick={() => navigate(`/lists/${list.id}`)}
        />
      ))}
      <Button variant="chip" onClick={onNew}>
        + New list
      </Button>
      {onCustom && (
        <Button
          variant="subtle"
          size="compact-sm"
          onClick={onEdit}
          c={colors.faint}
          style={{ fontFamily: fonts.sans, fontSize: text.caption }}
        >
          Edit list
        </Button>
      )}
    </Group>
  )
}
