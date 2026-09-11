import { Text } from '@mantine/core'
import type { LittleGuy } from '../../types'
import { colors, fonts, text } from '../../theme'
import { PhotoCard, PhotoCardGrid } from '../../components/PhotoCard'
import { PhotoWithFallback } from '../../components/PhotoWithFallback'
import type { Member } from './derive'
import { ownerLabel } from './derive'

export const LITTLE_GUY_EMOJI = '🗿'

/** A little guy's photo with a 🗿 fallback — see PhotoWithFallback. Shared by
 *  the grid cards and the modal preview. */
export function LittleGuyPhoto({
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
    <PhotoWithFallback
      imageUrl={imageUrl}
      alt={name}
      height={height}
      fallbackEmoji={LITTLE_GUY_EMOJI}
      emojiSize={emojiSize}
    />
  )
}

/** The collection as a photo card grid (already sorted A–Z — see
 *  sortLittleGuys). Each card is name + personality + who he belongs to;
 *  clicking one opens the edit modal with the full story. */
export function LittleGuyGrid({
  guys,
  members,
  onEdit,
}: {
  guys: LittleGuy[]
  members: Member[]
  onEdit: (guy: LittleGuy) => void
}) {
  return (
    <PhotoCardGrid>
      {guys.map((guy) => (
        <PhotoCard
          key={guy.id}
          imageUrl={guy.imageUrl}
          alt={guy.name}
          fallbackEmoji={LITTLE_GUY_EMOJI}
          title={guy.name}
          onClick={() => onEdit(guy)}
        >
          {guy.personality && (
            <Text fz={text.small} c={colors.muted} mt={2} style={{ fontFamily: fonts.serif, fontStyle: 'italic' }}>
              {guy.personality}
            </Text>
          )}
          <Text fz={text.tiny} c={colors.faint} mt={4} style={{ fontFamily: fonts.mono }}>
            {ownerLabel(guy, members)}
          </Text>
        </PhotoCard>
      ))}
    </PhotoCardGrid>
  )
}
