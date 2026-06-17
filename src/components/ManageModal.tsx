import { useState, type CSSProperties } from 'react'
import type { Activity, Category } from '../types'
import { ACCENT, colors, fonts, palette, swatchFor } from '../theme'
import { Overlay } from './EntryModal'

interface ManageModalProps {
  categories: Category[]
  activities: Activity[]
  onAddActivity: (categoryId: string, name: string) => void
  onDeleteActivity: (id: string) => void
  onAddCategory: (name: string, colorIndex: number) => void
  onDeleteCategory: (id: string) => void
  onClose: () => void
}

export function ManageModal({
  categories,
  activities,
  onAddActivity,
  onDeleteActivity,
  onAddCategory,
  onDeleteCategory,
  onClose,
}: ManageModalProps) {
  // Per-category "add activity" text inputs, keyed by category id.
  const [activityDrafts, setActivityDrafts] = useState<Record<string, string>>({})
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState(3)

  const submitActivity = (categoryId: string) => {
    onAddActivity(categoryId, activityDrafts[categoryId] ?? '')
    setActivityDrafts((prev) => ({ ...prev, [categoryId]: '' }))
  }

  const submitCategory = () => {
    if (!newCatName.trim()) return
    onAddCategory(newCatName, newCatColor)
    setNewCatName('')
    setNewCatColor((prev) => (prev + 1) % palette.length)
  }

  return (
    <Overlay onClose={onClose} width={520}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <h3 style={{ fontFamily: fonts.serif, fontWeight: 500, fontSize: 28, margin: 0 }}>
          Categories &amp; activities
        </h3>
        <button
          onClick={onClose}
          style={{
            fontFamily: fonts.sans,
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            background: ACCENT,
            border: 'none',
            padding: '8px 16px',
            borderRadius: 9,
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>

      {categories.map((category) => {
        const swatch = swatchFor(category.colorIndex)
        const catActivities = activities.filter((a) => a.categoryId === category.id)
        return (
          <div
            key={category.id}
            style={{
              background: '#fff',
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 14,
              padding: '16px 18px',
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <span
                style={{ width: 11, height: 11, borderRadius: '50%', background: swatch.color, flexShrink: 0 }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: swatch.ink,
                }}
              >
                {category.name}
              </span>
              <button
                onClick={() => onDeleteCategory(category.id)}
                style={{
                  marginLeft: 'auto',
                  fontFamily: fonts.sans,
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.faint,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Remove category
              </button>
            </div>

            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
              {catActivities.map((activity) => (
                <span
                  key={activity.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    background: colors.chip,
                    color: '#5c574e',
                    padding: '5px 6px 5px 12px',
                    borderRadius: 20,
                  }}
                >
                  {activity.name}
                  <button
                    onClick={() => onDeleteActivity(activity.id)}
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 14,
                      lineHeight: 1,
                      color: '#b3ada3',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0 2px',
                    }}
                    aria-label={`Remove ${activity.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={activityDrafts[category.id] ?? ''}
                onChange={(e) =>
                  setActivityDrafts((prev) => ({ ...prev, [category.id]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitActivity(category.id)
                }}
                placeholder="Add an activity…"
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  border: '1px solid rgba(120,100,80,0.25)',
                  borderRadius: 9,
                  fontSize: 13,
                  fontFamily: fonts.sans,
                  color: colors.ink,
                  background: '#fff',
                }}
              />
              <button
                onClick={() => submitActivity(category.id)}
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#5c574e',
                  background: colors.chip,
                  border: '1px solid rgba(120,100,80,0.18)',
                  padding: '9px 16px',
                  borderRadius: 9,
                  cursor: 'pointer',
                }}
              >
                Add
              </button>
            </div>
          </div>
        )
      })}

      <div
        style={{
          background: 'oklch(0.96 0.018 78)',
          border: '1px dashed rgba(120,100,80,0.3)',
          borderRadius: 14,
          padding: '16px 18px',
          marginTop: 18,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: colors.muted,
            marginBottom: 11,
          }}
        >
          New category
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 13 }}>
          <input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCategory()
            }}
            placeholder="e.g. Date nights"
            style={{
              flex: 1,
              padding: '9px 12px',
              border: '1px solid rgba(120,100,80,0.25)',
              borderRadius: 9,
              fontSize: 13,
              fontFamily: fonts.sans,
              color: colors.ink,
              background: '#fff',
            }}
          />
          <button onClick={submitCategory} style={createButton}>
            Create
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 11,
              color: colors.muted,
              fontFamily: fonts.mono,
              letterSpacing: '0.06em',
            }}
          >
            COLOR
          </span>
          {palette.map((swatch, index) => (
            <span
              key={index}
              onClick={() => setNewCatColor(index)}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                cursor: 'pointer',
                background: swatch.color,
                border: `3px solid ${newCatColor === index ? colors.ink : 'transparent'}`,
              }}
            />
          ))}
        </div>
      </div>
    </Overlay>
  )
}

const createButton: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 13,
  fontWeight: 600,
  color: '#fff',
  background: ACCENT,
  border: 'none',
  padding: '9px 18px',
  borderRadius: 9,
  cursor: 'pointer',
}
