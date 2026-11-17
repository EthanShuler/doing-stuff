import { useActionState, useState } from 'react'
import { Box, Button, Center, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { supabase } from '../lib/supabase'
import { DANGER, colors, fonts } from '../theme'

/** Sign in only. Accounts are admin-made (the admin page creates one and
 *  hands over a set-password link), so there is no sign-up here. */
export function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // A React 19 form action: useActionState holds the failure message and the
  // pending flag; on success the auth listener swaps the whole view.
  const [error, submit, busy] = useActionState<string | null>(async () => {
    if (!supabase) return null
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    return err ? err.message : null
  }, null)

  return (
    <Center mih="100dvh" bg={colors.pageBg} p={24} c={colors.ink} style={{ fontFamily: fonts.sans }}>
      <title>Sign in · cajubinile.com</title>
      <Box w="100%" maw={380}>
        <Title order={1} ta="center" fz={36} lh={1.05} mb={28} style={{ letterSpacing: '-0.01em' }}>
          cajubinile.com
        </Title>

        <Paper
          component="form"
          action={submit}
          bg={colors.surface}
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />

            {error && (
              <Text fz={13} c={DANGER}>
                {error}
              </Text>
            )}

            <Button type="submit" loading={busy} fullWidth>
              Sign in
            </Button>
          </Stack>
        </Paper>

        <Text ta="center" fz={13} c={colors.muted} mt={18}>
          Accounts come from Ethan — ask him for a link.
        </Text>
      </Box>
    </Center>
  )
}
