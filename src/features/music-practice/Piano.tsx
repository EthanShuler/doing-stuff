import { useState } from 'react'
import { Box, Button, Stack, Text } from '@mantine/core'
import { colors, fonts, warmBorder } from '../../theme'
import { KEYS, SCALES_CHORDS, randomPractice } from './derive'

export function Piano() {
  const [scale, setScale] = useState(0)
  const [key, setKey] = useState(0)

  const randomize = () => {
    const { keyIndex, scaleIndex } = randomPractice()
    setKey(keyIndex)
    setScale(scaleIndex)
  }

  const current = SCALES_CHORDS[scale]

  return (
    <Stack align="center" gap={28} mt={40}>
      <Box
        w="100%"
        maw={460}
        bg={colors.cardTint}
        ta="center"
        p="44px 32px"
        style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 18 }}
      >
        <Text
          fz={12}
          fw={600}
          c={colors.muted}
          mb={18}
          style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Practice
        </Text>

        <Text fz={64} lh={1} c={colors.ink} style={{ fontFamily: fonts.mono }}>
          {KEYS[key]}
          {current.chord}
        </Text>

        <Text fz={20} mt={14} c={colors.inkSoft} style={{ fontFamily: fonts.serif }}>
          {KEYS[key]} {current.scale}
        </Text>
      </Box>

      <Button onClick={randomize} size="md" px={40}>
        Randomize
      </Button>

      <Text fz={13} c={colors.faint} style={{ borderTop: `1px dotted ${warmBorder(0.2)}`, paddingTop: 14 }}>
        {SCALES_CHORDS.length} scales · {KEYS.length} keys
      </Text>
    </Stack>
  )
}
