import { Button, Group, UnstyledButton } from '@mantine/core'
import { DANGER, fonts, text } from '../theme'

/** The action row every add/edit modal ends with: an optional destructive
 *  link pinned left, Cancel + the primary action right. Passing `onDelete`
 *  is what makes the left link appear (edit modals only). */
export function ModalFooter({
  onCancel,
  cancelLabel = 'Cancel',
  onConfirm,
  confirmLabel,
  confirmDisabled,
  loading,
  onDelete,
  deleteLabel,
}: {
  onCancel: () => void
  cancelLabel?: string
  onConfirm: () => void
  confirmLabel: string
  confirmDisabled?: boolean
  loading?: boolean
  onDelete?: () => void
  deleteLabel?: string
}) {
  return (
    <Group justify="space-between" align="center" gap={10} mt={22}>
      {onDelete && (
        <UnstyledButton
          onClick={onDelete}
          style={{ fontFamily: fonts.sans, fontSize: text.small, fontWeight: 600, color: DANGER, padding: '8px 0' }}
        >
          {deleteLabel}
        </UnstyledButton>
      )}
      <Group gap={10} ml="auto">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} disabled={confirmDisabled} loading={loading}>
          {confirmLabel}
        </Button>
      </Group>
    </Group>
  )
}
