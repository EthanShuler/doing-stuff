import { Box, Text, UnstyledButton } from '@mantine/core'
import type { LittleGuy } from '../../types'
import { colors, fonts } from '../../theme'
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
    <Box
      mt={24}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: 18,
      }}
    >
      {guys.map((guy) => (
        <UnstyledButton
          key={guy.id}
          onClick={() => onEdit(guy)}
          bg="#fff"
          style={{
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(40,30,20,0.08)',
            display: 'block',
          }}
        >
          <LittleGuyPhoto imageUrl={guy.imageUrl} name={guy.name} height={170} />
          <Box p="10px 12px 12px">
            <Text fz={15} fw={700} c={colors.ink} lh={1.3} style={{ fontFamily: fonts.sans }}>
              {guy.name}
            </Text>
            {guy.personality && (
              <Text fz={12.5} c={colors.muted} mt={2} style={{ fontFamily: fonts.serif, fontStyle: 'italic' }}>
                {guy.personality}
              </Text>
            )}
            <Text fz={11} c={colors.faint} mt={4} style={{ fontFamily: fonts.mono }}>
              {ownerLabel(guy, members)}
            </Text>
          </Box>
        </UnstyledButton>
      ))}
    </Box>
  )
}
