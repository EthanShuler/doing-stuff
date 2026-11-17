import { useEffect, useState } from 'react'
import { Anchor, Box, Center, Paper, Text, Title } from '@mantine/core'
import { supabase } from '../lib/supabase'
import { colors, fonts, text } from '../theme'
import { PasswordForm } from './PasswordForm'

/** The path the admin's set-password links point at. `main.tsx` renders this
 *  screen instead of the app on it, ahead of the session gate. */
export const SET_PASSWORD_PATH = '/set-password'

/** `#token_hash=…` — the link carries the token in the fragment so it never
 *  reaches a server log. */
function readTokenHash(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return params.get('token_hash') || null
}

type Phase =
  /** No token in the link: looking for a session saved by an earlier verify. */
  | 'checking'
  | 'form'
  /** Expired, already used, or no token and no session. */
  | 'dead'
  /** Seed mode only — the live path leaves the page instead. */
  | 'done'

/**
 * Where an admin-made set-password link lands: `${origin}/set-password#token_hash=…`.
 *
 * The token is spent ONLY when the button is pressed — never on load, since a
 * message app's link preview would burn it. Press → `verifyOtp` (which signs
 * this browser in as the account) → `updateUser({ password })` → home.
 *
 * "Verified" is remembered: if `updateUser` fails (a weak password, say), the
 * next press retries `updateUser` alone, and the spent token is dropped from
 * the URL so a reload lands in the same updateUser-only mode via the saved
 * session rather than re-spending a dead token.
 *
 * Mounted outside `App`, so `verifyOtp`'s PASSWORD_RECOVERY event and new
 * session can't swap the app in mid-form.
 */
export function SetPasswordScreen() {
  const [tokenHash] = useState(readTokenHash)
  const [verified, setVerified] = useState(false)
  const [phase, setPhase] = useState<Phase>(() => (supabase && !tokenHash ? 'checking' : 'form'))

  // No token: a session means this tab already verified (then reloaded), so
  // finish with updateUser only. Neither = a dead link.
  useEffect(() => {
    if (phase !== 'checking' || !supabase) return
    let live = true
    supabase.auth.getSession().then(({ data }) => {
      if (!live) return
      if (data.session) {
        setVerified(true)
        setPhase('form')
      } else {
        setPhase('dead')
      }
    })
    return () => {
      live = false
    }
  }, [phase])

  const setPassword = async (password: string): Promise<string | null> => {
    if (!supabase) {
      // Seed mode: no account to set — just walk the UI through.
      setPhase('done')
      return null
    }

    if (!verified) {
      if (!tokenHash) {
        setPhase('dead')
        return null
      }
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      if (error) {
        // A 4xx is the token itself (expired / used / unknown); anything else
        // — offline, a 5xx — left the token unspent, so let them retry.
        if (error.status && error.status >= 400 && error.status < 500) {
          setPhase('dead')
          return null
        }
        return error.message
      }
      setVerified(true)
      // The token is spent; keep it out of a reload (the session carries on).
      window.history.replaceState(null, '', SET_PASSWORD_PATH)
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) return error.message
    window.location.replace('/')
    return null
  }

  return (
    <Center mih="100dvh" bg={colors.pageBg} p={24} c={colors.ink} style={{ fontFamily: fonts.sans }}>
      <title>Set your password · cajubinile.com</title>
      <Box w="100%" maw={380}>
        <Title order={1} ta="center" fz={36} lh={1.05} mb={6} style={{ letterSpacing: '-0.01em' }}>
          {phase === 'dead' ? 'Link expired' : phase === 'done' ? 'Password set' : 'Set your password'}
        </Title>
        <Text ta="center" c={colors.muted} fz={14} mb={28}>
          {phase === 'dead'
            ? 'This link no longer works'
            : phase === 'done'
              ? 'You’re all set'
              : 'Choose a password for cajubinile.com'}
        </Text>

        {phase === 'checking' ? null : (
          <Paper bg={colors.surface} radius={14} p={24} withBorder style={{ borderColor: colors.cardBorder }}>
            {phase === 'form' && <PasswordForm submitLabel="Set password" onSubmit={setPassword} />}
            {phase === 'dead' && (
              <Text fz={text.small} c={colors.ink} role="alert">
                This link has expired or was already used — ask Ethan for a new one.
              </Text>
            )}
            {phase === 'done' && (
              <Text fz={text.small} c={colors.ink} role="status">
                ✓ Password set. You can sign in with it now.
              </Text>
            )}
          </Paper>
        )}

        {phase !== 'checking' && phase !== 'form' && (
          <Text ta="center" fz={13} mt={18}>
            <Anchor href="/" fz={13} fw={600} c="clay.6">
              Go to cajubinile.com
            </Anchor>
          </Text>
        )}
      </Box>
    </Center>
  )
}
