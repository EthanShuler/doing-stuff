import { useState } from 'react'
import type { FormEvent } from 'react'
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
import { colors, fonts } from '../theme'

type Mode = 'signin' | 'signup'

const eyebrowStyle = {
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
}

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      // On success, onAuthStateChange swaps the view — nothing else to do.
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else if (data.session) {
        // Email confirmation is off → already logged in; the listener takes over.
      } else {
        // Email confirmation is on → no session until they click the link.
        setNotice('Check your email for a confirmation link, then sign in.')
        setMode('signin')
      }
    }
    setBusy(false)
  }

  const switchMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
    setError(null)
    setNotice(null)
  }

  return (
    <Center mih="100vh" bg={colors.pageBg} p={24} c={colors.ink} style={{ fontFamily: fonts.sans }}>
      <Box w="100%" maw={380}>
        <Text ta="center" mb={9} c="clay.6" style={eyebrowStyle}>
          Our city, together
        </Text>
        <Title order={1} ta="center" fz={36} lh={1.05} mb={6} style={{ letterSpacing: '-0.01em' }}>
          Doing Stuff
        </Title>
        <Text ta="center" c={colors.muted} fz={14} mb={28}>
          {mode === 'signin' ? 'Sign in to your shared log' : 'Create your account'}
        </Text>

        <Paper
          component="form"
          onSubmit={submit}
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
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <PasswordInput
              id="password"
              label="Password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />

            {error && (
              <Text fz={13} c="oklch(0.5 0.16 25)">
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
