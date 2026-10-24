import { useState } from 'react'
import { Box, Button, Checkbox, Group, ScrollArea, TagsInput, Text, Textarea } from '@mantine/core'
import type { GroceryStaple } from '../../types'
import { colors, fonts, radii, text } from '../../theme'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'
import { dayName, defaultChecked, extraLines, isStaple } from './derive'
import type { GroceryGroup } from './derive'
import type { GrocerySend } from './useMealPlanStore'

/**
 * The grocery step: every recipe day's ingredient lines as a checklist —
 * checked by default, except pantry staples and lines this week already sent
 * — plus free-text extras, all added to the space's "Groceries" list.
 *
 * Its checked state is seeded on mount, so the page remounts it (a `key`)
 * per opening.
 */
export function GroceryModal({
  opened,
  groups,
  staples,
  onAddStaple,
  onRemoveStaple,
  onSend,
  onOpenList,
  onClose,
}: {
  opened: boolean
  groups: GroceryGroup[]
  staples: GroceryStaple[]
  onAddStaple: (name: string) => void
  onRemoveStaple: (id: string) => void
  /** Resolves to the Groceries list's id (null in seed mode); rejects on
   *  failure, which keeps the modal open (the store shows why). */
  onSend: (sends: GrocerySend[], extras: string[]) => Promise<string | null>
  onOpenList: (listId: string) => void
  onClose: () => void
}) {
  const [checked, setChecked] = useState<Set<string>>(() => defaultChecked(groups))
  const [extras, setExtras] = useState('')
  const [sending, setSending] = useState(false)
  /** Set once sent: how many rows went on, and where. */
  const [done, setDone] = useState<{ count: number; listId: string | null } | null>(null)

  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // Editing staples here re-applies them: a new staple unchecks the lines
  // it matches (removing one leaves the checkboxes as they are).
  const changeStaples = (names: string[]) => {
    const lower = new Set(names.map((n) => n.trim().toLowerCase()))
    for (const staple of staples) {
      if (!lower.has(staple.name.toLowerCase())) onRemoveStaple(staple.id)
    }
    const held = new Set(staples.map((s) => s.name.toLowerCase()))
    const added = names.map((n) => n.trim()).filter((n) => n && !held.has(n.toLowerCase()))
    for (const name of added) onAddStaple(name)
    if (added.length > 0) {
      const asStaples = added.map((name) => ({ id: name, name }))
      setChecked((prev) => {
        const next = new Set(prev)
        for (const line of groups.flatMap((g) => g.lines)) {
          if (isStaple(line.text, asStaples)) next.delete(line.key)
        }
        return next
      })
    }
  }

  const sends: GrocerySend[] = groups.map((g) => ({
    dayId: g.day.id,
    recipeTitle: g.recipe.title,
    lines: g.lines.filter((l) => checked.has(l.key)).map((l) => l.text),
  }))
  const extraItems = extraLines(extras)
  const count = sends.reduce((n, s) => n + s.lines.length, 0) + extraItems.length

  const send = async () => {
    if (count === 0 || sending) return
    setSending(true)
    try {
      const listId = await onSend(sends, extraItems)
      setDone({ count, listId })
    } catch {
      // Keep the modal open; store.error shows the reason.
    } finally {
      setSending(false)
    }
  }

  const requestClose = () => {
    if (!sending) onClose()
  }

  if (done) {
    return (
      <ModalShell opened={opened} onClose={onClose} title="Groceries planned" size="sm">
        <Text fz={text.body} c={colors.inkSoft}>
          Added {done.count} {done.count === 1 ? 'item' : 'items'} to the Groceries list.
          {done.listId === null && ' (Demo mode: nothing was saved to Lists.)'}
        </Text>
        <Group justify="flex-end" gap={10} mt={22}>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
          {done.listId && <Button onClick={() => onOpenList(done.listId!)}>Open Groceries list →</Button>}
        </Group>
      </ModalShell>
    )
  }

  return (
    <ModalShell opened={opened} onClose={requestClose} title="Plan groceries" size="lg">
      <Text fz={text.small} c={colors.muted} mb={16}>
        Untick what’s already in the kitchen. Staples and anything this week already added start unticked.
      </Text>

      {groups.length === 0 ? (
        <Text fz={text.small} c={colors.faint} mb={16} style={{ fontStyle: 'italic' }}>
          No recipes planned this week yet — you can still add extra items below.
        </Text>
      ) : (
        <ScrollArea.Autosize mah="45vh" type="auto" offsetScrollbars mb={16}>
          {groups.map((group) => (
            <Box key={group.day.id} mb={14}>
              <Text fz={text.lead} c={colors.ink} mb={6} style={{ fontFamily: fonts.serif }}>
                {dayName(group.day.day)} · {group.recipe.title}
              </Text>
              {group.lines.length === 0 ? (
                <Text fz={text.caption} c={colors.faint} style={{ fontStyle: 'italic' }}>
                  No ingredients written out for this recipe.
                </Text>
              ) : (
                <Box
                  bg={colors.surface}
                  style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: radii.chip, overflow: 'hidden' }}
                >
                  {group.lines.map((line, index) => (
                    <Group
                      key={line.key}
                      gap={10}
                      wrap="nowrap"
                      px={12}
                      py={7}
                      style={{ borderTop: index === 0 ? 'none' : `1px dotted ${colors.dotted}` }}
                    >
                      <Checkbox
                        checked={checked.has(line.key)}
                        onChange={() => toggle(line.key)}
                        label={line.text}
                        styles={{ label: { fontFamily: fonts.sans, fontSize: text.body, color: colors.ink } }}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      {line.sent && <LineTag>already added</LineTag>}
                      {line.staple && <LineTag>staple</LineTag>}
                    </Group>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </ScrollArea.Autosize>
      )}

      <Textarea
        label="Extra items"
        placeholder={'Paper towels\nCoffee'}
        description="One per line"
        value={extras}
        onChange={(event) => setExtras(event.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={5}
        mb={14}
      />

      <TagsInput
        label="Pantry staples"
        description="Ingredients that mention these start unticked."
        placeholder="Add a staple, press Enter"
        value={staples.map((s) => s.name)}
        onChange={changeStaples}
        comboboxProps={{ withinPortal: false }}
      />

      <ModalFooter
        onCancel={requestClose}
        onConfirm={() => void send()}
        confirmLabel={count === 0 ? 'Nothing to add' : `Add ${count} to Groceries`}
        confirmDisabled={count === 0}
        loading={sending}
      />
    </ModalShell>
  )
}

/** A faint word tag beside a line ("staple", "already added") — the reason
 *  it started unticked, in words. */
function LineTag({ children }: { children: string }) {
  return (
    <Text
      fz={text.tiny}
      c={colors.muted}
      px={7}
      py={1}
      bg={colors.chip}
      style={{ borderRadius: 20, border: `1px solid ${colors.borderFaint}`, whiteSpace: 'nowrap', flexShrink: 0 }}
    >
      {children}
    </Text>
  )
}
