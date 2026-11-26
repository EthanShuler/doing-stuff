import { useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { SEED_MEMBERS, SEED_SPACES } from '../../data/seedSpaces'
import { useSpaceContext } from '../../data/useSpace'
import { type AdminSpace, type AdminUser, mergeMembership } from './derive'
import { SEED_ACCOUNTS, seedPruneSpaceNames, seedSetSpaceName, seedSetUserSpaces, seedSnapshot } from './seed'

/** What creating an account hands back: the new id, and the one-time
 *  set-password token — null when the account was made but the link wasn't
 *  (`linkError` says why; "Copy set-password link" on their row retries). */
export interface CreatedAccount {
  userId: string
  email: string
  tokenHash: string | null
  linkError: string | null
}

export interface AdminStore {
  users: AdminUser[]
  spaces: AdminSpace[]
  /** True only until the first load settles (always false in seed mode). */
  loading: boolean
  error: string | null
  clearError: () => void
  refresh: () => Promise<void>
  /** Creates the login, then puts it in `spaceIds`. Throws only if the
   *  account itself wasn't created; a failed membership step is reported in
   *  `error` and the account is still returned (it exists either way). */
  createAccount: (email: string, displayName: string, spaceIds: string[]) => Promise<CreatedAccount>
  /** A fresh one-time set-password token for an existing login. */
  passwordLink: (userId: string) => Promise<string>
  /** Create (`spaceId` null) or update a space. `baselineMemberIds` is the
   *  membership the form opened with — only the form's own changes are
   *  applied on top of what the database holds now. Resolves to the id. */
  saveSpace: (input: {
    spaceId: string | null
    name: string
    features: string[] | null
    memberIds: string[]
    baselineMemberIds: string[]
  }) => Promise<string>
  /** Set one person's spaces; `baseline` as for saveSpace. */
  setUserSpaces: (userId: string, spaceIds: string[], baseline: string[]) => Promise<void>
  setDisplayName: (userId: string, name: string) => Promise<void>
  /** What one person goes by in each given space ('' = their display name
   *  again). They must already be in those spaces. */
  setSpaceNames: (userId: string, changes: { spaceId: string; name: string }[]) => Promise<void>
}

type Snapshot = { users: AdminUser[]; spaces: AdminSpace[] }

/** A readable message from a PostgREST / Auth / thrown error. */
const messageOf = (err: unknown): string =>
  err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message
    ? err.message
    : 'Something went wrong.'

async function fetchSnapshot(): Promise<Snapshot> {
  const client = supabase
  if (!client) throw new Error('Supabase not configured.')
  const [users, spaces, names] = await Promise.all([
    client.rpc('admin_list_users'),
    client.rpc('admin_list_spaces'),
    client.rpc('admin_list_space_names'),
  ])
  if (users.error) throw users.error
  if (spaces.error) throw spaces.error
  if (names.error) throw names.error
  const namesByUser = new Map<string, Record<string, string>>()
  for (const n of names.data ?? []) {
    namesByUser.set(n.user_id, { ...namesByUser.get(n.user_id), [n.space_id]: n.display_name })
  }
  return {
    users: (users.data ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      lastSignInAt: r.last_sign_in_at,
      hasPassword: r.has_password,
      isAdmin: r.is_admin_user,
      spaceIds: r.space_ids ?? [],
      spaceNames: namesByUser.get(r.id) ?? {},
    })),
    spaces: (spaces.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      enabledFeatures: r.enabled_features,
      memberIds: r.member_ids ?? [],
    })),
  }
}

/** Calls the `admin` Edge Function (the only service-role code). A non-2xx
 *  carries its reason as `{ error }` in the response body. */
async function invokeAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const client = supabase
  if (!client) throw new Error('Supabase not configured.')
  const { data, error } = await client.functions.invoke('admin', { body })
  if (error) {
    if (error instanceof FunctionsHttpError && error.context instanceof Response) {
      const payload: unknown = await error.context.json().catch(() => null)
      if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
        throw new Error(payload.error)
      }
    }
    // FunctionsFetchError / FunctionsRelayError: the function never answered.
    throw new Error(messageOf(error))
  }
  return data as T
}

/**
 * The admin page's data seam: every login and every space, plus the admin
 * actions. Live mode calls the `admin_*` RPCs and the `admin` Edge
 * Function; keyless seed mode edits in-memory accounts and SEED_SPACES /
 * SEED_MEMBERS in place.
 *
 * No realtime: one admin, rarely two tabs. Instead, every save re-reads the
 * snapshot first and applies only the form's own membership changes to it
 * (`mergeMembership`) — the RPCs set membership to EXACTLY the list passed,
 * so a stale tab would otherwise undo changes made elsewhere. After a save it
 * re-reads again, and reloads the space context so the admin's own nav and
 * switcher follow (e.g. a feature turned on in the space they're in).
 *
 * Actions record `error` and throw on failure, so a modal can stay open.
 */
