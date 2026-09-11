import { Text } from '@mantine/core'
import type { Spoon } from '../../types'
import { colors, fonts, text } from '../../theme'
import { formatDateWithYear } from '../../lib/format'
import { EmptyCard } from '../../components/EmptyCard'
import { PhotoCard, PhotoCardGrid } from '../../components/PhotoCard'
import { PhotoWithFallback } from '../../components/PhotoWithFallback'

export const SPOON_EMOJI = '🥄'

/** A spoon photo with a 🥄 fallback — see PhotoWithFallback. Shared by the
 *  grid cards and the modal preview. */
export function SpoonPhoto({
  imageUrl,
  name,
  height,
  emojiSize,
}: {
  imageUrl: string
  name: string
  height: number
  emojiSize?: number
}) {
  return (
    <PhotoWithFallback imageUrl={imageUrl} alt={name} height={height} fallbackEmoji={SPOON_EMOJI} emojiSize={emojiSize} />
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
    <PhotoCardGrid>
      {spoons.map((spoon) => (
        <PhotoCard
          key={spoon.id}
          imageUrl={spoon.imageUrl}
          alt={spoon.name}
          fallbackEmoji={SPOON_EMOJI}
          title={spoon.name}
          onClick={() => onEdit(spoon)}
        >
          {spoon.place && (
            <Text fz={text.small} c={colors.muted} mt={2} style={{ fontFamily: fonts.sans }}>
              {spoon.place}
            </Text>
          )}
          {spoon.acquiredOn && (
            <Text fz={text.tiny} c={colors.faint} mt={4} style={{ fontFamily: fonts.mono }}>
              {formatDateWithYear(spoon.acquiredOn)}
            </Text>
          )}
        </PhotoCard>
      ))}
    </PhotoCardGrid>
  )
}
