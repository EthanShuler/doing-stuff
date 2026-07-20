import { useState } from 'react'
import { Box, Group, SegmentedControl } from '@mantine/core'
import { colors, fonts } from '../../theme'
import { Bassoon } from './Bassoon'
import { Piano } from './Piano'

type Screen = 'bassoon' | 'piano'

export function MusicPracticePage({ spaceId, userId }: { spaceId: string | null; userId: string | null }) {
  const [screen, setScreen] = useState<Screen>('bassoon')

  return (
    <>
      <title>Music Practice · cajubinile.com</title>

      <Box pt={30} pb={80} px={24} c={colors.ink} style={{ fontFamily: fonts.sans }}>
        <Box maw={1200} mx="auto">
          <Group
            justify="space-between"
            align="center"
            gap={12}
            wrap="wrap"
            pb={18}
            style={{ borderBottom: `1px dotted ${colors.rule}` }}
          >
            <SegmentedControl
              value={screen}
              onChange={(value) => setScreen(value as Screen)}
              data={[
                { label: 'Bassoon', value: 'bassoon' },
                { label: 'Piano', value: 'piano' },
              ]}
            />
          </Group>

          {screen === 'bassoon' ? (
            <Bassoon spaceId={spaceId} userId={userId} />
          ) : (
            <Piano />
          )}
        </Box>
      </Box>
    </>
  )
}