export function useAdminStore(): AdminStore {
  const live = Boolean(supabase)
  const { reload } = useSpaceContext()
  const [snapshot, setSnapshot] = useState<Snapshot>(() => (live ? { users: [], spaces: [] } : seedSnapshot()))
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!live) return
    let cancelled = false
    fetchSnapshot()
      .then(
        (next) => {
          if (!cancelled) setSnapshot(next)
        },
        (err: unknown) => {
          if (!cancelled) setError(messageOf(err))
        },
      )
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [live])

  /** The current truth (and show it). */
  const read = async (): Promise<Snapshot> => {
    const next = live ? await fetchSnapshot() : seedSnapshot()
    setSnapshot(next)
    return next
  }

  /** After a successful write: show it, and let the nav catch up. A failure
   *  here doesn't undo the save, so it's reported, not thrown. */
  const settle = async () => {
    try {
      await read()
      await reload()
    } catch (err) {
      setError(`Saved, but the page couldn't refresh: ${messageOf(err)}`)
    }
  }

  /** Run one write: clear the last error, record a new one and rethrow. */
  const write = async <T,>(action: () => Promise<T>): Promise<T> => {
    setError(null)
    try {
      return await action()
    } catch (err) {
      setError(messageOf(err))
      throw err
    }
  }

  const refresh = () =>
    write(async () => {
      await read()
    })

  const applyUserSpaces = async (userId: string, spaceIds: string[], baseline: string[]) => {
    const fresh = await read()
    const current = fresh.users.find((u) => u.id === userId)
    if (!current) throw new Error('That account no longer exists.')
    const ids = mergeMembership(current.spaceIds, baseline, spaceIds)
    if (!live) {
      seedSetUserSpaces(userId, ids)
      return
    }
    const { error: rpcError } = await supabase!.rpc('admin_set_user_spaces', { target_user: userId, space_ids: ids })
    if (rpcError) throw rpcError
  }

  const setUserSpaces = (userId: string, spaceIds: string[], baseline: string[]) =>
    write(async () => {
      await applyUserSpaces(userId, spaceIds, baseline)
      await settle()
    })

  const setDisplayName = (userId: string, name: string) =>
    write(async () => {
      if (!live) {
        const account = SEED_ACCOUNTS.find((a) => a.id === userId)
        if (!account) throw new Error('No such user.')
        account.displayName = name.trim() || null
      } else {
        const { error: rpcError } = await supabase!.rpc('admin_set_display_name', {
          target_user: userId,
          new_name: name,
        })
        if (rpcError) throw rpcError
      }
      await settle()
    })

  const setSpaceNames: AdminStore['setSpaceNames'] = (userId, changes) =>
    write(async () => {
      for (const { spaceId, name } of changes) {
        if (!live) {
          seedSetSpaceName(spaceId, userId, name)
        } else {
          const { error: rpcError } = await supabase!.rpc('admin_set_space_display_name', {
            target_space: spaceId,
            target_user: userId,
            new_name: name,
          })
          if (rpcError) throw rpcError
        }
      }
      await settle()
    })

  const saveSpace: AdminStore['saveSpace'] = ({ spaceId, name, features, memberIds, baselineMemberIds }) =>
    write(async () => {
      const fresh = await read()
      let members = memberIds
      if (spaceId) {
        const current = fresh.spaces.find((s) => s.id === spaceId)
        if (!current) throw new Error('That space no longer exists.')
        members = mergeMembership(current.memberIds, baselineMemberIds, memberIds)
      }
      // A person deleted since the form opened would fail the FK.
      members = members.filter((id) => fresh.users.some((u) => u.id === id))

      let id: string
      if (!live) {
        if (!name.trim()) throw new Error('A space needs a name.')
        const existing = spaceId ? SEED_SPACES.find((s) => s.id === spaceId) : undefined
        if (existing) {
          existing.name = name.trim()
          existing.enabledFeatures = features && [...features]
          id = existing.id
        } else {
          id = `seed-space-${SEED_SPACES.length + 1}`
          SEED_SPACES.push({ id, name: name.trim(), enabledFeatures: features && [...features] })
        }
        SEED_MEMBERS[id] = [...members]
        seedPruneSpaceNames()
      } else {
        const { data, error: rpcError } = await supabase!.rpc('admin_save_space', {
          target_space: spaceId,
          space_name: name,
          features,
          member_ids: members,
        })
        if (rpcError) throw rpcError
        id = data
      }
      await settle()
      return id
    })

  const createAccount = (email: string, displayName: string, spaceIds: string[]) =>
    write(async (): Promise<CreatedAccount> => {
      let created: CreatedAccount
      if (!live) {
        const address = email.trim().toLowerCase()
        if (SEED_ACCOUNTS.some((a) => a.email === address)) {
          throw new Error('A user with this email address has already been registered')
        }
        const n = SEED_ACCOUNTS.length + 1
        SEED_ACCOUNTS.push({
          id: `u${n}`,
          email: address,
          displayName: displayName.trim() || null,
          lastSignInAt: null,
          hasPassword: false,
          isAdmin: false,
        })
        created = { userId: `u${n}`, email: address, tokenHash: `seed-token-${n}`, linkError: null }
      } else {
        const res = await invokeAdmin<{ user_id: string; email: string; token_hash: string | null; link_error: string | null }>(
          { action: 'create_user', email: email.trim(), display_name: displayName.trim() },
        )
        created = { userId: res.user_id, email: res.email, tokenHash: res.token_hash, linkError: res.link_error }
      }

      // Step two. The account exists whatever happens here, so a failure is
      // reported rather than thrown — the link view still has to appear.
      if (spaceIds.length) {
        try {
          await applyUserSpaces(created.userId, spaceIds, [])
        } catch (err) {
          setError(`Account created, but adding it to spaces failed: ${messageOf(err)} — fix it from People.`)
        }
      }
      await settle()
      return created
    })

  const passwordLink = (userId: string) =>
    write(async () => {
      if (!live) {
        if (!SEED_ACCOUNTS.some((a) => a.id === userId)) throw new Error('No such user.')
        return `seed-token-${userId}-${Date.now().toString(36)}`
      }
      const res = await invokeAdmin<{ token_hash: string }>({ action: 'password_link', user_id: userId })
      return res.token_hash
    })

  return {
    users: snapshot.users,
    spaces: snapshot.spaces,
    loading,
    error,
    clearError: () => setError(null),
    refresh,
    createAccount,
    passwordLink,
    saveSpace,
    setUserSpaces,
    setDisplayName,
    setSpaceNames,
  }
}
