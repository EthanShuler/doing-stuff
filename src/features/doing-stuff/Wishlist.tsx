import { useState } from 'react'
import { ActionIcon, Box, Checkbox, Group, Paper, Text, TextInput } from '@mantine/core'
import type { WishlistItem } from '../../types'
import { ACCENT, colors, fonts } from '../../theme'
import { EmptyCard } from '../../components/EmptyCard'

interface WishlistProps {
  items: WishlistItem[]
  /** Check off an open item — opens the prefilled entry modal. */
  onCheck: (item: WishlistItem) => void
  /** Reopen a done item (clears its entry link). */
  onUncheck: (id: string) => void
  /** Resolves false when the write failed, so the input keeps the text. */
  onAdd: (text: string) => Promise<boolean>
  onEdit: (id: string, text: string) => void
  /** Set (or clear, when empty) the place for a wish; geocodes for a map pin. */
  onSetAddress: (id: string, address: string) => void
  onDelete: (id: string) => void
}

export function Wishlist({
  items,
  onCheck,
  onUncheck,
  onAdd,
  onEdit,
  onSetAddress,
  onDelete,
}: WishlistProps) {
  const [addText, setAddText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  // The wish whose inline address field is open, and its working text.
  const [locationId, setLocationId] = useState<string | null>(null)
  const [locationText, setLocationText] = useState('')

  const submitAdd = async () => {
    const trimmed = addText.trim()
    if (!trimmed) return
    // Clear right away (so Enter-Enter can't double-add), but put the text
    // back if the write fails — no retyping a lost wish from memory.
    setAddText('')
    const ok = await onAdd(trimmed)
    if (!ok) setAddText((current) => current || trimmed)
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

  // 📍 toggles the address field for a wish; opening seeds it with the current
  // value so editing/clearing works in place.
  const toggleLocation = (item: WishlistItem) => {
    if (locationId === item.id) {
      setLocationId(null)
      return
    }
    setLocationId(item.id)
    setLocationText(item.address)
  }

  const commitLocation = (item: WishlistItem) => {
    const trimmed = locationText.trim()
    if (trimmed !== item.address.trim()) onSetAddress(item.id, trimmed)
    setLocationId(null)
  }

  return (
    <>
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
        <EmptyCard
          title="No wishes yet"
          blurb="Add something you'd like to do together. Check it off and it becomes a logged entry."
        />
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
                    <Box flex={1}>
                      <Text
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
                      {!done && item.address && locationId !== item.id && (
                        <Text fz={12} c={colors.muted} mt={2}>
                          📍 {item.address}
                        </Text>
                      )}
                    </Box>
                  )}
                  {!done && (
                    <ActionIcon
                      variant="subtle"
                      onClick={() => toggleLocation(item)}
                      c={item.address ? ACCENT : colors.faint}
                      aria-label={item.address ? 'Edit location' : 'Add location'}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>📍</span>
                    </ActionIcon>
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
                {!done && locationId === item.id && (
                  <TextInput
                    mt={12}
                    value={locationText}
                    onChange={(e) => setLocationText(e.currentTarget.value)}
                    onBlur={() => commitLocation(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitLocation(item)
                      if (e.key === 'Escape') setLocationId(null)
                    }}
                    autoFocus
                    placeholder="Address or place — leave empty to remove from map"
                    styles={{ input: { fontFamily: fonts.serif, fontSize: 15 } }}
                  />
                )}
              </Paper>
            )
          })}
        </Box>
      )}
    </>
  )
}
