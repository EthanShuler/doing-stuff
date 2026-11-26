import { useState } from 'react'
import { Box, Button, Stack, Text, TextInput } from '@mantine/core'
import { colors, fonts, text } from '../../theme'
import { useBusy } from '../../lib/useBusy'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'
import { type AdminSpace, type AdminUser, lastSignInLabel, sameIds, setPasswordLink, spaceNameChanges, userLabel } from './derive'
import type { AdminStore } from './useAdminStore'
import { LinkPanel, SpaceCheckboxes } from './parts'

/** One person: rename them (overall, or just inside one space), set their
 *  spaces, or get a fresh set-password
 *  link (for a new account that lost theirs, or a forgotten password).
 *  Mounted fresh for every open (the page keys it), so the form starts from
 *  the person as they were when it opened — that snapshot is also the
 *  baseline the store merges the space changes against. */
export function PersonModal({
  opened,
  user,
  spaces,
  store,
  onClose,
}: {
  opened: boolean
  user: AdminUser
  spaces: AdminSpace[]
  store: Pick<AdminStore, 'setDisplayName' | 'setUserSpaces' | 'setSpaceNames' | 'passwordLink'>
  onClose: () => void
}) {
  const [baseline] = useState(() => ({
    name: user.displayName ?? '',
    spaceIds: user.spaceIds,
    spaceNames: user.spaceNames,
  }))
  const [name, setName] = useState(baseline.name)
  const [spaceIds, setSpaceIds] = useState(baseline.spaceIds)
  const [spaceNames, setSpaceNames] = useState(baseline.spaceNames)
  const [link, setLink] = useState<{ url: string; copied: boolean } | null>(null)
  const { busy: saving, run: runSave } = useBusy()
  const { busy: linking, run: runLink } = useBusy()

  const save = () =>
    runSave(async () => {
      try {
        if (name.trim() !== baseline.name.trim()) await store.setDisplayName(user.id, name)
        if (!sameIds(spaceIds, baseline.spaceIds)) await store.setUserSpaces(user.id, spaceIds, baseline.spaceIds)
        // After the memberships: a name sits on the membership row.
        const renamed = spaceNameChanges(baseline.spaceNames, spaceNames, spaceIds)
        if (renamed.length) await store.setSpaceNames(user.id, renamed)
        onClose()
      } catch {
        // Keep the modal open; store.error says why.
      }
    })

  const getLink = () =>
    runLink(async () => {
      try {
        const url = setPasswordLink(window.location.origin, await store.passwordLink(user.id))
        // Best effort: the await above may have used up the click's
        // permission to write the clipboard (Safari), so the panel's own Copy
        // button is the fallback.
        let copied = false
        try {
          await navigator.clipboard.writeText(url)
          copied = true
        } catch {
          // fall back to the Copy button
        }
        setLink({ url, copied })
      } catch {
        // store.error says why.
      }
    })

  const requestClose = () => {
    if (!saving && !linking) onClose()
  }

  const label = userLabel(user)
  const usualName = name.trim() || user.email.split('@')[0]
  const memberSpaces = spaces.filter((s) => spaceIds.includes(s.id))

  return (
    <ModalShell
      opened={opened}
      onClose={requestClose}
      title={
        <Box>
          <div>{label}</div>
          <Text fz={text.small} c={colors.muted} style={{ fontFamily: fonts.sans }}>
            {user.email}
          </Text>
        </Box>
      }
    >
      <Stack gap={14}>
        <Text fz={text.caption} c={colors.faint} style={{ fontFamily: fonts.mono }}>
          Last sign-in: {lastSignInLabel(user.lastSignInAt)}
          {user.hasPassword ? '' : ' · No password yet'}
          {user.isAdmin ? ' · Admin' : ''}
        </Text>
        <TextInput
          label="Display name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder={user.email.split('@')[0]}
          autoComplete="off"
        />
        <SpaceCheckboxes spaces={spaces} value={spaceIds} onChange={setSpaceIds} />
        {memberSpaces.length > 0 && (
          <Stack gap={8}>
            {memberSpaces.map((space) => (
              <TextInput
                key={space.id}
                label={`Name in ${space.name}`}
                value={spaceNames[space.id] ?? ''}
                onChange={(e) => {
                  const value = e.currentTarget.value
                  setSpaceNames((prev) => ({ ...prev, [space.id]: value }))
                }}
                placeholder={usualName}
                autoComplete="off"
              />
            ))}
            <Text fz={text.caption} c={colors.faint}>
              Blank uses the display name.
            </Text>
          </Stack>
        )}
        <Box>
          {link ? (
            <LinkPanel link={link.url} name={label} copiedAlready={link.copied} />
          ) : (
            <Button variant="secondary" onClick={() => void getLink()} loading={linking}>
              Copy set-password link
            </Button>
          )}
          <Text fz={text.caption} c={colors.faint} mt={6}>
            {user.hasPassword
              ? 'For a forgotten password. Their current password keeps working until they use it.'
              : 'They haven’t set a password yet — this is how they get in.'}
          </Text>
        </Box>
      </Stack>
      <ModalFooter onCancel={requestClose} onConfirm={() => void save()} confirmLabel="Save" loading={saving} />
    </ModalShell>
  )
}
