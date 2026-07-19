import { useEffect, useRef, useState } from 'react'
import { Box, Button, FileButton, Group, Text, Textarea, TextInput, Title, UnstyledButton } from '@mantine/core'
import { colors, DANGER, fonts } from '../../theme'
import { ModalShell } from '../../components/ModalShell'
import type { SpoonDraft } from './useSpoonStore'
import { SpoonPhoto } from './SpoonGrid'

export function SpoonModal({
  opened,
  draft,
  isEditing,
  onChange,
  onUpload,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  opened: boolean
  draft: SpoonDraft
  isEditing: boolean
  onChange: (patch: Partial<SpoonDraft>) => void
  /** Downscale + upload a picked photo; resolves to its URL (see useSpoonStore). */
  onUpload: (file: File) => Promise<string>
  saving: boolean
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const canSave = Boolean(draft.name.trim())
  const [uploading, setUploading] = useState(false)
  // A slow upload must not land in a different session's draft (edit A, pick a
  // photo, cancel, open B): bump the token on every open/close and drop
  // resolutions that started under a stale one.
  const uploadSession = useRef(0)
  useEffect(() => {
    uploadSession.current += 1
    setUploading(false)
  }, [opened])

  const pickPhoto = async (file: File | null) => {
    if (!file) return
    const session = uploadSession.current
    setUploading(true)
    try {
      const imageUrl = await onUpload(file)
      if (session === uploadSession.current) onChange({ imageUrl })
    } catch {
      // Upload failed — store.error shows the reason; the draft keeps its old image.
    } finally {
      if (session === uploadSession.current) setUploading(false)
    }
  }

  return (
    <ModalShell opened={opened} onClose={onClose} width={520}>
      <Title order={3} fz={28} mb={22}>
        {isEditing ? 'Edit spoon' : 'Add a spoon'}
      </Title>

      <Group gap={20} align="flex-start" wrap="nowrap">
        <Box flex={1}>
          <TextInput
            label="Name"
            value={draft.name}
            onChange={(e) => onChange({ name: e.currentTarget.value })}
            placeholder="e.g. Eiffel Tower"
            data-autofocus
            autoComplete="off"
            mb={18}
          />
          <TextInput
            label="Where it's from"
            value={draft.place}
            onChange={(e) => onChange({ place: e.currentTarget.value })}
            placeholder="e.g. Paris, France (optional)"
            autoComplete="off"
            mb={18}
          />
          <TextInput
            label="Date acquired"
            type="date"
            value={draft.acquiredOn}
            onChange={(e) => onChange({ acquiredOn: e.currentTarget.value })}
            mb={18}
          />
          <Textarea
            label="The story"
            value={draft.notes}
            onChange={(e) => onChange({ notes: e.currentTarget.value })}
            placeholder="e.g. from the honeymoon (optional)"
            autosize
            minRows={2}
            mb={6}
          />
          <Text fz={12} c={colors.faint} style={{ fontFamily: fonts.sans }}>
            The place is looked up on save to pin the spoon on the map — a city is plenty.
          </Text>
        </Box>

        {/* Photo column: preview + upload. Keyed on the URL so a replacement
            retries a broken image. */}
        <Box w={150} style={{ flexShrink: 0 }}>
          <Box key={draft.imageUrl} mt={4} style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${colors.cardBorder}` }}>
            <SpoonPhoto imageUrl={draft.imageUrl} name={draft.name} height={150} />
          </Box>
          <FileButton onChange={(file) => void pickPhoto(file)} accept="image/*">
            {(props) => (
              <Button {...props} variant="secondary" size="compact-sm" radius={8} mt={10} fullWidth loading={uploading}>
                {draft.imageUrl ? 'Replace photo' : 'Upload photo'}
              </Button>
            )}
          </FileButton>
          {draft.imageUrl && (
            <UnstyledButton
              onClick={() => onChange({ imageUrl: '' })}
              w="100%"
              mt={6}
              style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: 600, color: colors.muted, textAlign: 'center' }}
            >
              Remove photo
            </UnstyledButton>
          )}
        </Box>
      </Group>

      <Group justify="space-between" align="center" gap={10} mt={26}>
        {isEditing && (
          <UnstyledButton
            onClick={onDelete}
            style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: DANGER, padding: '8px 0' }}
          >
            Delete spoon
          </UnstyledButton>
        )}
        <Group gap={10} ml="auto">
          <Button variant="secondary" onClick={onClose} radius={10}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave || uploading} loading={saving} radius={10}>
            {isEditing ? 'Save changes' : 'Add spoon'}
          </Button>
        </Group>
      </Group>
    </ModalShell>
  )
}
