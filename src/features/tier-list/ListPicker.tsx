import { Group } from '@mantine/core'
import { useNavigate } from 'react-router'
import type { TierKind } from '../../types'
import { ACCENT } from '../../theme'
import { Pill } from '../../components/Pill'
import { KIND_COPY } from './copy'

/** The four built-in boards, in nav order. Each keeps its own URL, so the
 *  pills navigate rather than set local state — back/forward keeps working and
 *  the store (one component across all four routes) never refetches. */
const BUILT_INS: { kind: TierKind; path: string; label: string }[] = [
  { kind: 'movie', path: '/movies', label: 'Movies' },
  { kind: 'tv', path: '/tv', label: 'TV' },
  { kind: 'book', path: '/books', label: 'Books' },
  { kind: 'ice-cream', path: '/ice-cream', label: 'Ice Cream' },
]

/** A space-defined list. Phase 3 fills these in (a `tier_lists` row); for now
 *  the prop is always `[]` and only the built-in pills render. */
export interface PickableList {
  id: string
  name: string
  emoji: string
}

/** The in-page board picker, standing in for the header nav items the four
 *  tier lists used to have. Presentational: the page hands it the active key
 *  and the custom lists; every pill is a plain navigation. */
export function ListPicker({
  lists = [],
  activeKey,
}: {
  lists?: PickableList[]
  /** The board showing right now — a built-in `TierKind` today. */
  activeKey: TierKind
}) {
  const navigate = useNavigate()

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
          active={false}
          activeBg={ACCENT}
          onClick={() => navigate(`/lists/${list.id}`)}
        />
      ))}
    </Group>
  )
}
