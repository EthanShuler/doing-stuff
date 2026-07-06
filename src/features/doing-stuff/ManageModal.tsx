import { useEffect, useState } from 'react'
import { Box, Button, Group, Paper, Text, TextInput, Title, UnstyledButton } from '@mantine/core'
import type { Activity, Category, Home } from '../../types'
import { colors, fonts, palette, swatchFor } from '../../theme'
import { ModalShell } from '../../components/ModalShell'

interface ManageModalProps {
  opened: boolean
  categories: Category[]
  activities: Activity[]
  home: Home
  onAddActivity: (categoryId: string, name: string) => void
  onDeleteActivity: (id: string) => void
  onSetActivityEmoji: (id: string, emoji: string) => void
  onAddCategory: (name: string, colorIndex: number) => void
  onDeleteCategory: (id: string) => void
  onSetHome: (address: string) => void
  onClose: () => void
}

export function ManageModal({
  opened,
  categories,
  activities,
  home,
  onAddActivity,
  onDeleteActivity,
  onSetActivityEmoji,
  onAddCategory,
  onDeleteCategory,
  onSetHome,
  onClose,
}: ManageModalProps) {
  // Per-category "add activity" text inputs, keyed by category id.
  const [activityDrafts, setActivityDrafts] = useState<Record<string, string>>({})
  // Per-activity emoji edits, keyed by activity id; committed on blur / Enter.
  const [emojiDrafts, setEmojiDrafts] = useState<Record<string, string>>({})
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState(3)

  const commitEmoji = (activity: Activity) => {
    const draft = emojiDrafts[activity.id]
    if (draft !== undefined && draft !== activity.emoji) onSetActivityEmoji(activity.id, draft)
    // Drop the draft either way: the input falls back to the store's value, so
    // a failed save visibly reverts instead of showing the uncommitted emoji.
    setEmojiDrafts((prev) => {
      const next = { ...prev }
      delete next[activity.id]
      return next
    })
  }
  // Home address is edited locally and committed (geocoded) on blur / Enter /
  // button, so we don't hit Nominatim on every keystroke.
  const [homeDraft, setHomeDraft] = useState(home.address)

  // Adopt the stored address once it loads / changes (the input is otherwise
  // uncontrolled by the prop so typing isn't clobbered mid-edit).
  useEffect(() => {
    setHomeDraft(home.address)
  }, [home.address])

  const commitHome = () => {
    if (homeDraft.trim() !== home.address) onSetHome(homeDraft)
  }

  const homeUnlocated = home.address.trim().length > 0 && home.lat === null

  const submitActivity = (categoryId: string) => {
    onAddActivity(categoryId, activityDrafts[categoryId] ?? '')
    setActivityDrafts((prev) => ({ ...prev, [categoryId]: '' }))
  }

  const submitCategory = () => {
    if (!newCatName.trim()) return
    onAddCategory(newCatName, newCatColor)
    setNewCatName('')
    setNewCatColor((prev) => (prev + 1) % palette.length)
  }

  return (
    <ModalShell opened={opened} onClose={onClose} width={520}>
      <Group justify="space-between" align="center" mb={22}>
        <Title order={3} fz={28}>
          Categories &amp; activities
        </Title>
        <Button onClick={onClose} radius={9} size="sm">
          Done
        </Button>
      </Group>

      {/* HOME BASE — the shared map center. */}
      <Paper
        bg="#fff"
        withBorder
        p="16px 18px"
        mb={18}
        style={{ borderColor: colors.cardBorder, borderRadius: 14 }}
      >
        <Text fz={12} fw={700} tt="uppercase" c={colors.muted} mb={11} style={{ letterSpacing: '0.07em' }}>
          🏠 Home base
        </Text>
        <Group gap={8} align="flex-end" wrap="nowrap">
          <TextInput
            flex={1}
            value={homeDraft}
            onChange={(e) => setHomeDraft(e.currentTarget.value)}
            onBlur={commitHome}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitHome()
            }}
            placeholder="Your address — the center of the map"
            styles={{ input: { fontSize: 13 } }}
          />
          <Button variant="default" onClick={commitHome} radius={9} styles={addButtonStyles}>
            Save
          </Button>
        </Group>
        {homeUnlocated && (
          <Text fz={12} c={colors.muted} mt={8} style={{ fontStyle: 'italic', fontFamily: fonts.serif }}>
            Couldn't locate that address — the map will use a default center.
          </Text>
        )}
      </Paper>

      {categories.map((category) => {
        const swatch = swatchFor(category.colorIndex)
        const catActivities = activities.filter((a) => a.categoryId === category.id)
        return (
          <Paper
            key={category.id}
            bg="#fff"
            withBorder
            p="16px 18px"
            mb={14}
            style={{ borderColor: colors.cardBorder, borderRadius: 14 }}
          >
            <Group gap={9} align="center" mb={12}>
              <Box w={11} h={11} style={{ borderRadius: '50%', background: swatch.color, flexShrink: 0 }} />
              <Text fz={12} fw={700} tt="uppercase" c={swatch.ink} style={{ letterSpacing: '0.07em' }}>
                {category.name}
              </Text>
              <UnstyledButton
                onClick={() => {
                  if (
                    window.confirm(
                      `Remove "${category.name}"? All of its activities and their logged entries are deleted too.`,
                    )
                  ) {
                    onDeleteCategory(category.id)
                  }
                }}
                ml="auto"
                style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 600, color: colors.faint }}
              >
                Remove category
              </UnstyledButton>
            </Group>

            <Group gap={7} wrap="wrap" mb={12}>
              {catActivities.map((activity) => (
                <Box
                  key={activity.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 13,
                    fontWeight: 500,
                    background: colors.chip,
                    color: '#5c574e',
                    padding: '4px 6px 4px 6px',
                    borderRadius: 20,
                  }}
                >
                  <input
                    value={emojiDrafts[activity.id] ?? activity.emoji}
                    onChange={(e) => setEmojiDrafts((prev) => ({ ...prev, [activity.id]: e.currentTarget.value }))}
                    onBlur={() => commitEmoji(activity)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                    placeholder="📍"
                    aria-label={`Emoji for ${activity.name}`}
                    style={{
                      width: 26,
                      textAlign: 'center',
                      border: 'none',
                      outline: 'none',
                      background: '#fff',
                      borderRadius: '50%',
                      padding: '3px 0',
                      fontSize: 15,
                      lineHeight: 1,
                      cursor: 'text',
                    }}
                  />
                  <span style={{ padding: '0 2px' }}>{activity.name}</span>
                  <UnstyledButton
                    onClick={() => {
                      if (window.confirm(`Remove "${activity.name}"? Its logged entries are deleted too.`)) {
                        onDeleteActivity(activity.id)
                      }
                    }}
                    aria-label={`Remove ${activity.name}`}
                    style={{ fontFamily: fonts.sans, fontSize: 14, lineHeight: 1, color: '#b3ada3', padding: '0 2px' }}
                  >
                    ×
                  </UnstyledButton>
                </Box>
              ))}
            </Group>

            <Group gap={8} align="flex-end" wrap="nowrap">
              <TextInput
                flex={1}
                value={activityDrafts[category.id] ?? ''}
                onChange={(e) => {
                  const value = e.currentTarget.value
                  setActivityDrafts((prev) => ({ ...prev, [category.id]: value }))
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitActivity(category.id)
                }}
                placeholder="Add an activity…"
                styles={{ input: { fontSize: 13 } }}
              />
              <Button
                variant="default"
                onClick={() => submitActivity(category.id)}
                radius={9}
                styles={addButtonStyles}
              >
                Add
              </Button>
            </Group>
          </Paper>
        )
      })}

      <Box
        bg="oklch(0.96 0.018 78)"
        p="16px 18px"
        mt={18}
        style={{ border: '1px dashed rgba(120,100,80,0.3)', borderRadius: 14 }}
      >
        <Text fz={12} fw={600} tt="uppercase" c={colors.muted} mb={11} style={{ letterSpacing: '0.06em' }}>
          New category
        </Text>
        <Group gap={8} mb={13} align="flex-end" wrap="nowrap">
          <TextInput
            flex={1}
            value={newCatName}
            onChange={(e) => setNewCatName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCategory()
            }}
            placeholder="e.g. Date nights"
            styles={{ input: { fontSize: 13 } }}
          />
          <Button onClick={submitCategory} radius={9}>
            Create
          </Button>
        </Group>
        <Group gap={10} align="center">
          <Text fz={11} c={colors.muted} style={{ fontFamily: fonts.mono, letterSpacing: '0.06em' }}>
            COLOR
          </Text>
          {palette.map((swatch, index) => (
            <UnstyledButton
              key={index}
              onClick={() => setNewCatColor(index)}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: swatch.color,
                border: `3px solid ${newCatColor === index ? colors.ink : 'transparent'}`,
              }}
            />
          ))}
        </Group>
      </Box>
    </ModalShell>
  )
}

const addButtonStyles = {
  root: {
    background: colors.chip,
    border: '1px solid rgba(120,100,80,0.18)',
    color: '#5c574e',
    fontSize: 13,
  },
}
