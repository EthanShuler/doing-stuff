import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const DEFAULT_SPACE_NAME = 'Our city, together'

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
        // RLS scopes this to spaces the user already belongs to.
        const { data: members, error: mErr } = await supabase
          .from('space_members')
          .select('space_id')
          .limit(1)
        if (mErr) throw mErr

        if (members && members.length > 0) {
          if (!cancelled) setSpaceId(members[0].space_id)
          return
        }

        // No space yet → create one. We generate the id client-side and do NOT
        // read the row back: the `on_space_created` AFTER trigger that adds us as
        // a member fires at statement end, *after* a RETURNING select's RLS check
        // would run — so `.select()` here would spuriously return 0 rows. By the
        // time this insert resolves the membership is committed, so the later
        // data fetches (scoped to this id) pass RLS fine.
        const id = crypto.randomUUID()
        const { error: cErr } = await supabase
          .from('spaces')
          .insert({ id, name: DEFAULT_SPACE_NAME })
        if (cErr) throw cErr
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
