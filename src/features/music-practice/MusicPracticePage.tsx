import { useState } from 'react'
import { SegmentedControl } from '@mantine/core'
import { ControlBar } from '../../components/ControlBar'
import { PageFrame } from '../../components/PageFrame'
import { Bassoon } from './Bassoon'
import { Piano } from './Piano'

type Screen = 'bassoon' | 'piano'

export function MusicPracticePage({ spaceId, userId }: { spaceId: string | null; userId: string | null }) {
  const [screen, setScreen] = useState<Screen>('bassoon')

  return (
    <>
      <title>Music Practice · cajubinile.com</title>

      <PageFrame>
        <ControlBar
          left={
            <SegmentedControl
              value={screen}
              onChange={(value) => setScreen(value as Screen)}
              data={[
                { label: 'Bassoon', value: 'bassoon' },
                { label: 'Piano', value: 'piano' },
              ]}
            />
          }
        />

        {screen === 'bassoon' ? <Bassoon spaceId={spaceId} userId={userId} /> : <Piano />}
      </PageFrame>
    </>
  )
}