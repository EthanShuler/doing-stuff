import type { CSSProperties } from 'react'
import { ACCENT, ACCENT_BLUE, DANGER, colors, fonts, text } from '../../theme'
import type { TagTone } from './derive'

/** Per-tone chip styling. The label always says what the chip means in
 *  words or an icon (📌 fixed, ⚠ deadline close / past) — the color and
 *  border weight only add emphasis, since Ethan is red-green colorblind. */
const TONES: Record<TagTone | 'plan', CSSProperties> = {
  fixed: { background: colors.chip, border: `1px solid ${colors.borderFaint}`, color: colors.inkSoft },
  planned: { background: colors.surface, border: `1px solid ${ACCENT_BLUE}`, color: ACCENT_BLUE, fontWeight: 600 },
  deadline: { background: 'transparent', border: `1px dashed ${colors.dashedBorder}`, color: colors.muted },
  urgent: { background: colors.surface, border: `1px solid ${ACCENT}`, color: ACCENT, fontWeight: 700 },
  overdue: { background: colors.surface, border: `2px solid ${DANGER}`, color: DANGER, fontWeight: 700 },
  // No tag yet: a faint call to action.
  plan: { background: 'transparent', border: '1px solid transparent', color: colors.faint },
}

/** The small day / deadline chip on an item row (see itemTag in derive.ts).
 *  Purely visual — the caller wraps it in the scheduler's trigger. */
export function TagChip({ tone, label }: { tone: TagTone | 'plan'; label: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: fonts.sans,
        fontSize: text.tiny,
        lineHeight: '16px',
        padding: '1px 7px',
        borderRadius: 20,
        whiteSpace: 'nowrap',
        ...TONES[tone],
      }}
    >
      {label}
    </span>
  )
}
