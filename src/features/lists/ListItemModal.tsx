import { Box, Group, Text, TextInput } from '@mantine/core'
import { colors, fonts, text } from '../../theme'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'
import { TitleSearchInput, canSearch } from '../../components/TitleSearchInput'
import type { ListCopy } from './copy'
import { parseReleaseYear } from '../../lib/releaseYear'

/** The draft backing the edit-row modal. Adding happens inline on the page
 *  (the quick-add field), so this modal only ever edits. */
export interface ListItemDraft {
  title: string
  /** Poster/cover URL — only shown for lists that carry an image. */
  imageUrl: string
  /** Author/director, or a free-text note on a free-form list. */
  creator: string
  /** Release year as typed ('' = unknown) — media lists only; parsed on save. */
  releaseYear: string
}

export function ListItemModal({
  opened,
  copy,
  draft,
  onChange,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  opened: boolean
  /** The list's wording (LIST_COPY for a built-in, customListCopy otherwise). */
  copy: ListCopy
  draft: ListItemDraft
  onChange: (patch: Partial<ListItemDraft>) => void
  saving: boolean
  onSave: () => void
  /** The page confirms before it removes the row. */
  onDelete: () => void
  onClose: () => void
}) {
  const yearInvalid = copy.hasYear && parseReleaseYear(draft.releaseYear) === undefined
  const canSave = Boolean(draft.title.trim()) && !yearInvalid

  return (
    <ModalShell opened={opened} onClose={onClose} title={`Edit ${copy.noun}`} size="sm">
      <Box mb={18}>
        <TitleSearchInput
          searchKind={copy.searchKind}
          value={draft.title}
          onChange={(title) => onChange({ title })}
          // Only overwrite the creator when the provider knows one, so a TMDB
          // pick doesn't blank a hand-typed director.
          onPick={(result) =>
            onChange({
              title: result.title,
              ...(copy.hasImage ? { imageUrl: result.imageUrl } : {}),
              ...(result.creator ? { creator: result.creator } : {}),
              ...(copy.hasYear && result.releaseYear ? { releaseYear: String(result.releaseYear) } : {}),
            })
          }
          label="Title"
          placeholder={copy.example ? `e.g. ${copy.example}` : `Name of the ${copy.noun}`}
          autoFocus
          emoji={copy.emoji}
        />
      </Box>
      {copy.hasImage && (
        <TextInput
          label={copy.imageLabel}
          value={draft.imageUrl}
          onChange={(e) => onChange({ imageUrl: e.currentTarget.value })}
          placeholder="Paste an image link (optional)"
          mb={18}
        />
      )}
      <Group gap={12} align="flex-start" wrap="nowrap" mb={10}>
        <TextInput
          label={copy.creatorLabel}
          value={draft.creator}
          onChange={(e) => onChange({ creator: e.currentTarget.value })}
          placeholder="Optional"
          flex={1}
        />
        {copy.hasYear && (
          <TextInput
            label="Year"
            value={draft.releaseYear}
            onChange={(e) => onChange({ releaseYear: e.currentTarget.value })}
            placeholder="e.g. 2019"
            inputMode="numeric"
            maxLength={4}
            error={yearInvalid ? 'A 4-digit year' : undefined}
            w={104}
          />
        )}
      </Group>
      <Text fz={text.caption} c={colors.faint} style={{ fontFamily: fonts.sans }}>
        {copy.hint}
        {canSearch(copy.searchKind) && ` ${copy.attribution}`}
      </Text>

      <ModalFooter
        onCancel={onClose}
        onConfirm={onSave}
        confirmLabel="Save changes"
        confirmDisabled={!canSave}
        loading={saving}
        onDelete={onDelete}
        deleteLabel={`Remove from ${copy.label}`}
      />
    </ModalShell>
  )
}
