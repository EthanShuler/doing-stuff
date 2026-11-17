import { useState } from 'react'
import { Box, Button, Stack, Text, TextInput } from '@mantine/core'
import { colors, fonts, text } from '../../theme'
import { useBusy } from '../../lib/useBusy'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'
import { type AdminSpace, type AdminUser, lastSignInLabel, sameIds, setPasswordLink, userLabel } from './derive'
import type { AdminStore } from './useAdminStore'
import { LinkPanel, SpaceCheckboxes } from './parts'

/** One person: rename them, set their spaces, or get a fresh set-password
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
  store: Pick<AdminStore, 'setDisplayName' | 'setUserSpaces' | 'passwordLink'>
  onClose: () => void
}) {
  const [baseline] = useState(() => ({ name: user.displayName ?? '', spaceIds: user.spaceIds }))
  const [name, setName] = useState(baseline.name)
  const [spaceIds, setSpaceIds] = useState(baseline.spaceIds)
  const [link, setLink] = useState<{ url: string; copied: boolean } | null>(null)
  const { busy: saving, run: runSave } = useBusy()
  const { busy: linking, run: runLink } = useBusy()

  const save = () =>
    runSave(async () => {
      try {
        if (name.trim() !== baseline.name.trim()) await store.setDisplayName(user.id, name)
        if (!sameIds(spaceIds, baseline.spaceIds)) await store.setUserSpaces(user.id, spaceIds, baseline.spaceIds)
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
