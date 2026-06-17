import type { CSSProperties } from 'react'
import type { Activity, Category, EntryDraft } from '../types'
import { ACCENT, colors, DANGER, fonts } from '../theme'

interface EntryModalProps {
  draft: EntryDraft
  isEditing: boolean
  categories: Category[]
  activities: Activity[]
  onChange: (patch: Partial<EntryDraft>) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: colors.muted,
  margin: '0 0 7px',
}

const fieldStyle: CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  border: '1px solid rgba(120,100,80,0.25)',
  borderRadius: 9,
  fontSize: 14,
  fontFamily: fonts.sans,
  color: colors.ink,
  background: '#fff',
}

export function EntryModal({
  draft,
  isEditing,
  categories,
  activities,
  onChange,
  onSave,
  onDelete,
  onClose,
}: EntryModalProps) {
  const activityChoices = activities.filter((a) => a.categoryId === draft.categoryId)
  const hasCategory = Boolean(draft.categoryId)
  const activityDisabled = !hasCategory
  const showNoActivityMsg = hasCategory && activityChoices.length === 0
  const activityPlaceholder = !hasCategory
    ? 'Pick a category first'
    : activityChoices.length === 0
      ? 'No activities yet'
      : 'Choose an activity…'

  const canSave = Boolean(draft.activityId) && draft.rating > 0

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ fontFamily: fonts.serif, fontWeight: 500, fontSize: 28, margin: '0 0 22px' }}>
        {isEditing ? 'Edit entry' : 'New entry'}
      </h3>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Category</label>
          <select
            value={draft.categoryId}
            onChange={(e) => onChange({ categoryId: e.target.value, activityId: '' })}
            style={{ ...fieldStyle, cursor: 'pointer' }}
          >
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Activity</label>
          <select
            value={draft.activityId}
            onChange={(e) => onChange({ activityId: e.target.value })}
            disabled={activityDisabled}
            style={{
              ...fieldStyle,
              cursor: activityDisabled ? 'not-allowed' : 'pointer',
              background: activityDisabled ? colors.chip : '#fff',
              color: activityDisabled ? '#b3ada3' : colors.ink,
            }}
          >
            <option value="">{activityPlaceholder}</option>
            {activityChoices.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showNoActivityMsg && (
        <div
          style={{
            fontSize: 13,
            color: colors.muted,
            fontStyle: 'italic',
            fontFamily: fonts.serif,
            margin: '-8px 0 18px',
          }}
        >
          No activities in this category yet — add some under <strong>Manage</strong>.
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Title</label>
        <input
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Give this outing a name…"
          style={fieldStyle}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Date</label>
        <input
          type="date"
          value={draft.date}
          onChange={(e) => onChange({ date: e.target.value })}
          style={fieldStyle}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>How was it?</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3, 4, 5].map((value) => (
            <span
              key={value}
              onClick={() => onChange({ rating: value })}
              style={{
                fontSize: 32,
                lineHeight: 1,
                cursor: 'pointer',
                color: value <= draft.rating ? ACCENT : colors.starEmpty,
              }}
            >
              ★
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Notes</label>
        <textarea
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What did you two do? How did it go?"
          style={{
            ...fieldStyle,
            minHeight: 80,
            fontFamily: fonts.serif,
            resize: 'vertical',
            lineHeight: 1.5,
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        {isEditing && (
          <button
            onClick={onDelete}
            style={{
              fontFamily: fonts.sans,
              fontSize: 13,
              fontWeight: 600,
              color: DANGER,
              background: 'none',
              border: 'none',
              padding: '8px 0',
              cursor: 'pointer',
            }}
          >
            Delete entry
          </button>
        )}
        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
          <button onClick={onClose} style={secondaryButton}>
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!canSave}
            style={{ ...primaryButton, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}
          >
            {isEditing ? 'Save changes' : 'Add entry'}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

const primaryButton: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 14,
  fontWeight: 600,
  color: '#fff',
  background: ACCENT,
  border: 'none',
  padding: '10px 20px',
  borderRadius: 10,
  cursor: 'pointer',
}

const secondaryButton: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 14,
  fontWeight: 600,
  color: '#5c574e',
  background: 'transparent',
  border: '1px solid rgba(120,100,80,0.3)',
  padding: '10px 18px',
  borderRadius: 10,
  cursor: 'pointer',
}

/** Shared modal shell: dim backdrop + centered card, click-outside to close. */
export function Overlay({ children, onClose, width = 460 }: { children: React.ReactNode; onClose: () => void; width?: number }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(45,38,30,0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: '100%',
          maxHeight: '88vh',
          overflow: 'auto',
          background: 'oklch(0.985 0.01 78)',
          borderRadius: 18,
          padding: 30,
          boxShadow: '0 24px 60px rgba(40,30,20,0.3)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
