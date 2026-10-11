import { Text, TextInput } from '@mantine/core'
import { colors, fonts, text } from '../../theme'
import { ModalFooter } from '../../components/ModalFooter'
import { ModalShell } from '../../components/ModalShell'

/** Create, rename, or delete a chart. Only the title lives here — the squares
 *  are filled in on the chart itself. Presentational: the page owns the draft,
 *  the save, and the delete confirm. */
export function ChartModal({
  opened,
  title,
  isEditing,
  onChange,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  opened: boolean
  title: string
  isEditing: boolean
  onChange: (title: string) => void
  saving: boolean
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const canSave = Boolean(title.trim())

  return (
    <ModalShell opened={opened} onClose={onClose} title={isEditing ? 'Edit chart' : 'New alignment chart'} size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canSave) onSave()
        }}
      >
        <TextInput
          label="Title"
          value={title}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder="e.g. Sandwiches"
          data-autofocus
          mb={10}
        />
        <Text fz={text.caption} c={colors.faint} style={{ fontFamily: fonts.sans }}>
          {isEditing
            ? 'The nine squares stay as they are.'
            : 'The nine squares — Lawful Good through Chaotic Evil — start blank. Tap one on the chart to fill it in.'}
        </Text>

        <ModalFooter
          onCancel={onClose}
          onConfirm={onSave}
          confirmLabel={isEditing ? 'Save changes' : 'Create chart'}
          confirmDisabled={!canSave}
          loading={saving}
          onDelete={isEditing ? onDelete : undefined}
          deleteLabel="Delete chart"
        />
      </form>
    </ModalShell>
  )
}
