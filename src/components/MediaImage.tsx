import { useState } from 'react'
import { Box } from '@mantine/core'
import { colors } from '../theme'
import { posterSrc } from '../lib/imageUrl'

/** Last-resort rendered width when `width` is a percentage and the caller gave
 *  no `srcWidth` — roughly a tier card, the densest place this renders. */
const DEFAULT_SRC_WIDTH = 76

/** A poster/cover image with a graceful emoji fallback for '' or broken URLs —
 *  shared by the board cards (full-width) and the list rows (thumbnail).
 *  The broken state is remembered per URL, so pasting a new link retries. */
export function MediaImage({
  imageUrl,
  title,
  emoji,
  width,
  height,
  radius = 0,
  emojiSize = 26,
  srcWidth,
}: {
  imageUrl: string
  title: string
  /** Kind emoji shown when there's no usable image (see KIND_COPY). */
  emoji: string
  width: number | string
  height: number
  radius?: number
  emojiSize?: number
  /** Rendered width in CSS px, used to ask the CDN for a right-sized file
   *  (see posterSrc). Defaults to a numeric `width` — pass it explicitly
   *  whenever `width` is a percentage. */
  srcWidth?: number
}) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)
  if (!imageUrl || brokenUrl === imageUrl) {
    return (
      <Box
        w={width}
        h={height}
        bg={colors.chip}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderRadius: radius,
          fontSize: emojiSize,
        }}
      >
        {emoji}
      </Box>
    )
  }
  // The rewritten src is a render-time detail; `brokenUrl` stays keyed on the
  // STORED url so the retry-on-new-link behaviour doesn't depend on sizing.
  return (
    <img
      src={posterSrc(imageUrl, srcWidth ?? (typeof width === 'number' ? width : DEFAULT_SRC_WIDTH))}
      alt={title}
      onError={() => setBrokenUrl(imageUrl)}
      draggable={false}
      loading="lazy"
      decoding="async"
      style={{ width, height, objectFit: 'cover', borderRadius: radius, flexShrink: 0, display: 'block' }}
    />
  )
}
