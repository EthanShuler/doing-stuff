import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const DEFAULT_SPACE_NAME = 'Our city, together'

// Dedupe concurrent space creation for the same user. React 18 StrictMode mounts
// effects twice in dev; without this guard both runs see an empty membership and
// each insert a space, producing duplicate spaces. The map memoizes the in-flight
// creation so the second run reuses the first's promise instead of inserting again.
const creatingSpace = new Map<string, Promise<string>>()

async function resolveSpace(userId: string): Promise<string> {
  const client = supabase
  if (!client) throw new Error('Supabase not configured.')

  // RLS scopes this to spaces the user already belongs to.
  const { data: members, error: mErr } = await client
    .from('space_members')
    .select('space_id')
    .limit(1)
  if (mErr) throw mErr
  if (members && members.length > 0) return members[0].space_id

  // No space yet → create one, but only once per user. The get/set below has no
  // `await` between them, so the second StrictMode run reliably observes the
  // in-flight promise rather than starting its own insert.
  const existing = creatingSpace.get(userId)
  if (existing) return existing

  // We generate the id client-side and do NOT read the row back: the
  // `on_space_created` AFTER trigger that adds us as a member fires at statement
  // end, *after* a RETURNING select's RLS check would run — so `.select()` here
  // would spuriously return 0 rows. By the time this insert resolves the
  // membership is committed, so later space-scoped fetches pass RLS fine.
  const pending = (async () => {
    const id = crypto.randomUUID()
    const { error } = await client.from('spaces').insert({ id, name: DEFAULT_SPACE_NAME })
    if (error) throw error
    return id
  })()
  creatingSpace.set(userId, pending)
  pending.finally(() => creatingSpace.delete(userId))
  return pending
}

/**
 * Resolves the active space for the logged-in user.
 *
 * Sharing model (see CLAUDE.md): "Manual / SQL for now". On first login a user
 * has no membership, so we auto-create a space — the `on_space_created` trigger
 * adds them as its first member. To share one space between two logins, add the
 * second user to the first user's space by hand in the SQL editor:
 *
 *   insert into space_members (space_id, user_id) values ('<space>', '<uid>');
 *
 * After that, both logins resolve to the same `space_id` here.
 */
export function useSpace(session: Session | null) {
  const userId = session?.user.id ?? null
  const [spaceId, setSpaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !userId) {
      setLoading(false)
      return
    }
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const id = await resolveSpace(userId)
        if (!cancelled) setSpaceId(id)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your space.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  return { spaceId, loading, error }
}
