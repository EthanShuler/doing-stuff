import { useState } from 'react'
import { Box } from '@mantine/core'
import { colors } from '../theme'

/** A photo with an emoji fallback for '' or broken URLs. The broken state is
 *  remembered per URL, so uploading a replacement retries. Shared by the
 *  spoons and recipes grids, detail views, and modal previews (each feature
 *  wraps it with its own emoji — SpoonPhoto / RecipePhoto). */
export function PhotoWithFallback({
  imageUrl,
  alt,
  height,
  fallbackEmoji,
  emojiSize = 40,
}: {
  imageUrl: string
  alt: string
  height: number
  fallbackEmoji: string
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
        {fallbackEmoji}
      </Box>
    )
  }
  return (
    <img
      src={imageUrl}
      alt={alt}
      onError={() => setBrokenUrl(imageUrl)}
      style={{ width: '100%', height, objectFit: 'cover', display: 'block' }}
    />
  )
}
