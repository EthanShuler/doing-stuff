import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button, Center, Stack, Text } from '@mantine/core'
import { colors, fonts, text } from '../theme'

/** Catches render-time throws — including a lazy route or map chunk that
 *  fails to load (a tab left open across a deploy asks for a hashed chunk
 *  that's gone) — so one broken page shows a Reload button instead of
 *  unmounting the whole app to a white screen. Changing `resetKey` (AppLayout
 *  passes the pathname) clears the error, so navigating elsewhere recovers. */
export class ErrorBoundary extends Component<
  { children: ReactNode; resetKey?: string; mih?: string },
  { error: Error | null; resetKey?: string }
> {
  state: { error: Error | null; resetKey?: string } = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  static getDerivedStateFromProps(
    props: { resetKey?: string },
    state: { error: Error | null; resetKey?: string },
  ) {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <Center mih={this.props.mih ?? '100vh'} bg={colors.pageBg} p={24}>
        <Stack align="center" gap={12} style={{ fontFamily: fonts.sans }}>
          <Text c={colors.ink} fw={600}>
            Something went wrong loading this page.
          </Text>
          <Text c={colors.muted} fz={text.small} ta="center" maw={360}>
            If the site was just updated, a reload picks up the new version.
          </Text>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </Stack>
      </Center>
    )
  }
}
