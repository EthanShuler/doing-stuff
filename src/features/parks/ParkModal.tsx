import { useEffect, useState } from 'react'
import { Anchor, Box, Button, Group, Text, Title, UnstyledButton } from '@mantine/core'
import { colors, DANGER, fonts } from '../../theme'
import { ModalShell } from '../../components/ModalShell'
import { formatDateWithYear, today } from '../../lib/format'
import type { ParkVisit } from '../../types'
import type { Park } from './parks'
import type { Member } from './derive'
import { sortVisits } from './derive'
import type { VisitDraft } from './useParkStore'
import { VisitFields } from './VisitFields'

const eyebrowStyle = {
  fontFamily: fonts.mono,
  fontSize: 11,
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
      attendeeIds: visit.attendeeIds.filter((id) => members.some((m) => m.id === id)),
      separate: visit.separate,
    })
    setEditing({ id: visit.id })
  }

  const save = async () => {
    if (!editing || draft.attendeeIds.length === 0) return
    try {
      if (editing.id) await onUpdate(editing.id, draft)
      else await onAdd(draft)
      setEditing(null)
    } catch {
      // Write failed — keep the form open; store.error shows the reason.
    }
  }

  const deleteEditingVisit = async () => {
    if (!editing?.id) return
    if (!window.confirm('Delete this visit? The park stays — just this trip goes.')) return
    try {
      await onDelete(editing.id)
      setEditing(null)
    } catch {
      // Keep the form open on failure.
    }
  }

  return (
    <ModalShell opened onClose={onClose} width={560}>
      <Text c="clay.6" mb={6} style={eyebrowStyle}>
        {park.region} · {park.states} · est. {park.established}
      </Text>
      <Title order={3} fz={28} mb={8}>
        {park.name}
      </Title>
      <Text fz={14} c={colors.inkFaded} lh={1.5} mb={6} style={{ fontFamily: fonts.serif, fontStyle: 'italic' }}>
        {park.blurb}
      </Text>
      <Anchor href={park.npsUrl} target="_blank" rel="noreferrer" fz={12} c={colors.muted} fw={600}>
        nps.gov ↗
      </Anchor>

      {editing ? (
        <Box mt={22}>
          <Text style={{ ...eyebrowStyle, color: colors.muted }} mb={14}>
            {editing.id ? 'Edit visit' : 'Log a visit'}
          </Text>
          <VisitFields draft={draft} members={members} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
          <Group justify="space-between" align="center" gap={10} mt={22}>
            {editing.id && (
              <UnstyledButton
                onClick={() => void deleteEditingVisit()}
                style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: DANGER, padding: '8px 0' }}
              >
                Delete visit
              </UnstyledButton>
            )}
            <Group gap={10} ml="auto">
              <Button variant="secondary" onClick={() => setEditing(null)} radius={10}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={draft.attendeeIds.length === 0} radius={10}>
                {editing.id ? 'Save changes' : 'Log visit'}
              </Button>
            </Group>
          </Group>
        </Box>
      ) : (
        <>
          <Box mt={22}>
            <Text style={{ ...eyebrowStyle, color: colors.muted }} mb={10}>
              Visits
            </Text>
            {sorted.length === 0 && (
              <Text fz={13} c={colors.muted} style={{ fontFamily: fonts.serif, fontStyle: 'italic' }}>
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
                  <Text fz={14} fw={600} c={colors.ink}>
                    {visit.date ? formatDateWithYear(visit.date) : 'Sometime, long ago'}
                    <Text component="span" fz={13} fw={500} c={colors.muted}>
                      {'  ·  '}
                      {attendeeNames(visit, members) || '—'}
                      {visit.separate && ', separately'}
                    </Text>
                  </Text>
                  {visit.notes && (
                    <Text fz={13} c={colors.inkFaded} mt={3} lh={1.45}>
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
            <Button variant="secondary" onClick={onClose} radius={10}>
              Close
            </Button>
            <Button onClick={openAdd} radius={10}>
              + Log a visit
            </Button>
          </Group>
        </>
      )}
    </ModalShell>
  )
}
