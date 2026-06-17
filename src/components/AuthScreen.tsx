import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { ACCENT, ACCENT_HOVER, colors, fonts } from '../theme'

type Mode = 'signin' | 'signup'

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
  boxSizing: 'border-box',
}

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      // On success, onAuthStateChange swaps the view — nothing else to do.
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else if (data.session) {
        // Email confirmation is off → already logged in; the listener takes over.
      } else {
        // Email confirmation is on → no session until they click the link.
        setNotice('Check your email for a confirmation link, then sign in.')
        setMode('signin')
      }
    }
    setBusy(false)
  }

  const switchMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
    setError(null)
    setNotice(null)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.pageBg,
        fontFamily: fonts.sans,
        color: colors.ink,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: ACCENT,
            marginBottom: 9,
            textAlign: 'center',
          }}
        >
          Our city, together
        </div>
        <h1
          style={{
            fontFamily: fonts.serif,
            fontWeight: 500,
            fontSize: 36,
            lineHeight: 1.05,
            margin: '0 0 6px',
            letterSpacing: '-0.01em',
            textAlign: 'center',
          }}
        >
          Doing Stuff
        </h1>
        <p style={{ color: colors.muted, fontSize: 14, textAlign: 'center', margin: '0 0 28px' }}>
          {mode === 'signin' ? 'Sign in to your shared log' : 'Create your account'}
        </p>

        <form
          onSubmit={submit}
          style={{
            background: '#fff',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 14,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div>
            <label style={labelStyle} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={fieldStyle}
            />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: 'oklch(0.5 0.16 25)' }}>{error}</div>
          )}
          {notice && (
            <div style={{ fontSize: 13, color: colors.ink }}>{notice}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              padding: '11px 12px',
              border: 'none',
              borderRadius: 9,
              background: busy ? ACCENT_HOVER : ACCENT,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: fonts.sans,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: colors.muted, marginTop: 18 }}>
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={switchMode}
            style={{
              border: 'none',
              background: 'none',
              color: ACCENT,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
