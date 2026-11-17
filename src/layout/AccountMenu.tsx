import { startTransition, useState } from 'react'
import { Button, Group, Menu, Text, UnstyledButton } from '@mantine/core'
import { Link, useLocation, useNavigate } from 'react-router'
import { colors, fonts, radii, shadows, text } from '../theme'
import { supabase } from '../lib/supabase'
import { type SpaceInfo, useSpaceContext } from '../data/useSpace'
import { enabledFeatures, landingPath } from './features'
import { ModalShell } from '../components/ModalShell'
import { PasswordForm } from '../components/PasswordForm'

/** The header's right-hand menu. Its trigger shows the current space's name
 *  when you're in more than one (otherwise a neutral "Account"); it opens:
 *  your spaces (✓ on the current one — only with more than one), Admin (the
 *  admin only), Change password, and Sign out (live only). Stays in the
 *  header at every width, so the drawer needs no copy of it. */
export function AccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { spaces, current, isAdmin, switchTo } = useSpaceContext()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const switcher = spaces.length > 1
  const [changingPassword, setChangingPassword] = useState(false)

  // Switch and navigate in ONE transition, so the new space (whose Routes
  // remount, keyed by space) never renders at the old path — the old path
  // could be a feature the new space doesn't have, or an id from the old one.
  const pick = (space: SpaceInfo) => {
    onNavigate?.()
    if (space.id === current?.id) return
    startTransition(() => {
      switchTo(space.id)
      navigate(landingPath(pathname, enabledFeatures(space.enabledFeatures)))
    })
  }

  return (
    <>
      <Menu position="bottom-end" width={230} shadow="none" styles={menuStyles}>
        <Menu.Target>
          <UnstyledButton
            aria-label="Account menu"
            px={11}
            py={6}
            style={{
              fontFamily: fonts.sans,
              fontSize: text.small,
              fontWeight: 600,
              color: colors.inkSoft,
              borderRadius: radii.chip,
              border: `1px solid ${colors.borderFaint}`,
              background: colors.surface,
              whiteSpace: 'nowrap',
              display: 'flex',
              gap: 5,
              minWidth: 0,
              flexShrink: 1,
              overflow: 'hidden',
              maxWidth: 'min(180px, 34vw)',
            }}
          >
            {/* Only the name truncates; the caret always shows. */}
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {switcher && current ? current.name : 'Account'}
            </span>
            <span aria-hidden>▾</span>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          {switcher && (
            <>
              <Menu.Label>Spaces</Menu.Label>
              {spaces.map((space) => {
                const active = space.id === current?.id
                return (
                  <Menu.Item
                    key={space.id}
                    onClick={() => pick(space)}
                    // A ✓ and bold, never color alone.
                    leftSection={<span style={{ width: 14, display: 'inline-block' }}>{active ? '✓' : ''}</span>}
                    aria-current={active ? 'true' : undefined}
                    fw={active ? 700 : 500}
                  >
                    {space.name}
                  </Menu.Item>
                )
              })}
            </>
          )}
          {switcher && <Menu.Divider />}
          {isAdmin && (
            <Menu.Item component={Link} to="/admin" onClick={onNavigate}>
              Admin
            </Menu.Item>
          )}
          {/* Also in seed mode, where it fakes success — there's no account,
              but it keeps the modal reachable for the e2e suite. */}
          <Menu.Item
            onClick={() => {
              onNavigate?.()
              setChangingPassword(true)
            }}
          >
            Change password
          </Menu.Item>
          {supabase && <Menu.Item onClick={() => supabase!.auth.signOut()}>Sign out</Menu.Item>}
        </Menu.Dropdown>
      </Menu>
      <ChangePasswordModal opened={changingPassword} onClose={() => setChangingPassword(false)} />
    </>
  )
}

/** `updateUser` only — the signed-in session is the proof (this assumes the
 *  project's "secure password change" / reauthentication setting stays off;
 *  with it on, an old session would get an error here). Success swaps the form for a
 *  one-line confirmation. Mantine unmounts a closed modal's body, so each
 *  opening starts blank. */
function ChangePasswordModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <ModalShell opened={opened} onClose={onClose} title="Change password">
      <ChangePasswordBody onClose={onClose} />
    </ModalShell>
  )
}

function ChangePasswordBody({ onClose }: { onClose: () => void }) {
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <>
        <Text fz={text.body} c={colors.ink} role="status">
          ✓ Password changed.
        </Text>
        <Group justify="flex-end" mt={22}>
          <Button onClick={onClose} data-autofocus>
            Done
          </Button>
        </Group>
      </>
    )
  }

  return (
    <PasswordForm
      submitLabel="Change password"
      onCancel={onClose}
      onSubmit={async (password) => {
        if (supabase) {
          const { error } = await supabase.auth.updateUser({ password })
          if (error) return error.message
        }
        setDone(true)
        return null
      }}
    />
  )
}

const menuStyles = {
  dropdown: {
    background: colors.surface,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: radii.card,
    boxShadow: shadows.popover,
  },
  label: { fontFamily: fonts.sans, color: colors.muted },
  item: { fontFamily: fonts.sans, fontSize: text.small, color: colors.ink },
  divider: { borderColor: colors.borderFaint },
}
