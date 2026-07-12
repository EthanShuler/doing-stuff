import { useState } from 'react'
import { Box, Text, UnstyledButton } from '@mantine/core'
import type { Spoon } from '../../types'
import { colors, fonts } from '../../theme'
import { formatDateWithYear } from '../../lib/format'
import { EmptyCard } from '../../components/EmptyCard'

export const SPOON_EMOJI = '🥄'

/** A spoon photo with a 🥄 fallback for '' or broken URLs. The broken state is
 *  remembered per URL, so uploading a replacement retries. Shared by the grid
 *  cards and the modal preview. */
export function SpoonPhoto({
  imageUrl,
  name,
  height,
  emojiSize = 40,
}: {
  imageUrl: string
  name: string
  height: number
  emojiSize?: number
}) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)
  if (!imageUrl || brokenUrl === imageUrl) {
    return (
      <Box
        w="100%"
        h={height}
        bg={colors.chip}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: emojiSize }}
      >
        {SPOON_EMOJI}
      </Box>
    )
  }
  return (
    <img
      src={imageUrl}
      alt={name}
      onError={() => setBrokenUrl(imageUrl)}
      style={{ width: '100%', height, objectFit: 'cover', display: 'block' }}
    />
  )
}

/** The collection as a photo card grid (already sorted — see sortSpoons).
 *  Clicking a card opens the edit modal. */
export function SpoonGrid({ spoons, onEdit }: { spoons: Spoon[]; onEdit: (spoon: Spoon) => void }) {
  if (spoons.length === 0) {
    return (
      <EmptyCard
        title="No spoons yet"
        blurb="Log the first one — a name is all it takes; photo and place can come later."
      />
    )
  }

  return (
    <Box
      mt={24}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: 18,
      }}
    >
      {spoons.map((spoon) => (
        <UnstyledButton
          key={spoon.id}
          onClick={() => onEdit(spoon)}
          bg="#fff"
          style={{
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(40,30,20,0.08)',
            display: 'block',
          }}
        >
          <SpoonPhoto imageUrl={spoon.imageUrl} name={spoon.name} height={170} />
          <Box p="10px 12px 12px">
            <Text fz={15} fw={700} c={colors.ink} lh={1.3} style={{ fontFamily: fonts.sans }}>
              {spoon.name}
            </Text>
            {spoon.place && (
              <Text fz={12.5} c={colors.muted} mt={2} style={{ fontFamily: fonts.sans }}>
                {spoon.place}
              </Text>
            )}
            {spoon.acquiredOn && (
              <Text fz={11} c={colors.faint} mt={4} style={{ fontFamily: fonts.mono }}>
                {formatDateWithYear(spoon.acquiredOn)}
              </Text>
            )}
          </Box>
        </UnstyledButton>
      ))}
    </Box>
  )
}
