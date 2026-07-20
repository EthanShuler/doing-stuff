import { useActionState, useState } from 'react'
import {
  Anchor,
  Box,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { supabase } from '../lib/supabase'
import { DANGER, colors, fonts } from '../theme'

type Mode = 'signin' | 'signup'

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  // Lifted so switching modes keeps what's typed; the form itself is keyed on
  // the mode, so its action state (a stale error) resets on switch.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // The confirm-email notice outlives the sign-up form (which unmounts when
  // sign-up flips back to sign-in), so it lives here.
  const [notice, setNotice] = useState<string | null>(null)

  const switchMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
    setNotice(null)
  }

  return (
    <Center mih="100vh" bg={colors.pageBg} p={24} c={colors.ink} style={{ fontFamily: fonts.sans }}>
      <title>Sign in · cajubinile.com</title>
      <Box w="100%" maw={380}>
        <Title order={1} ta="center" fz={36} lh={1.05} mb={6} style={{ letterSpacing: '-0.01em' }}>
          Doing Stuff
        </Title>
        <Text ta="center" c={colors.muted} fz={14} mb={28}>
          {mode === 'signin' ? 'Sign in to your shared log' : 'Create your account'}
        </Text>

        <AuthForm
          key={mode}
          mode={mode}
          email={email}
          password={password}
          notice={notice}
          onEmail={setEmail}
          onPassword={setPassword}
          onNeedsConfirmation={() => {
            // Email confirmation is on → no session until they click the link.
            setNotice('Check your email for a confirmation link, then sign in.')
            setMode('signin')
          }}
        />

        <Text ta="center" fz={13} c={colors.muted} mt={18}>
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <Anchor component="button" type="button" onClick={switchMode} fz={13} fw={600} c="clay.6">
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </Anchor>
        </Text>
      </Box>
    </Center>
  )
}

/** One mode's form. The submit is a React 19 form action: useActionState
 *  holds the failure message and the pending flag, and on success the auth
 *  listener swaps the whole view (so there's nothing to reset here). */
function AuthForm({
  mode,
  email,
  password,
  notice,
  onEmail,
  onPassword,
  onNeedsConfirmation,
}: {
  mode: Mode
  email: string
  password: string
  notice: string | null
  onEmail: (email: string) => void
  onPassword: (password: string) => void
  onNeedsConfirmation: () => void
}) {
  const [error, submit, busy] = useActionState<string | null>(async () => {
    if (!supabase) return null

    if (mode === 'signin') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      // On success, onAuthStateChange swaps the view — nothing else to do.
      return err ? err.message : null
    }

    const { data, error: err } = await supabase.auth.signUp({ email, password })
    if (err) return err.message
    // With email confirmation off there's already a session and the listener
    // takes over; otherwise bounce back to sign-in with the notice.
    if (!data.session) onNeedsConfirmation()
    return null
  }, null)

  return (
    <Paper
      component="form"
      action={submit}
      bg="#fff"
      radius={14}
      p={24}
      withBorder
      style={{ borderColor: colors.cardBorder }}
    >
      <Stack gap={16}>
        <TextInput
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => onEmail(e.currentTarget.value)}
        />
        <PasswordInput
          id="password"
          label="Password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          required
          minLength={6}
          value={password}
          onChange={(e) => onPassword(e.currentTarget.value)}
        />

        {error && (
          <Text fz={13} c={DANGER}>
            {error}
          </Text>
        )}
        {notice && (
          <Text fz={13} c={colors.ink}>
            {notice}
          </Text>
        )}

        <Button type="submit" loading={busy} fullWidth>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
      </Stack>
    </Paper>
  )
}
