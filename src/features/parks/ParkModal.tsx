import { useEffect, useState } from 'react'
import { Anchor, Box, Button, Group, Text } from '@mantine/core'
import { colors, fonts, text } from '../../theme'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'
import { useConfirm } from '../../components/ConfirmModal'
import { formatDateWithYear, today } from '../../lib/format'
import { useBusy } from '../../lib/useBusy'
import type { ParkVisit } from '../../types'
import type { Park } from './parks'
import type { Member } from './derive'
import { sortVisits } from './derive'
import type { VisitDraft } from './useParkStore'
import { VisitFields } from './VisitFields'

const eyebrowStyle = {
  fontFamily: fonts.mono,
  fontSize: text.tiny,
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
}

/** Names of a visit's attendees, resolved against the member list (attendee
 *  ids that aren't members — someone who left — are skipped). */
function attendeeNames(visit: ParkVisit, members: Member[]): string {
  return members
    .filter((m) => visit.attendeeIds.includes(m.id))
    .map((m) => m.name || 'Member')
    .join(' + ')
}

/**
 * One park's detail modal: the static facts, the logged trips, and — behind an
 * internal mode switch, so nothing stacks — the add/edit visit form.
 */
export function ParkModal({
  park,
  visits,
  members,
  onAdd,
  onUpdate,
  onDelete,
  onClose,
}: {
  park: Park | null
  /** This park's visits (any order — sorted here). */
  visits: ParkVisit[]
  members: Member[]
  /** Store actions; they throw on failure so the form can stay open. */
  onAdd: (draft: VisitDraft) => Promise<void>
  onUpdate: (id: string, draft: VisitDraft) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}) {
  // null = viewing; { id: null } = adding; { id } = editing that visit.
  const [editing, setEditing] = useState<{ id: string | null } | null>(null)
  const [draft, setDraft] = useState<VisitDraft>({ parkCode: '', date: '', notes: '', attendeeIds: [], separate: false })

  // A fresh park (or reopen) always starts on the detail view.
  useEffect(() => {
    setEditing(null)
  }, [park?.code])

  // Hooks, so they must sit above the early return below.
  const { busy: saving, run: runSave } = useBusy()
  const confirm = useConfirm()

  if (!park) return null
  const sorted = sortVisits(visits)

  const openAdd = () => {
    setDraft({
      parkCode: park.code,
      date: today(),
      notes: '',
      attendeeIds: members.map((m) => m.id),
      separate: false,
    })
    setEditing({ id: null })
  }

  const openEdit = (visit: ParkVisit) => {
    setDraft({
      parkCode: park.code,
      date: visit.date ?? '',
      notes: visit.notes,
      // Keep attendees verbatim, including anyone no longer a member — they
      // just don't render a checkbox. Filtering them out here would silently
      // rewrite attendee_ids on an unrelated notes edit.
      attendeeIds: visit.attendeeIds,
      separate: visit.separate,
    })
    setEditing({ id: visit.id })
  }

  const save = () =>
    runSave(async () => {
      if (!editing || draft.attendeeIds.length === 0) return
      try {
        if (editing.id) await onUpdate(editing.id, draft)
        else await onAdd(draft)
        setEditing(null)
      } catch {
        // Write failed — keep the form open; store.error shows the reason.
      }
    })

  const deleteEditingVisit = async () => {
    if (!editing?.id) return
    if (!(await confirm({ title: 'Delete this visit?', message: 'The park stays — just this trip goes.' }))) return
    try {
      await onDelete(editing.id)
      setEditing(null)
    } catch {
      // Keep the form open on failure.
    }
  }

  return (
    <ModalShell
      opened
      onClose={onClose}
      size="lg"
      // The where/when eyebrow rides in the heading so it stays glued to the
      // park's name (and names the dialog alongside it).
      title={
        <>
          <Text component="span" display="block" c="clay.6" mb={6} style={eyebrowStyle}>
            {park.region} · {park.states} · est. {park.established}
          </Text>
          {park.name}
        </>
      }
    >
      <Text fz={text.body} c={colors.inkFaded} lh={1.5} mb={6} mt={-14} style={{ fontFamily: fonts.serif, fontStyle: 'italic' }}>
        {park.blurb}
      </Text>
      <Anchor href={park.npsUrl} target="_blank" rel="noreferrer" fz={text.caption} c={colors.muted} fw={600}>
        nps.gov ↗
      </Anchor>

      {editing ? (
        <Box mt={22}>
          <Text style={{ ...eyebrowStyle, color: colors.muted }} mb={14}>
            {editing.id ? 'Edit visit' : 'Log a visit'}
          </Text>
          <VisitFields draft={draft} members={members} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
          <ModalFooter
            onCancel={() => setEditing(null)}
            onConfirm={() => void save()}
            confirmLabel={editing.id ? 'Save changes' : 'Log visit'}
            confirmDisabled={draft.attendeeIds.length === 0}
            loading={saving}
            onDelete={editing.id ? () => void deleteEditingVisit() : undefined}
            deleteLabel="Delete visit"
          />
        </Box>
      ) : (
        <>
          <Box mt={22}>
            <Text style={{ ...eyebrowStyle, color: colors.muted }} mb={10}>
              Visits
            </Text>
            {sorted.length === 0 && (
              <Text fz={text.small} c={colors.muted} style={{ fontFamily: fonts.serif, fontStyle: 'italic' }}>
                Not visited yet — it's on the list.
              </Text>
            )}
            {sorted.map((visit) => (
              <Group
                key={visit.id}
                justify="space-between"
                align="flex-start"
                gap={10}
                wrap="nowrap"
                py={10}
                style={{ borderBottom: `1px dotted ${colors.dotted}` }}
              >
                <Box>
                  <Text fz={text.body} fw={600} c={colors.ink}>
                    {visit.date ? formatDateWithYear(visit.date) : 'Sometime, long ago'}
                    <Text component="span" fz={text.small} fw={500} c={colors.muted}>
                      {'  ·  '}
                      {attendeeNames(visit, members) || '—'}
                      {visit.separate && ', separately'}
                    </Text>
                  </Text>
                  {visit.notes && (
                    <Text fz={text.small} c={colors.inkFaded} mt={3} lh={1.45}>
                      {visit.notes}
                    </Text>
                  )}
                </Box>
                <Button size="compact-xs" variant="default" radius={8} onClick={() => openEdit(visit)}>
                  Edit
                </Button>
              </Group>
            ))}
          </Box>

          <Group justify="flex-end" gap={10} mt={24}>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={openAdd}>
              + Log a visit
            </Button>
          </Group>
        </>
      )}
    </ModalShell>
  )
}
