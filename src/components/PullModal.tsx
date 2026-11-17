import type { ReactNode } from 'react'
import { Box, Button, Select, Text } from '@mantine/core'
import { usePullSources, type SpaceInfo } from '../data/useSpace'
import { colors, fonts, text } from '../theme'
import { ModalFooter } from './ModalFooter'
import { ModalShell } from './ModalShell'

/**
 * The shared chrome for "pull from another space": which space to read from,
 * the feature's own body (its checklist / picker), an optional summary line,
 * and the Cancel + confirm row. The feature owns everything that varies — the
 * source fetch, the selection state, what the summary says — so this stays a
 * frame, like ModalShell.
 *
 * The source picker is a Select only when there's a real choice; with exactly
 * one other space it reads "From <name>" as plain text. The page passes
 * `sources` from `usePullSources(featureKey)` and keeps `sourceId` in state
 * (default `sources[0].id`), refetching the source when it changes.
 *
 * Sized for a phone: everything stacks in one column, so nothing here can
 * scroll sideways at 390px. A long body scrolls with the modal (Mantine caps
 * it to the viewport), so a big checklist needs no height cap of its own.
 */
export function PullModal({
  opened,
  onClose,
  title,
  sources,
  sourceId,
  onSourceChange,
  children,
  summary,
  confirmLabel,
  confirmDisabled,
  loading,
  onConfirm,
}: {
  opened: boolean
  onClose: () => void
  /** "Pull boards", "Pull recipes". */
  title: ReactNode
  /** The spaces to offer (usePullSources) — never the current one. */
  sources: SpaceInfo[]
  /** The space being read from; null until one is chosen. */
  sourceId: string | null
  onSourceChange: (spaceId: string) => void
  /** The feature's body: what to pull from the chosen source. */
  children: ReactNode
  /** One line above the buttons ("12 rankings · 3 new items · 2 already here"). */
  summary?: ReactNode
  confirmLabel: string
  confirmDisabled?: boolean
  /** The pull is running: the confirm button spins. */
  loading?: boolean
  onConfirm: () => void
}) {
  const only = sources.length === 1 ? sources[0] : null

  return (
    <ModalShell opened={opened} onClose={onClose} title={title} size="md">
      {only ? (
        <Text fz={text.small} c={colors.inkSoft} mb={18} style={{ fontFamily: fonts.sans }}>
          From <strong>{only.name}</strong>
        </Text>
      ) : (
        <Select
          label="From"
          data={sources.map((s) => ({ value: s.id, label: s.name }))}
          value={sourceId}
          onChange={(value) => {
            if (value) onSourceChange(value)
          }}
          placeholder="Pick a space"
          allowDeselect={false}
          mb={18}
        />
      )}

      <Box>{children}</Box>

      {summary && (
        <Text fz={text.small} c={colors.muted} mt={18} style={{ fontFamily: fonts.sans, fontStyle: 'italic' }}>
          {summary}
        </Text>
      )}

      <ModalFooter
        onCancel={onClose}
        onConfirm={onConfirm}
        confirmLabel={confirmLabel}
        confirmDisabled={confirmDisabled || sourceId === null}
        loading={loading}
      />
    </ModalShell>
  )
}

/**
 * The faint "Pull from…" control-bar action that opens a feature's
 * PullModal. Renders nothing when the user has no other space to pull from
 * (with a `featureKey`, no other space showing that feature) — so a page can
 * drop it into its ControlBar's `right` unconditionally, beside its primary
 * action.
 */
export function PullButton({
  featureKey,
  onClick,
  label = 'Pull from…',
}: {
  /** Only offer spaces that show this feature (a key from layout/features.ts). */
  featureKey?: string
  onClick: () => void
  label?: string
}) {
  const sources = usePullSources(featureKey)
  if (sources.length === 0) return null
  return (
    <Button
      variant="subtle"
      size="compact-sm"
      onClick={onClick}
      c={colors.faint}
      style={{ fontFamily: fonts.sans, fontSize: text.caption }}
    >
      {label}
    </Button>
  )
}
