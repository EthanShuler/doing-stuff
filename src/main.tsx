import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import App from './App.tsx'
import { ConfirmProvider } from './components/ConfirmModal'
import { mantineTheme } from './mantineTheme'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={mantineTheme}>
      {/* Inside the provider so the confirm dialog is themed; outside the
          router so any feature page can await one. */}
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </MantineProvider>
  </StrictMode>,
)
