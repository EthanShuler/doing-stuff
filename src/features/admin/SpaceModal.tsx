import { useState } from 'react'
import { Box, Checkbox, MultiSelect, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { colors, fieldLabelStyle, text } from '../../theme'
import { FEATURES } from '../../layout/features'
import { useBusy } from '../../lib/useBusy'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'
import {
  ALL_FEATURE_KEYS,
  type AdminSpace,
  type AdminUser,
  featureDraft,
  featuresToSave,
  spaceNameError,
  toggleId,
  userLabel,
} from './derive'
import type { AdminStore } from './useAdminStore'

/** New / edit space: its name, who's in it, and which features it shows.
 *  "All features, including future ones" stores null (the home space); with
 *  it unticked the per-feature boxes are an allow-list. Mounted fresh for
 *  every open (the page keys it); the members it opened with are the
 *  baseline the store merges against. */
export function SpaceModal({
  opened,
  space,
  users,
  store,
  onClose,
}: {
  opened: boolean
  /** null = a new space. */
  space: AdminSpace | null
  users: AdminUser[]
  store: Pick<AdminStore, 'saveSpace'>
  onClose: () => void
}) {
  const [baselineMembers] = useState(() => space?.memberIds ?? [])
  const [name, setName] = useState(space?.name ?? '')
  const [memberIds, setMemberIds] = useState(baselineMembers)
  // A new space starts on "All features" — the common case is a full copy
  // of the app; trimming it down is one untick away.
  const [features, setFeatures] = useState(() => featureDraft(space ? space.enabledFeatures : null))
  const [nameTouched, setNameTouched] = useState(false)
  const { busy, run } = useBusy()

  const nameError = spaceNameError(name)

  const save = () =>
    run(async () => {
      if (nameError) return
      try {
        await store.saveSpace({
          spaceId: space?.id ?? null,
          name,
          features: featuresToSave(features.all, features.keys),
          memberIds,
          baselineMemberIds: baselineMembers,
        })
        onClose()
      } catch {
        // Keep the modal open; store.error says why.
      }
    })

  const requestClose = () => {
    if (!busy) onClose()
  }

  const memberOptions = users.map((u) => ({ value: u.id, label: userLabel(u) }))

  return (
    <ModalShell opened={opened} onClose={requestClose} title={space ? 'Edit space' : 'New space'} size="md">
      <Stack gap={16}>
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onBlur={() => setNameTouched(true)}
          error={nameTouched ? nameError : null}
          placeholder="Book club"
          data-autofocus
          autoComplete="off"
        />
        <MultiSelect
          label="Members"
          data={memberOptions}
          value={memberIds}
          onChange={setMemberIds}
          placeholder={memberIds.length ? undefined : 'Nobody yet'}
          searchable
          clearable
          nothingFoundMessage="No one by that name"
          comboboxProps={{ withinPortal: true }}
        />
        <Box>
          <Text component="span" style={fieldLabelStyle}>
            Features
          </Text>
          <Checkbox
            label="All features, including future ones"
            checked={features.all}
            // Unticking starts from everything ticked, so trimming to a few
            // is a handful of unticks.
            onChange={(e) => setFeatures({ all: e.currentTarget.checked, keys: [...ALL_FEATURE_KEYS] })}
            mb={12}
          />
          <SimpleGrid cols={2} spacing={10} verticalSpacing={8} pl={4}>
            {FEATURES.map((feature) => (
              <Checkbox
                key={feature.key}
                label={feature.label}
                checked={features.all || features.keys.includes(feature.key)}
                disabled={features.all}
                onChange={(e) => {
                  // Read now — the event's currentTarget is gone by the time
                  // an updater function runs.
                  const on = e.currentTarget.checked
                  setFeatures((prev) => ({ all: false, keys: toggleId(prev.keys, feature.key, on) }))
                }}
              />
            ))}
          </SimpleGrid>
          {!features.all && features.keys.length === 0 && (
            <Text fz={text.caption} c={colors.inkFaded} mt={10}>
              No features ticked — this space’s home page will be empty.
            </Text>
          )}
          <Text fz={text.caption} c={colors.faint} mt={10}>
            Features only change what this space shows; nothing is deleted when one is turned off.
          </Text>
        </Box>
      </Stack>
      <ModalFooter
        onCancel={requestClose}
        onConfirm={() => void save()}
        confirmLabel={space ? 'Save' : 'Create space'}
        confirmDisabled={Boolean(nameError)}
        loading={busy}
      />
    </ModalShell>
  )
}
