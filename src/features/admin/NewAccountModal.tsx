import { useState } from 'react'
import { Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { colors, text } from '../../theme'
import { useBusy } from '../../lib/useBusy'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'
import { type AdminSpace, isValidEmail, setPasswordLink } from './derive'
import type { AdminStore } from './useAdminStore'
import { LinkPanel, SpaceCheckboxes } from './parts'

/** "+ New account": email, display name, spaces → creates the login (no
 *  password, no email sent), puts it in those spaces, then switches to a
 *  "Link ready" view with the one-time set-password link to hand over.
 *  Mounted fresh for every open (the page keys it), so it starts blank. */
export function NewAccountModal({
  opened,
  spaces,
  store,
  onClose,
}: {
  opened: boolean
  spaces: AdminSpace[]
  store: Pick<AdminStore, 'createAccount'>
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [spaceIds, setSpaceIds] = useState<string[]>([])
  const [emailTouched, setEmailTouched] = useState(false)
  // Set once the account exists: the link (null if the link step failed).
  const [created, setCreated] = useState<{ link: string | null; linkError: string | null } | null>(null)
  const { busy, run } = useBusy()

  const emailOk = isValidEmail(email)
  const label = name.trim() || email.trim().split('@')[0]

  const create = () =>
    run(async () => {
      if (!emailOk) return
      try {
        const result = await store.createAccount(email, name, spaceIds)
        setCreated({
          link: result.tokenHash ? setPasswordLink(window.location.origin, result.tokenHash) : null,
          linkError: result.linkError,
        })
      } catch {
        // Not created — the modal stays open; store.error says why.
      }
    })

  const requestClose = () => {
    if (!busy) onClose()
  }

  return (
    <ModalShell opened={opened} onClose={requestClose} title={created ? 'Link ready' : 'New account'}>
      {created ? (
        <>
          <Text fz={text.small} c={colors.inkSoft} mb={14}>
            {label}’s account is made. They can’t sign in until they set a password.
          </Text>
          {created.link ? (
            <LinkPanel link={created.link} name={label} />
          ) : (
            <Text fz={text.small} c={colors.ink}>
              ⚠ No link yet{created.linkError ? ` (${created.linkError})` : ''}. Open their row under People and use
              “Copy set-password link”.
            </Text>
          )}
          <Group justify="flex-end" mt={22}>
            <Button onClick={onClose}>Done</Button>
          </Group>
        </>
      ) : (
        <>
          <Stack gap={14}>
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              onBlur={() => setEmailTouched(true)}
              error={emailTouched && email.trim() && !emailOk ? 'That doesn’t look like an email.' : null}
              placeholder="name@example.com"
              data-autofocus
              autoComplete="off"
            />
            <TextInput
              label="Display name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Optional — defaults to the start of the email"
              autoComplete="off"
            />
            <SpaceCheckboxes spaces={spaces} value={spaceIds} onChange={setSpaceIds} />
            <Text fz={text.caption} c={colors.faint}>
              No email is sent. Next you’ll get a one-time link to send them yourself.
            </Text>
          </Stack>
          <ModalFooter
            onCancel={requestClose}
            onConfirm={() => void create()}
            confirmLabel="Create account"
            confirmDisabled={!emailOk}
            loading={busy}
          />
        </>
      )}
    </ModalShell>
  )
}
