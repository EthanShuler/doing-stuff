import { Box, Text } from '@mantine/core'
import { colors, fonts } from '../theme'

/** Placeholder page for features that aren't built yet. */
export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <Box pt={72} pb={80} px={24} ta="center" c={colors.ink} style={{ fontFamily: fonts.sans }}>
      <title>{`${title} · cajubinile.com`}</title>
      <Box
        maw={520}
        mx="auto"
        bg="#fff"
        p="64px 32px"
        style={{ border: `1px dashed ${colors.dashedBorder}`, borderRadius: 16 }}
      >
        <Text fz={28} mb={10} style={{ fontFamily: fonts.serif }}>
          {title}
        </Text>
        <Text fz={14} c={colors.muted}>
          {blurb}
        </Text>
      </Box>
    </Box>
  )
}
