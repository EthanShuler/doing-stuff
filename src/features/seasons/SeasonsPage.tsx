import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Box, Button, Group, SegmentedControl, Text } from '@mantine/core'
import type { SeasonItem } from '../../types'
import { ACCENT, colors, fonts, text } from '../../theme'
import { today as todayIso } from '../../lib/format'
import { useBusy } from '../../lib/useBusy'
import { pickKeys, useTriFilter } from '../../lib/triFilter'
import { useConfirm } from '../../components/ConfirmModal'
import { ControlBar } from '../../components/ControlBar'
import { EmptyCard } from '../../components/EmptyCard'
import { FloatingBanner } from '../../components/FloatingBanner'
import { PageFrame } from '../../components/PageFrame'
import { Pill, TriPill } from '../../components/Pill'
import { PickerRow } from '../../components/PickerRow'
import type { PickerEntry } from '../../components/PickerRow'
import { Splash } from '../../components/Splash'
import { DEFAULT_SECTION, useSeasonStore } from './useSeasonStore'
import {
  STATUS_KEYS,
  STATUS_LABELS,
  blankItemDraft,
  canNestUnder,
  currentSeason,
  draftFromItem,
  filterItems,
  groupSections,
  itemsOfSeason,
  parentChoices,
  sectionKeys,
  sortSeasons,
  statusCounts,
  subsectionsOf,
  weekendDayGroups,
  weekends,
} from './derive'
import type { SeasonItemDraft } from './derive'
import { BucketList } from './BucketList'
import type { RowActions } from './BucketList'
import { PlanView } from './PlanView'
import { ItemModal } from './ItemModal'
import { SeasonModal, draftFromSeason, emptySeasonDraft } from './SeasonModal'
import type { SeasonModalDraft } from './SeasonModal'

type Screen = 'list' | 'plan'

/**
 * The Seasons feature: a seasonal bucket list and a weekend planner. `/seasons`
 * and `/seasons/:id` both render this one component (same tree slot), so the
 * store survives switching seasons. `/seasons` on its own forwards to the
 * current season, or shows the empty state when there are none. The
 * Bucket list / Plan toggle is page state, like Spoons' Collection / Map.
 */
