import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button, PasswordInput, Stack, Text } from '@mantine/core'
import { DANGER, text } from '../theme'
import { ModalFooter } from './ModalFooter'

export const MIN_PASSWORD_LENGTH = 8

/**
 * New password + confirm, shared by the set-password link screen and the
 * account menu's "Change password" modal. Checks length and the match itself
 * (inline, on submit) and hands the password to `onSubmit`, which resolves to
 * an error message to show under the fields, or null on success.
 *
 * Without `onCancel` it ends in one full-width button (the standalone card);
 * with it, the house `ModalFooter` (Cancel + primary). Enter submits either way.
 */
export function PasswordForm({
  submitLabel,
  onSubmit,
  onCancel,
}: {
  submitLabel: string
  onSubmit: (password: string) => Promise<string | null>
  onCancel?: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [tooShort, setTooShort] = useState(false)
  const [mismatch, setMismatch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    const short = password.length < MIN_PASSWORD_LENGTH
    const differ = !short && password !== confirm
    setTooShort(short)
    setMismatch(differ)
    setError(null)
    if (short || differ) return
    setBusy(true)
    try {
      setError(await onSubmit(password))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit()
  }

  return (
    <form onSubmit={onFormSubmit} noValidate>
      <Stack gap={16}>
        <PasswordInput
          label="New password"
          description={`At least ${MIN_PASSWORD_LENGTH} characters`}
          autoComplete="new-password"
          data-autofocus
          value={password}
          error={tooShort ? `Use at least ${MIN_PASSWORD_LENGTH} characters` : undefined}
          onChange={(e) => {
            setPassword(e.currentTarget.value)
            setTooShort(false)
            setMismatch(false)
          }}
        />
        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          error={mismatch ? 'The passwords don’t match' : undefined}
          onChange={(e) => {
            setConfirm(e.currentTarget.value)
            setMismatch(false)
          }}
        />

        {error && (
          <Text fz={text.small} c={DANGER} role="alert">
            {error}
          </Text>
        )}

        {!onCancel && (
          <Button type="submit" loading={busy} fullWidth>
            {submitLabel}
          </Button>
        )}
      </Stack>
      {onCancel && (
        // Outside the Stack so the footer keeps its own top margin. A hidden
        // submit keeps Enter working; the footer's button is a click handler.
        <>
          <button type="submit" hidden />
          <ModalFooter onCancel={onCancel} onConfirm={() => void submit()} confirmLabel={submitLabel} loading={busy} />
        </>
      )}
    </form>
  )
}
