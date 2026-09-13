import { Button, Group } from '@mantine/core'
import { useNavigate } from 'react-router'
import { ACCENT, colors, fonts, text } from '../theme'
import { Pill } from './Pill'

/** One pill in the row: a board/list and the URL it lives at. */
export interface PickerEntry {
  /** Matched against `activeKey` to decide which pill is filled. */
  key: string
  label: string
  path: string
}

/**
 * The in-page picker pill row, standing in for the header nav items a feature's
 * screens would otherwise each need. Presentational: the page hands it the
 * entries and the active key.
 *
 * Every pill is a plain navigation rather than local state, because each
 * board/list keeps its own URL — back/forward keeps working and the store (one
 * component across all of the feature's routes) never refetches.
 */
export function PickerRow({
  entries,
  activeKey,
  onNew,
  newLabel = '+ New list',
  onEdit,
  editLabel = 'Edit list',
}: {
  entries: PickerEntry[]
  /** The entry showing right now. */
  activeKey: string
  /** Open the new-list modal. */
  onNew: () => void
  newLabel?: string
  /** Re-word the thing showing now — omit it and no edit button renders. */
  onEdit?: () => void
  editLabel?: string
}) {
  const navigate = useNavigate()

  return (
    <Group gap={8} wrap="wrap" mb={14}>
      {entries.map((entry) => (
        <Pill
          key={entry.key}
          label={entry.label}
          active={activeKey === entry.key}
          activeBg={ACCENT}
          onClick={() => navigate(entry.path)}
        />
      ))}
      <Button variant="chip" onClick={onNew}>
        {newLabel}
      </Button>
      {onEdit && (
        <Button
          variant="subtle"
          size="compact-sm"
          onClick={onEdit}
          c={colors.faint}
          style={{ fontFamily: fonts.sans, fontSize: text.caption }}
        >
          {editLabel}
        </Button>
      )}
    </Group>
  )
}
