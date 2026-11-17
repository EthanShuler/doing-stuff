import { Box, Button, Checkbox, CopyButton, Group, Stack, Text, TextInput } from '@mantine/core'
import { colors, fieldLabelStyle, fonts, radii, text } from '../../theme'
import { type AdminSpace, toggleId } from './derive'

/** A small word tag on a row ("Admin", "No password yet") — status in words,
 *  never a color alone. `strong` gives it an ink outline for the one tag that
 *  asks for action. */
export function WordTag({ children, strong = false }: { children: string; strong?: boolean }) {
  return (
    <Text
      component="span"
      fz={text.tiny}
      fw={600}
      c={strong ? colors.ink : colors.muted}
      px={7}
      py={1}
      bg={colors.chip}
      style={{
        fontFamily: fonts.sans,
        borderRadius: 20,
        border: `1px ${strong ? 'dashed' : 'solid'} ${strong ? colors.dashedBorder : colors.borderFaint}`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </Text>
  )
}

/** A space name chip on a person's row. */
export function SpaceChip({ children }: { children: string }) {
  return (
    <Text
      component="span"
      fz={text.tiny}
      c={colors.inkFaded}
      px={8}
      py={2}
      bg={colors.surface}
      style={{
        fontFamily: fonts.sans,
        borderRadius: radii.chip,
        border: `1px solid ${colors.cardBorder}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Text>
  )
}

/** One checkbox per space — which spaces a person is in. */
export function SpaceCheckboxes({
  spaces,
  value,
  onChange,
}: {
  spaces: AdminSpace[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <Box>
      <Text component="span" style={fieldLabelStyle}>
        Spaces
      </Text>
      {spaces.length === 0 ? (
        <Text fz={text.small} c={colors.faint}>
          No spaces yet — make one on the Spaces screen.
        </Text>
      ) : (
        <Stack gap={8}>
          {spaces.map((space) => (
            <Checkbox
              key={space.id}
              label={space.name}
              checked={value.includes(space.id)}
              onChange={(e) => onChange(toggleId(value, space.id, e.currentTarget.checked))}
            />
          ))}
        </Stack>
      )}
    </Box>
  )
}

/** The one-time set-password link, ready to copy, with the warning that
 *  matters: opening it yourself signs you in as them and spends it. */
export function LinkPanel({ link, name, copiedAlready = false }: { link: string; name: string; copiedAlready?: boolean }) {
  return (
    <Box
      p={14}
      bg={colors.cardTint}
      style={{ borderRadius: radii.panel, border: `1px solid ${colors.cardBorder}` }}
      data-link-panel
    >
      <Text fz={text.small} c={colors.inkSoft} mb={10}>
        {copiedAlready ? 'Copied. ' : ''}Send this to {name} — it lets them set a password and sign in. It works once.
      </Text>
      <Group gap={8} wrap="nowrap" align="flex-end">
        <TextInput
          value={link}
          readOnly
          aria-label="Set-password link"
          onFocus={(e) => e.currentTarget.select()}
          style={{ flex: 1, minWidth: 0 }}
          styles={{ input: { fontFamily: fonts.mono, fontSize: text.caption } }}
        />
        <CopyButton value={link}>
          {({ copied, copy }) => (
            <Button onClick={copy} variant={copied ? 'secondary' : undefined} style={{ flexShrink: 0 }}>
              {copied ? 'Copied ✓' : 'Copy link'}
            </Button>
          )}
        </CopyButton>
      </Group>
      <Text fz={text.caption} c={colors.inkFaded} mt={10}>
        <strong>⚠ Don’t open it yourself.</strong> It would sign this browser in as them and use the link up.
      </Text>
    </Box>
  )
}
