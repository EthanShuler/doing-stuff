import { Center } from '@mantine/core'
import { colors, fonts } from '../theme'

/** Centered muted message — the full-screen loading/fatal states in App and
 *  the in-shell loading gates on each feature page (pass a smaller `mih`). */
export function Splash({ text, mih = '100vh' }: { text: string; mih?: string }) {
  return (
    <Center mih={mih} bg={colors.pageBg} c={colors.muted} p={24} ta="center" style={{ fontFamily: fonts.sans }}>
      {text}
    </Center>
  )
}
