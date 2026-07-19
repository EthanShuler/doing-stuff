import { useRef, useState } from 'react'

/** Double-submit protection for async save handlers: `run` no-ops while a
 *  previous call is in flight, and `busy` drives the button's loading state.
 *  The ref — not `busy` — is the guard, so two clicks landing in the same
 *  frame can't both get through before React re-renders. */
export function useBusy() {
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      await action()
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  return { busy, run }
}
