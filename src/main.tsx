import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import App from './App.tsx'
import { ConfirmProvider } from './components/ConfirmModal'
import { ErrorBoundary } from './components/ErrorBoundary'
import { mantineTheme } from './mantineTheme'
import './index.css'

// A tab left open across a deploy still points at the old hashed chunks, which
// Cloudflare now answers with index.html — so the next lazy route or map fails
// to import. Vite fires this event for exactly that; reload onto the new build.
// The sessionStorage stamp stops a reload loop if the chunk is genuinely
// broken: a second failure within a minute falls through to the ErrorBoundary.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'preload-reload-at'
  let last = 0
  try {
    last = Number(sessionStorage.getItem(KEY) ?? 0)
  } catch {
    // storage blocked — reload anyway, once per event
  }
  if (Date.now() - last < 60_000) return
  try {
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // ignore
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={mantineTheme}>
      {/* Inside the provider so the confirm dialog is themed; outside the
          router so any feature page can await one. */}
      <ErrorBoundary>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ErrorBoundary>
    </MantineProvider>
  </StrictMode>,
)
