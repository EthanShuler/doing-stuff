import { useState } from 'react'
import { ActionIcon, Box, Checkbox, Group, Paper, Text, TextInput, Title } from '@mantine/core'
import type { Screen, WishlistItem } from '../types'
import { ACCENT, colors, fonts } from '../theme'
import { HeaderActions } from './HeaderActions'

interface WishlistProps {
  title: string
  items: WishlistItem[]
  screen: Screen
  onScreenChange: (screen: Screen) => void
  /** Open the new-entry modal (the global "+ New entry" header button). */
  onNewEntry: () => void
  /** Open the manage categories/activities modal. */
  onManage: () => void
  /** Check off an open item — opens the prefilled entry modal. */
  onCheck: (item: WishlistItem) => void
  /** Reopen a done item (clears its entry link). */
  onUncheck: (id: string) => void
  onAdd: (text: string) => void
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
}

const eyebrowStyle = {
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
}

export function Wishlist({
  title,
  items,
  screen,
  onScreenChange,
  onNewEntry,
  onManage,
  onCheck,
  onUncheck,
  onAdd,
  onEdit,
  onDelete,
}: WishlistProps) {
  const [addText, setAddText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const submitAdd = () => {
    const trimmed = addText.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setAddText('')
  }

  const startEdit = (item: WishlistItem) => {
    setEditingId(item.id)
    setEditText(item.text)
  }

  const commitEdit = (item: WishlistItem) => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== item.text) onEdit(item.id, trimmed)
    setEditingId(null)
  }

  return (
    <Box mih="100vh" bg={colors.pageBg} c={colors.ink} pt={48} pb={80} px={24} style={{ fontFamily: fonts.sans }}>
      <Box maw={960} mx="auto">
        {/* HEADER */}
        <Group
          justify="space-between"
          align="flex-end"
          gap={24}
          wrap="wrap"
          pb={22}
          style={{ borderBottom: '1px dotted rgba(120,100,80,0.4)' }}
        >
          <Box>
            <Text c="clay.6" mb={9} style={eyebrowStyle}>
              Things we want to try
            </Text>
            <Title order={1} fz={42} lh={1} style={{ letterSpacing: '-0.01em' }}>
              {title}
            </Title>
          </Box>
          <HeaderActions screen={screen} onScreenChange={onScreenChange} onManage={onManage} onAdd={onNewEntry} />
        </Group>

        {/* ADD */}
        <TextInput
          mt={26}
          value={addText}
          onChange={(e) => setAddText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitAdd()
          }}
          placeholder="+  Add a wish…"
          rightSection={
            addText.trim() ? (
              <ActionIcon variant="subtle" onClick={submitAdd} aria-label="Add wish" c={ACCENT}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>↵</span>
              </ActionIcon>
            ) : null
          }
          styles={{ input: { fontFamily: fonts.serif, fontSize: 16 } }}
        />

        {/* LIST */}
        {items.length === 0 ? (
          <Box
            mt={20}
            ta="center"
            bg="#fff"
            p="56px 24px"
            style={{ border: '1px dashed rgba(120,100,80,0.28)', borderRadius: 16 }}
          >
            <Text fz={22} mb={6} style={{ fontFamily: fonts.serif }}>
              No wishes yet
            </Text>
            <Text fz={14} c={colors.muted}>
              Add something you'd like to do together. Check it off and it becomes a logged entry.
            </Text>
          </Box>
        ) : (
          <Box mt={20} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item) => {
              const done = item.entryId !== null
              const editing = editingId === item.id
              return (
                <Paper
                  key={item.id}
                  bg="#fff"
                  withBorder
                  p="14px 18px"
                  style={{ borderColor: colors.cardBorder, borderRadius: 12 }}
                >
                  <Group gap={14} align="center" wrap="nowrap">
                    <Checkbox
                      checked={done}
                      onChange={() => (done ? onUncheck(item.id) : onCheck(item))}
                      radius="xl"
                      size="md"
                      color={ACCENT}
                      aria-label={done ? 'Reopen wish' : 'Check off wish'}
                      styles={{ input: { cursor: 'pointer' } }}
                    />
                    {editing ? (
                      <TextInput
                        value={editText}
                        onChange={(e) => setEditText(e.currentTarget.value)}
                        onBlur={() => commitEdit(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(item)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        autoFocus
                        flex={1}
                        styles={{ input: { fontFamily: fonts.serif, fontSize: 16 } }}
                      />
                    ) : (
                      <Text
                        flex={1}
                        onClick={() => startEdit(item)}
                        fz={17}
                        c={done ? colors.faint : colors.ink}
                        style={{
                          fontFamily: fonts.serif,
                          cursor: 'text',
                          textDecoration: done ? 'line-through' : 'none',
                        }}
                      >
                        {item.text}
                      </Text>
                    )}
                    <ActionIcon
                      variant="subtle"
                      onClick={() => onDelete(item.id)}
                      c={colors.faint}
                      aria-label="Delete wish"
                    >
                      <span style={{ fontSize: 18, lineHeight: 1 }}>×</span>
                    </ActionIcon>
                  </Group>
                </Paper>
              )
            })}
          </Box>
        )}
      </Box>
    </Box>
  )
}
