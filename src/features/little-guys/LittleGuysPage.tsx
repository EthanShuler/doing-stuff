import { useMemo, useState } from 'react'
import { Box, Button, Group, Text, TextInput, UnstyledButton } from '@mantine/core'
import type { LittleGuy } from '../../types'
import { ACCENT, colors, fonts } from '../../theme'
import { supabase } from '../../lib/supabase'
import { useBusy } from '../../lib/useBusy'
import { SEED_SELF_ID } from '../../data/spaceSync'
import { EmptyCard } from '../../components/EmptyCard'
import { FloatingBanner } from '../../components/FloatingBanner'
import { Pill } from '../../components/Pill'
import { Splash } from '../../components/Splash'
import { useLittleGuyStore } from './useLittleGuyStore'
import type { LittleGuyDraft } from './useLittleGuyStore'
import type { OwnerFilter } from './derive'
import { buildMembers, countLine, filterLittleGuys, OWNER_ALL, ownerOptions, sortLittleGuys } from './derive'
import { LittleGuyGrid } from './LittleGuyGrid'
import { LittleGuyModal } from './LittleGuyModal'

/** The little guy collection: a photo grid of everyone on the shelf, filtered
 *  by whose they are, with add/edit behind a modal. One route (/little-guys) —
 *  the guys themselves are shared data, so either member can log or fix one up
 *  regardless of who owns him. */
export function LittleGuysPage({
  spaceId,
  userId,
  configured,
}: {
  spaceId: string | null
  userId: string | null
  configured: boolean
}) {
  const store = useLittleGuyStore(spaceId)
  const [search, setSearch] = useState('')
  const [owner, setOwner] = useState<OwnerFilter>(OWNER_ALL)

  const members = useMemo(
    () => buildMembers(store.memberIds, store.profiles),
    [store.memberIds, store.profiles],
  )
  const shown = useMemo(
    () => sortLittleGuys(filterLittleGuys(store.guys, search, owner)),
    [store.guys, search, owner],
  )
  const ownerPills = useMemo(() => ownerOptions(store.guys, members), [store.guys, members])

  // New guys default to the signed-in member's shelf — the common case is
  // logging your own.
  const selfId = supabase ? userId : SEED_SELF_ID
  const emptyDraft = (): LittleGuyDraft => ({
    name: '',
    imageUrl: '',
    source: '',
    ownerId: selfId,
    personality: '',
    description: '',
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<LittleGuyDraft>(emptyDraft)

  const openAdd = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setModalOpen(true)
  }

  const openEdit = (guy: LittleGuy) => {
    setEditingId(guy.id)
    setDraft({
      name: guy.name,
      imageUrl: guy.imageUrl,
      source: guy.source,
      ownerId: guy.ownerId,
      personality: guy.personality,
      description: guy.description,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
  }

  const { busy: saving, run: runSave } = useBusy()
  const saveLittleGuy = () =>
    runSave(async () => {
      if (!draft.name.trim()) return
      try {
        if (editingId) await store.updateLittleGuy(editingId, draft)
        else await store.addLittleGuy(draft)
        closeModal()
      } catch {
        // Write failed — keep the modal open; store.error shows the reason.
      }
    })

  const deleteEditingLittleGuy = async () => {
    if (!editingId) {
      closeModal()
      return
    }
    if (!window.confirm('Delete this little guy? His photo is removed too.')) return
    try {
      await store.deleteLittleGuy(editingId)
      closeModal()
    } catch {
      // Keep the modal open on failure.
    }
  }

  if (configured && store.loading) {
    return <Splash text="Loading your space…" mih="60vh" />
  }

  const searching = search.trim().length > 0
  const filtering = searching || owner !== OWNER_ALL

  return (
    <>
      <title>Little Guys · cajubinile.com</title>
      <FloatingBanner message={store.error} tone="error" onDismiss={store.clearError} />

      <Box pt={30} pb={80} px={24} c={colors.ink} style={{ fontFamily: fonts.sans }}>
        <Box maw={1100} mx="auto">
          <Group
            justify="space-between"
            align="center"
            gap={12}
            wrap="wrap"
            pb={18}
            style={{ borderBottom: `1px dotted ${colors.rule}` }}
          >
            <Group gap={12} align="center" wrap="wrap">
              <TextInput
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Search little guys…"
                aria-label="Search little guys by name"
                rightSection={
                  search ? (
                    <UnstyledButton
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      style={{ color: colors.faint, fontSize: 14, lineHeight: 1 }}
                    >
                      ✕
                    </UnstyledButton>
                  ) : null
                }
                w={220}
              />
              <Text fz={12.5} c={colors.faint} style={{ fontFamily: fonts.mono }}>
                {countLine(store.guys)}
              </Text>
            </Group>
            <Button onClick={openAdd} radius={10}>
              + Add little guy
            </Button>
          </Group>

          {/* Whose guys to show. Only rendered once there's more than the "All"
              pill to choose between (a solo space with no owners set). */}
          {ownerPills.length > 1 && (
            <Group gap={8} mt={16} wrap="wrap">
              {ownerPills.map((option) => (
                <Pill
                  key={option.value}
                  label={`${option.label} ${option.count}`}
                  active={owner === option.value}
                  activeBg={ACCENT}
                  onClick={() => setOwner(option.value)}
                />
              ))}
            </Group>
          )}

          {shown.length === 0 ? (
            filtering ? (
              <EmptyCard title="Nobody here" blurb="No little guy fits that search and that shelf." />
            ) : (
              <EmptyCard
                title="No little guys yet"
                blurb="Add the first one — a name is all it takes; his photo and personality can come later."
              />
            )
          ) : (
            <LittleGuyGrid guys={shown} members={members} onEdit={openEdit} />
          )}
        </Box>
      </Box>

      <LittleGuyModal
        opened={modalOpen}
        draft={draft}
        isEditing={editingId !== null}
        members={members}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        onUpload={store.uploadPhoto}
        saving={saving}
        onSave={() => void saveLittleGuy()}
        onDelete={() => void deleteEditingLittleGuy()}
        onClose={closeModal}
      />
    </>
  )
}
