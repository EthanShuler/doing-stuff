import { useEffect, useState } from 'react'
import { Button, Group, Select, Title } from '@mantine/core'
import { ModalShell } from '../../components/ModalShell'
import { today } from '../../lib/format'
import { useBusy } from '../../lib/useBusy'
import { PARKS } from './parks'
import type { Member } from './derive'
import type { VisitDraft } from './useParkStore'
import { VisitFields } from './VisitFields'

// The park picker's options, alphabetical — the header button is for when you
// know the park's name, not where it is.
const PARK_OPTIONS = [...PARKS]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((p) => ({ value: p.code, label: `${p.name} · ${p.states}` }))

/** The header bar's "Log visit" flow: pick any of the 63, then the same trip
 *  fields as the park detail modal. */
export function LogVisitModal({
  opened,
  members,
  onSave,
  onClose,
}: {
  opened: boolean
  members: Member[]
  /** Store add action; throws on failure so the modal can stay open. */
  onSave: (draft: VisitDraft) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState<VisitDraft>({ parkCode: '', date: '', notes: '', attendeeIds: [], separate: false })

  // Fresh draft each time it opens: today's date, everyone along.
  useEffect(() => {
    if (opened) {
      setDraft({ parkCode: '', date: today(), notes: '', attendeeIds: members.map((m) => m.id), separate: false })
    }
  }, [opened])

  const canSave = Boolean(draft.parkCode) && draft.attendeeIds.length > 0

  const { busy: saving, run: runSave } = useBusy()
  const save = () =>
    runSave(async () => {
      if (!canSave) return
      try {
        await onSave(draft)
        onClose()
      } catch {
        // Write failed — keep the modal open; store.error shows the reason.
      }
    })

  return (
    <ModalShell opened={opened} onClose={onClose} width={520}>
      <Title order={3} fz={28} mb={22}>
        Log a visit
      </Title>

      <Select
        label="Park"
        data={PARK_OPTIONS}
        value={draft.parkCode || null}
        onChange={(value) => setDraft((prev) => ({ ...prev, parkCode: value ?? '' }))}
        placeholder="Pick one of the 63"
        searchable
        data-autofocus
        mb={18}
      />

      <VisitFields draft={draft} members={members} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />

      <Group justify="flex-end" gap={10} mt={22}>
        <Button variant="secondary" onClick={onClose} radius={10}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={!canSave} loading={saving} radius={10}>
          Log visit
        </Button>
      </Group>
    </ModalShell>
  )
}