export function SeasonsPage({
  spaceId,
  userId,
  configured,
}: {
  spaceId: string | null
  userId: string | null
  configured: boolean
}) {
  const store = useSeasonStore(spaceId, userId)
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { id: routeId } = useParams()
  const today = todayIso()

  const [screen, setScreen] = useState<Screen>('list')
  const sectionFilter = useTriFilter()
  const statusFilter = useTriFilter()

  const season = routeId ? (store.seasons.find((s) => s.id === routeId) ?? null) : null
  const seasonItems = season ? itemsOfSeason(store.items, season.id) : []

  // --- Item modal ---
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [itemDraft, setItemDraft] = useState<SeasonItemDraft>(() => blankItemDraft())
  const [itemNotice, setItemNotice] = useState<string | null>(null)

  // --- Season modal ---
  const [seasonModalOpen, setSeasonModalOpen] = useState(false)
  const [editingSeason, setEditingSeason] = useState(false)
  const [seasonDraft, setSeasonDraft] = useState<SeasonModalDraft>(emptySeasonDraft)

  // A season switch (a picker pill, back/forward) drops an open modal — an
  // item saved after the switch would land in the wrong season.
  useEffect(() => {
    setItemModalOpen(false)
    setEditingId(null)
    setSeasonModalOpen(false)
  }, [routeId])

  const loadingData = configured && store.loading

  // --- Derived for the screens ---
  const sections = sectionKeys(seasonItems)
  const activeSections = pickKeys(sectionFilter.state, sections)
  const activeStatuses = pickKeys(statusFilter.state, STATUS_KEYS)
  const filtering = Object.keys(activeSections).length > 0 || Object.keys(activeStatuses).length > 0
  const groups = groupSections(filterItems(seasonItems, activeSections, activeStatuses))
  const counts = statusCounts(seasonItems)
  const weekendList = season ? weekends(season, today) : []
  const dayGroups = season ? weekendDayGroups(season, today) : []

  const entries: PickerEntry[] = sortSeasons(store.seasons).map((s) => ({
    key: s.id,
    label: `${s.emoji || '🍂'} ${s.name}`,
    path: `/seasons/${s.id}`,
  }))

  // --- Item actions ---

  const openAddItem = (patch: Partial<SeasonItemDraft> = {}) => {
    setEditingId(null)
    setItemNotice(null)
    setItemDraft(blankItemDraft(patch))
    setItemModalOpen(true)
  }

  const openEditItem = (item: SeasonItem) => {
    setEditingId(item.id)
    setItemNotice(null)
    setItemDraft(draftFromItem(item))
    setItemModalOpen(true)
  }

  const closeItemModal = () => {
    setItemModalOpen(false)
    setEditingId(null)
  }

  const { busy: savingItem, run: runSaveItem } = useBusy()
  const saveItem = () =>
    runSaveItem(async () => {
      if (!season || !itemDraft.title.trim()) return
      try {
        if (editingId) {
          await store.updateItem(editingId, itemDraft)
        } else {
          const created = await store.addItem(season.id, itemDraft)
          if (!created) return
        }
        closeItemModal()
      } catch {
        // Write failed — keep the modal open; store.error shows the reason.
      }
    })

  const duplicateEditing = async () => {
    if (!editingId) return
    const copy = await store.duplicateItem(editingId)
    if (!copy) return
    // Hand the modal to the copy — the usual next step is giving it its own day.
    setEditingId(copy.id)
    setItemDraft(draftFromItem(copy))
    setItemNotice('This is the new copy — the original stays as it was.')
  }

  const deleteEditing = async () => {
    const item = seasonItems.find((i) => i.id === editingId)
    if (!item) {
      closeItemModal()
      return
    }
    const children = seasonItems.filter((i) => i.parentId === item.id).length
    const ok = await confirm({
      title: 'Delete this item for both of you?',
      message:
        children > 0
          ? `"${item.title}" and its ${children === 1 ? 'sub-option' : `${children} sub-options`} come off the list.`
          : `"${item.title}" comes off the list.`,
    })
    if (!ok) return
    try {
      await store.deleteItem(item.id)
      closeItemModal()
    } catch {
      // Keep the modal open on failure.
    }
  }

  const rowActions: RowActions = {
    today,
    weekends: weekendList,
    dayGroups,
    onToggleDone: (item) => void store.toggleDone(item.id),
    onEdit: openEditItem,
    onPlan: (item, date) => void store.planItem(item.id, date),
  }

  const quickAdd = async (patch: Partial<SeasonItemDraft>): Promise<boolean> => {
    if (!season) return false
    return (await store.addItem(season.id, blankItemDraft(patch))) !== null
  }

  // The item modal's choices.
  const draftSection = itemDraft.section.trim() || DEFAULT_SECTION
  const editingHasChildren = editingId !== null && seasonItems.some((i) => i.parentId === editingId)
  const parents = season
    ? parentChoices(store.items, season.id, draftSection, itemDraft.subsection.trim(), editingId).filter((p) =>
        canNestUnder(store.items, editingId, p.id, season.id),
      )
    : []

  // --- Season actions ---

  const openNewSeason = () => {
    setEditingSeason(false)
    setSeasonDraft({ ...emptySeasonDraft(), copyFrom: season?.id ?? '' })
    setSeasonModalOpen(true)
  }

  const openEditSeason = () => {
    if (!season) return
    setEditingSeason(true)
    setSeasonDraft(draftFromSeason(season))
    setSeasonModalOpen(true)
  }

  const { busy: savingSeason, run: runSaveSeason } = useBusy()
  const saveSeason = () =>
    runSaveSeason(async () => {
      try {
        const { copyFrom, ...fields } = seasonDraft
        if (editingSeason && season) {
          await store.updateSeason(season.id, fields)
          setSeasonModalOpen(false)
        } else {
          const created = await store.addSeason({ ...fields, copyFromSeasonId: copyFrom || null })
          setSeasonModalOpen(false)
          navigate(`/seasons/${created.id}`)
        }
      } catch {
        // Write failed — keep the modal open; store.error shows the reason.
      }
    })

  const deleteSeason = async () => {
    if (!season) return
    const ok = await confirm({
      title: `Delete "${season.name}" for both of you?`,
      message: 'Everything on its list — plans and check-offs too — is removed.',
    })
    if (!ok) return
    try {
      await store.deleteSeason(season.id)
      setSeasonModalOpen(false)
      navigate('/seasons', { replace: true })
    } catch {
      // Keep the modal open on failure.
    }
  }

  // --- Routing guards (after the load, so a live hard load waits) ---

  if (!loadingData) {
    if (!routeId) {
      const current = currentSeason(store.seasons, today)
      if (current) return <Navigate to={`/seasons/${current.id}`} replace />
    } else if (!season) {
      // Never existed, or the partner just deleted it.
      return <Navigate to="/seasons" replace />
    }
  }

  const title = season ? `${season.name} · Seasons · cajubinile.com` : 'Seasons · cajubinile.com'

  return (
    <>
      <title>{title}</title>
      <FloatingBanner message={store.error} tone="error" onDismiss={store.clearError} />

      <PageFrame maw={1080}>
        <PickerRow
          entries={entries}
          activeKey={season?.id ?? ''}
          onNew={openNewSeason}
          newLabel="+ New season"
          onEdit={season ? openEditSeason : undefined}
          editLabel="Edit season"
        />

        <ControlBar
          left={
            <>
              <SegmentedControl
                value={screen}
                onChange={(value) => setScreen(value as Screen)}
                data={[
                  { label: 'Bucket list', value: 'list' },
                  { label: 'Plan', value: 'plan' },
                ]}
              />
              {!loadingData && season && (
                <Text fz={text.small} c={colors.muted} style={{ fontFamily: fonts.sans }}>
                  {counts.unplanned} to plan · {counts.planned} planned · {counts.done} done
                </Text>
              )}
            </>
          }
          right={
            season ? <Button onClick={() => openAddItem()}>+ Add item</Button> : undefined
          }
        />

        {loadingData ? (
          <Splash text="Loading your space…" mih="40vh" />
        ) : !season ? (
          <EmptyCard
            title="No seasons yet"
            blurb="A season is a bucket list with dates — “Fall 2026”, the weekends from late September to mid-November."
          >
            <Button onClick={openNewSeason}>+ New season</Button>
          </EmptyCard>
        ) : screen === 'list' ? (
          <>
            {sections.length > 0 && (
              <Box mt={16}>
                <Group gap={8} wrap="wrap" mb={8}>
                  <Pill
                    label="All sections"
                    active={Object.keys(activeSections).length === 0}
                    activeBg={ACCENT}
                    onClick={sectionFilter.clear}
                  />
                  {sections.map((section) => (
                    <TriPill
                      key={section}
                      label={section}
                      state={activeSections[section]}
                      activeBg={ACCENT}
                      onCycle={() => sectionFilter.cycle(section)}
                      onCycleBack={() => sectionFilter.cycleBack(section)}
                    />
                  ))}
                </Group>
                <Group gap={8} wrap="wrap">
                  <Pill
                    label="Any status"
                    active={Object.keys(activeStatuses).length === 0}
                    activeBg={ACCENT}
                    onClick={statusFilter.clear}
                  />
                  {STATUS_KEYS.map((status) => (
                    <TriPill
                      key={status}
                      label={`${STATUS_LABELS[status]} ${counts[status]}`}
                      state={activeStatuses[status]}
                      activeBg={ACCENT}
                      onCycle={() => statusFilter.cycle(status)}
                      onCycleBack={() => statusFilter.cycleBack(status)}
                    />
                  ))}
                </Group>
                {filtering && (
                  <Text fz={text.caption} c={colors.faint} mt={8} style={{ fontStyle: 'italic' }}>
                    Right-click a pill to exclude it.
                  </Text>
                )}
              </Box>
            )}
            <BucketList
              groups={groups}
              filtering={filtering}
              actions={rowActions}
              onQuickAdd={(section, subsection, title) => quickAdd({ section, subsection, title })}
            />
          </>
        ) : (
          <PlanView
            season={season}
            items={seasonItems}
            actions={rowActions}
            onQuickAddDay={(day, title) => quickAdd({ section: DEFAULT_SECTION, title, plannedOn: day })}
          />
        )}
      </PageFrame>

      <SeasonModal
        opened={seasonModalOpen}
        draft={seasonDraft}
        isEditing={editingSeason}
        seasons={sortSeasons(store.seasons)}
        onChange={(patch) => setSeasonDraft((prev) => ({ ...prev, ...patch }))}
        saving={savingSeason}
        onSave={() => void saveSeason()}
        onDelete={() => void deleteSeason()}
        onClose={() => setSeasonModalOpen(false)}
      />

      <ItemModal
        opened={itemModalOpen}
        draft={itemDraft}
        isEditing={editingId !== null}
        sections={sections}
        subsections={subsectionsOf(seasonItems, draftSection)}
        parents={parents}
        parentHint={editingHasChildren ? 'This one has sub-options of its own, so it stays top-level.' : null}
        notice={itemNotice}
        onChange={(patch) => setItemDraft((prev) => ({ ...prev, ...patch }))}
        saving={savingItem}
        onSave={() => void saveItem()}
        onDuplicate={() => void duplicateEditing()}
        onDelete={() => void deleteEditing()}
        onClose={closeItemModal}
      />
    </>
  )
}
