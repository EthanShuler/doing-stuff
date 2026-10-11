import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Button, Text } from '@mantine/core'
import { colors, fonts, text } from '../../theme'
import { useBusy } from '../../lib/useBusy'
import { useConfirm } from '../../components/ConfirmModal'
import { ControlBar } from '../../components/ControlBar'
import { EmptyCard } from '../../components/EmptyCard'
import { FloatingBanner } from '../../components/FloatingBanner'
import { PageFrame } from '../../components/PageFrame'
import { PickerRow } from '../../components/PickerRow'
import type { PickerEntry } from '../../components/PickerRow'
import { Splash } from '../../components/Splash'
import { useAlignmentStore } from './useAlignmentStore'
import { defaultChart, filledCount, sortCharts } from './derive'
import { AlignmentGrid } from './AlignmentGrid'
import { ChartModal } from './ChartModal'

/**
 * The alignment charts: any number of D&D-style 3×3 charts, each with a title
 * and the space's own text in the nine fixed squares. `/alignment` and
 * `/alignment/:id` render this one component (same tree slot), so the store
 * survives switching charts; `/alignment` on its own forwards to the first
 * chart, or shows the empty state.
 */
export function AlignmentPage({
  spaceId,
  userId,
  configured,
}: {
  spaceId: string | null
  userId: string | null
  configured: boolean
}) {
  const store = useAlignmentStore(spaceId, userId)
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { id: routeId } = useParams()

  const chart = routeId ? (store.charts.find((c) => c.id === routeId) ?? null) : null
  const loadingData = configured && store.loading

  // --- Chart modal ---
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  // A chart switch (a picker pill, back/forward) drops an open modal — a
  // rename saved after the switch would land on the wrong chart.
  useEffect(() => {
    setModalOpen(false)
  }, [routeId])

  const entries: PickerEntry[] = sortCharts(store.charts).map((c) => ({
    key: c.id,
    label: c.title,
    path: `/alignment/${c.id}`,
  }))

  const openNew = () => {
    setEditing(false)
    setTitleDraft('')
    setModalOpen(true)
  }

  const openEdit = () => {
    if (!chart) return
    setEditing(true)
    setTitleDraft(chart.title)
    setModalOpen(true)
  }

  const { busy: saving, run: runSave } = useBusy()
  const save = () =>
    runSave(async () => {
      try {
        if (editing && chart) {
          await store.renameChart(chart.id, titleDraft)
          setModalOpen(false)
        } else {
          const created = await store.addChart(titleDraft)
          setModalOpen(false)
          navigate(`/alignment/${created.id}`)
        }
      } catch {
        // Write failed — keep the modal open; store.error shows the reason.
      }
    })

  const deleteChart = async () => {
    if (!chart) return
    const ok = await confirm({
      title: `Delete "${chart.title}" for both of you?`,
      message: 'The chart and everything in its nine squares is removed.',
    })
    if (!ok) return
    try {
      await store.deleteChart(chart.id)
      setModalOpen(false)
      navigate('/alignment', { replace: true })
    } catch {
      // Keep the modal open on failure.
    }
  }

  // --- Routing guards (after the load, so a live hard load waits) ---

  if (!loadingData) {
    if (!routeId) {
      const first = defaultChart(store.charts)
      if (first) return <Navigate to={`/alignment/${first.id}`} replace />
    } else if (!chart) {
      // Never existed, or the partner just deleted it.
      return <Navigate to="/alignment" replace />
    }
  }

  const title = chart ? `${chart.title} · Alignment · cajubinile.com` : 'Alignment · cajubinile.com'

  return (
    <>
      <title>{title}</title>
      <FloatingBanner message={store.error} tone="error" onDismiss={store.clearError} />

      <PageFrame maw={960}>
        <PickerRow
          entries={entries}
          activeKey={chart?.id ?? ''}
          onNew={openNew}
          newLabel="+ New chart"
          onEdit={chart ? openEdit : undefined}
          editLabel="Edit chart"
        />

        <ControlBar
          left={
            !loadingData && chart ? (
              <Text fz={text.small} c={colors.muted} style={{ fontFamily: fonts.sans }}>
                {filledCount(chart)} of 9 squares filled
              </Text>
            ) : undefined
          }
        />

        {loadingData ? (
          <Splash text="Loading your space…" mih="40vh" />
        ) : !chart ? (
          <EmptyCard
            title="No alignment charts yet"
            blurb="Pick a topic — sandwiches, our friends, ways to load a dishwasher — and sort it from Lawful Good to Chaotic Evil."
          >
            <Button onClick={openNew}>+ New chart</Button>
          </EmptyCard>
        ) : (
          <>
            <Text
              component="h2"
              ta="center"
              fz={{ base: 24, sm: 30 }}
              fw={500}
              mt={22}
              mb={0}
              c={colors.ink}
              style={{ fontFamily: fonts.serif, overflowWrap: 'anywhere' }}
            >
              {chart.title}
            </Text>
            <AlignmentGrid chart={chart} onSetCell={(key, value) => void store.setCell(chart.id, key, value)} />
          </>
        )}
      </PageFrame>

      <ChartModal
        opened={modalOpen}
        title={titleDraft}
        isEditing={editing}
        onChange={setTitleDraft}
        saving={saving}
        onSave={() => void save()}
        onDelete={() => void deleteChart()}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
