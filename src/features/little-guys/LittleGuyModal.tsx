import { useEffect, useRef, useState } from 'react'
import { Box, Button, FileButton, Group, Select, Textarea, TextInput, Title, UnstyledButton } from '@mantine/core'
import { colors, DANGER, fonts } from '../../theme'
import { ModalShell } from '../../components/ModalShell'
import type { LittleGuyDraft } from './useLittleGuyStore'
import type { Member } from './derive'
import { memberLabel, NO_OWNER } from './derive'
import { LittleGuyPhoto } from './LittleGuyGrid'

/** Add/edit a little guy. Only the name gates saving — a guy can be logged the
 *  day he arrives and given a personality later. */
export function LittleGuyModal({
  opened,
  draft,
  isEditing,
  members,
  onChange,
  onUpload,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  opened: boolean
  draft: LittleGuyDraft
  isEditing: boolean
  /** Space members, in join order — the owner options. */
  members: Member[]
  onChange: (patch: Partial<LittleGuyDraft>) => void
  /** Downscale + upload a picked photo; resolves to its URL (see useLittleGuyStore). */
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

  // A Select option can't carry null, so "nobody in particular" rides the
  // NO_OWNER sentinel and maps back to a null ownerId on the way out.
  const ownerOptions = [
    ...members.map((member) => ({ value: member.id, label: memberLabel(member) })),
    { value: NO_OWNER, label: 'Nobody in particular' },
  ]

  return (
    <ModalShell opened={opened} onClose={onClose} width={560}>
      <Title order={3} fz={28} mb={22}>
        {isEditing ? 'Edit little guy' : 'Add a little guy'}
      </Title>

      <Group gap={20} align="flex-start" wrap="nowrap">
        <Box flex={1}>
          <TextInput
            label="Name"
            value={draft.name}
            onChange={(e) => onChange({ name: e.currentTarget.value })}
            placeholder="e.g. Sleepy Steve"
            data-autofocus
            autoComplete="off"
            mb={18}
          />
          <Select
            label="Owner"
            value={draft.ownerId ?? NO_OWNER}
            onChange={(value) => onChange({ ownerId: value === NO_OWNER ? null : value })}
            data={ownerOptions}
            allowDeselect={false}
            mb={18}
          />
          <TextInput
            label="Source"
            value={draft.source}
            onChange={(e) => onChange({ source: e.currentTarget.value })}
            placeholder="who got him for you (optional)"
            autoComplete="off"
            mb={18}
          />
          <TextInput
            label="Personality"
            value={draft.personality}
            onChange={(e) => onChange({ personality: e.currentTarget.value })}
            placeholder="e.g. shy, a menace (optional)"
            autoComplete="off"
          />
        </Box>

        {/* Photo column: preview + upload. Keyed on the URL so a replacement
            retries a broken image. */}
        <Box w={150} style={{ flexShrink: 0 }}>
          <Box key={draft.imageUrl} mt={4} style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${colors.cardBorder}` }}>
            <LittleGuyPhoto imageUrl={draft.imageUrl} name={draft.name} height={150} />
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

      <Textarea
        label="Description"
        value={draft.description}
        onChange={(e) => onChange({ description: e.currentTarget.value })}
        placeholder="e.g. face-down on the desk, permanently (optional)"
        autosize
        minRows={3}
        mt={18}
        mb={6}
      />

      <Group justify="space-between" align="center" gap={10} mt={22}>
        {isEditing && (
          <UnstyledButton
            onClick={onDelete}
            style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: DANGER, padding: '8px 0' }}
          >
            Delete little guy
          </UnstyledButton>
        )}
        <Group gap={10} ml="auto">
          <Button variant="secondary" onClick={onClose} radius={10}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave || uploading} loading={saving} radius={10}>
            {isEditing ? 'Save changes' : 'Add little guy'}
          </Button>
        </Group>
      </Group>
    </ModalShell>
  )
}
