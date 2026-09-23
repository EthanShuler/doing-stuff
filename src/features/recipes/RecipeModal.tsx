import { useEffect, useRef, useState } from 'react'
import { Box, Button, FileButton, Group, TagsInput, Textarea, TextInput, UnstyledButton } from '@mantine/core'
import { colors, fonts, radii, text } from '../../theme'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'
import type { RecipeDraft } from './useRecipeStore'
import { RecipePhoto } from './RecipeGrid'

/** Add/edit a recipe. Only the title gates saving — everything else is
 *  optional, so a half-remembered recipe can be captured and finished later. */
export function RecipeModal({
  opened,
  draft,
  isEditing,
  tagSuggestions,
  onChange,
  onUpload,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  opened: boolean
  draft: RecipeDraft
  isEditing: boolean
  /** Tags already in use — TagsInput suggestions so spellings converge. */
  tagSuggestions: string[]
  onChange: (patch: Partial<RecipeDraft>) => void
  /** Downscale + upload a picked photo; resolves to its URL, or null
   *  when the modal closed mid-upload (see src/lib/photoSession.ts). */
  onUpload: (file: File) => Promise<string | null>
  saving: boolean
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const canSave = Boolean(draft.title.trim())
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
      if (imageUrl && session === uploadSession.current) onChange({ imageUrl })
    } catch {
      // Upload failed — store.error shows the reason; the draft keeps its old image.
    } finally {
      if (session === uploadSession.current) setUploading(false)
    }
  }

  return (
    <ModalShell opened={opened} onClose={onClose} size="xl" title={isEditing ? 'Edit recipe' : 'Add a recipe'}>
      <Group gap={20} align="flex-start" wrap="nowrap">
        <Box flex={1}>
          <TextInput
            label="Title"
            value={draft.title}
            onChange={(e) => onChange({ title: e.currentTarget.value })}
            placeholder="e.g. Weeknight shakshuka"
            data-autofocus
            autoComplete="off"
            mb={18}
          />
          <Group gap={12} grow mb={18}>
            <TextInput
              label="Serves"
              value={draft.servings}
              onChange={(e) => onChange({ servings: e.currentTarget.value })}
              placeholder="e.g. 4 (optional)"
              autoComplete="off"
            />
            <TextInput
              label="Total time"
              value={draft.totalTime}
              onChange={(e) => onChange({ totalTime: e.currentTarget.value })}
              placeholder="e.g. 45 min (optional)"
              autoComplete="off"
            />
          </Group>
          <TagsInput
            label="Tags"
            value={draft.tags}
            onChange={(tags) => onChange({ tags })}
            data={tagSuggestions}
            placeholder={draft.tags.length === 0 ? 'e.g. dinner, soup (optional)' : undefined}
            mb={4}
          />
        </Box>

        {/* Photo column: preview + upload. Keyed on the URL so a replacement
            retries a broken image. */}
        <Box w={150} style={{ flexShrink: 0 }}>
          <Box key={draft.imageUrl} mt={4} style={{ borderRadius: radii.card, overflow: 'hidden', border: `1px solid ${colors.cardBorder}` }}>
            <RecipePhoto imageUrl={draft.imageUrl} title={draft.title} height={150} />
          </Box>
          <FileButton onChange={(file) => void pickPhoto(file)} accept="image/*">
            {(props) => (
              <Button {...props} variant="secondary" size="compact-sm" radius={8} mt={10} fullWidth loading={uploading} disabled={saving}>
                {draft.imageUrl ? 'Replace photo' : 'Upload photo'}
              </Button>
            )}
          </FileButton>
          {draft.imageUrl && (
            <UnstyledButton
              onClick={() => onChange({ imageUrl: '' })}
              disabled={saving}
              w="100%"
              mt={6}
              style={{ fontFamily: fonts.sans, fontSize: text.caption, fontWeight: 600, color: colors.muted, textAlign: 'center' }}
            >
              Remove photo
            </UnstyledButton>
          )}
        </Box>
      </Group>

      <Textarea
        label="Ingredients"
        value={draft.ingredients}
        onChange={(e) => onChange({ ingredients: e.currentTarget.value })}
        placeholder={'One per line:\n2 cups flour\n1 tsp salt'}
        autosize
        minRows={4}
        maxRows={12}
        mt={14}
        mb={18}
      />
      <Textarea
        label="Steps"
        value={draft.steps}
        onChange={(e) => onChange({ steps: e.currentTarget.value })}
        placeholder={'Write it out naturally — a blank line starts a new step:\n\nSoften the onion in olive oil.\n\nAdd the tomatoes and simmer.'}
        autosize
        minRows={5}
        maxRows={16}
        mb={18}
      />
      <Group gap={12} grow mb={18}>
        <TextInput
          label="Source"
          value={draft.source}
          onChange={(e) => onChange({ source: e.currentTarget.value })}
          placeholder="e.g. Grandma Ruth (optional)"
          autoComplete="off"
        />
        <TextInput
          label="Source link"
          value={draft.sourceUrl}
          onChange={(e) => onChange({ sourceUrl: e.currentTarget.value })}
          placeholder="https://… (optional)"
          autoComplete="off"
        />
      </Group>
      <Textarea
        label="Our notes"
        value={draft.notes}
        onChange={(e) => onChange({ notes: e.currentTarget.value })}
        placeholder="e.g. double the garlic next time (optional)"
        autosize
        minRows={2}
        mb={6}
      />

      <ModalFooter
        onCancel={onClose}
        onConfirm={onSave}
        confirmLabel={isEditing ? 'Save changes' : 'Add recipe'}
        confirmDisabled={!canSave || uploading}
        loading={saving}
        onDelete={isEditing ? onDelete : undefined}
        deleteLabel="Delete recipe"
      />
    </ModalShell>
  )
}
