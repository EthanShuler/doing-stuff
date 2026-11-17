import { Button, Center, Stack, Text } from '@mantine/core'
import { supabase } from '../lib/supabase'
import { colors, fonts, text } from '../theme'

/** A signed-in login that belongs to no space (and isn't the admin). Spaces
 *  are admin-managed, so there's nothing to do here but ask — or sign out and
 *  try another account. */
export function NoSpaceScreen() {
  return (
    <Center mih="100dvh" bg={colors.pageBg} p={24}>
      <title>cajubinile.com</title>
      <Stack align="center" gap={10} maw={360} style={{ fontFamily: fonts.sans }}>
        <Text fz={24} fw={500} c={colors.ink} ta="center" style={{ fontFamily: fonts.serif }}>
          You’re not in a space yet
        </Text>
        <Text c={colors.muted} fz={text.small} ta="center">
          Ask Ethan to add you.
        </Text>
        {supabase && (
          <Button mt={8} variant="secondary" onClick={() => supabase!.auth.signOut()}>
            Sign out
          </Button>
        )}
      </Stack>
    </Center>
  )
}
