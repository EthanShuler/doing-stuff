import { useEffect, useRef, useState } from 'react'
import { Checkbox, Stack, Text } from '@mantine/core'
import type { ListKey, TierKind } from '../../types'
import { colors, fonts, text } from '../../theme'
import { useBusy } from '../../lib/useBusy'
import { usePullSources } from '../../data/useSpace'
import { errorMessage } from '../../data/spaceSync'
import { PullModal } from '../../components/PullModal'
import { KIND_COPY } from './copy'
import { defaultPullKeys, planTierPulls, sumTierPullSummaries, tierPullChoices, tierPullSummaryLine } from './derive'
import type { TierPullChoice, TierPullData } from './derive'
import type { TierListStore } from './useTierListStore'

const choiceLabel = (choice: TierPullChoice): string =>
  choice.list
    ? `${choice.list.emoji || '🏷️'} ${choice.list.name}`
    : `${KIND_COPY[choice.key as TierKind].emoji} ${KIND_COPY[choice.key as TierKind].pageTitle}`

const counted = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`

/** The checklist inside the pull modal: one checkbox per board in the other
 *  space (Movies / TV / Books / each of its lists) with how much is there,
 *  plus the "also bring unranked" switch. Stateless — TierPullModal owns it. */
export function TierPullBody({
  choices,
  selected,
  onToggle,
  includeUnranked,
  onIncludeUnranked,
}: {
  choices: TierPullChoice[]
  selected: ListKey[]
  onToggle: (key: ListKey, on: boolean) => void
  includeUnranked: boolean
  onIncludeUnranked: (on: boolean) => void
}) {
  return (
    <Stack gap={14}>
      <Text fz={text.small} c={colors.inkSoft} style={{ fontFamily: fonts.sans }}>
        Brings your rankings there into your boards here. Anything already here keeps its spot.
      </Text>
      <Stack gap={10} role="group" aria-label="Boards to pull">
        {choices.map((choice) => (
          <Checkbox
            key={choice.key}
            label={choiceLabel(choice)}
            description={
              choice.total === 0
                ? 'Nothing there'
                : `${choice.list?.shared ? 'Shared board · ' : ''}${choice.ranked} ranked · ${counted(choice.total, 'item')}`
            }
            disabled={choice.total === 0}
            checked={selected.includes(choice.key)}
            onChange={(e) => onToggle(choice.key, e.currentTarget.checked)}
          />
        ))}
      </Stack>
      <Checkbox
        label="Also bring items I haven't ranked"
        description="They land on the Unranked shelf."
        checked={includeUnranked}
        onChange={(e) => onIncludeUnranked(e.currentTarget.checked)}
        pt={12}
        style={{ borderTop: `1px dotted ${colors.rule}` }}
      />
    </Stack>
  )
}

/**
 * "Pull from…" for the tier boards: picks the other space, reads it, and
 * previews exactly what a pull would write — the summary line is computed
 * live from the same plans the store will run (planTierPulls), against what
 * this tab holds now. Mount it only while open: each open starts fresh.
 */
export function TierPullModal({
  store,
  currentKey,
  onClose,
}: {
  store: TierListStore
  /** The board on screen — its counterpart there starts ticked. */
  currentKey: ListKey
  onClose: () => void
}) {
  const sources = usePullSources('tier-lists')
  const [sourceId, setSourceId] = useState<string | null>(sources[0]?.id ?? null)
  const [data, setData] = useState<TierPullData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ListKey[]>([])
  const [includeUnranked, setIncludeUnranked] = useState(false)
  const { busy: pulling, run } = useBusy()

  // (Re)read the source whenever it changes. Only the latest read lands, so a
  // quick switch between spaces can't show the first one's boards. The
  // pre-tick reads the lists as of that moment, deliberately not a dependency.
  const latest = useRef(0)
  const { loadPullSource, lists } = store
  useEffect(() => {
    if (!sourceId) return
    const ticket = ++latest.current
    setData(null)
    setLoadError(null)
    loadPullSource(sourceId)
      .then((fetched) => {
        if (ticket !== latest.current) return
        setData(fetched)
        setSelected(defaultPullKeys(fetched, currentKey, lists))
      })
      .catch((err) => {
        if (ticket === latest.current) setLoadError(errorMessage(err))
      })
  }, [sourceId, loadPullSource])

  const selfId = store.selfId
  const choices = data && selfId ? tierPullChoices(data, selfId) : []
  // Plan in the checklist's order, whatever order the boxes were ticked in.
  const keys = choices.map((c) => c.key).filter((key) => selected.includes(key))
  let previewIds = 0
  const plans =
    data && selfId
      ? planTierPulls(
          data,
          keys,
          { lists: store.lists, items: store.items, placements: store.placements, completions: store.completions, userTags: store.userTags },
          selfId,
          () => `preview-${++previewIds}`,
          '2000-01-01T00:00:00.000Z',
          { includeUnranked },
        )
      : []
  const line = tierPullSummaryLine(sumTierPullSummaries(plans))

  const summary = loadError
    ? `Couldn't read that space: ${loadError}`
    : !data
      ? 'Reading the other space…'
      : keys.length === 0
        ? 'Pick a board to pull.'
        : line || 'Nothing new to pull.'

  const pull = () =>
    run(async () => {
      if (!sourceId) return
      try {
        await store.pullBoards(sourceId, keys, { includeUnranked })
        onClose()
      } catch {
        // store.error says why; the modal stays open and its preview now
        // reflects whatever did land, so pulling again finishes the job.
      }
    })

  return (
    <PullModal
      opened
      onClose={onClose}
      title="Pull boards"
      sources={sources}
      sourceId={sourceId}
      onSourceChange={setSourceId}
      summary={summary}
      confirmLabel="Pull"
      confirmDisabled={!data || line === ''}
      loading={pulling}
      onConfirm={pull}
    >
      {data ? (
        <TierPullBody
          choices={choices}
          selected={selected}
          onToggle={(key, on) => setSelected((prev) => (on ? [...prev, key] : prev.filter((k) => k !== key)))}
          includeUnranked={includeUnranked}
          onIncludeUnranked={setIncludeUnranked}
        />
      ) : null}
    </PullModal>
  )
}
