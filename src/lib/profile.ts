import type { Profile } from '../types'

/** A member's short display label: their display name, else the local part of
 *  their email, else ''. Callers supply their own fallback for the empty case
 *  (e.g. `displayNameFor(partner) || 'Partner'`). */
export function displayNameFor(profile: Profile | null | undefined): string {
  if (!profile) return ''
  return profile.displayName || (profile.email ? profile.email.split('@')[0] : '')
}
