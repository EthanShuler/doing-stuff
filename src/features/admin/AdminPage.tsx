import { useState } from 'react'
import { Button, SegmentedControl, Text } from '@mantine/core'
import { Navigate } from 'react-router'
import { colors, fonts, text } from '../../theme'
import { useSpaceContext } from '../../data/useSpace'
import { ControlBar } from '../../components/ControlBar'
import { EmptyCard } from '../../components/EmptyCard'
import { FloatingBanner } from '../../components/FloatingBanner'
import { PageFrame } from '../../components/PageFrame'
import { Splash } from '../../components/Splash'
import type { AdminSpace, AdminUser } from './derive'
import { useAdminStore } from './useAdminStore'
import { PeopleList, SpaceList } from './AdminRows'
import { NewAccountModal } from './NewAccountModal'
import { PersonModal } from './PersonModal'
import { SpaceModal } from './SpaceModal'

/** `/admin` — accounts, spaces and per-space features. Not a feature (no
 *  space gates it), and reachable by the admin even when they're in no space;
 *  anyone else bounces to the hub before the admin RPCs are ever called. */
export function AdminPage() {
  const { isAdmin } = useSpaceContext()
  if (!isAdmin) return <Navigate to="/" replace />
  return <AdminScreen />
}

type Screen = 'people' | 'spaces'

/** Which modal is up. Each open bumps `session`, the modals' key, so every
 *  open mounts a fresh form from the row as it is now; `opened` going false
 *  (same key) lets the close transition play. */
type ModalState =
  | { kind: 'none' }
  | { kind: 'new-account' }
  | { kind: 'person'; userId: string }
  | { kind: 'space'; spaceId: string | null }

function AdminScreen() {
  const store = useAdminStore()
  const [screen, setScreen] = useState<Screen>('people')
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const [opened, setOpened] = useState(false)
  const [session, setSession] = useState(0)

  const open = (next: ModalState) => {
    setModal(next)
    setSession((n) => n + 1)
    setOpened(true)
  }
  const close = () => setOpened(false)

  const personUser: AdminUser | undefined =
    modal.kind === 'person' ? store.users.find((u) => u.id === modal.userId) : undefined
  const editingSpace: AdminSpace | null =
    modal.kind === 'space' && modal.spaceId ? (store.spaces.find((s) => s.id === modal.spaceId) ?? null) : null

  return (
    <>
      <title>Admin · cajubinile.com</title>
      <FloatingBanner message={store.error} tone="error" onDismiss={store.clearError} />

      <PageFrame>
        <ControlBar
          left={
            <SegmentedControl
              value={screen}
              onChange={(value) => setScreen(value as Screen)}
              data={[
                { label: 'People', value: 'people' },
                { label: 'Spaces', value: 'spaces' },
              ]}
            />
          }
          right={
            screen === 'people' ? (
              <Button onClick={() => open({ kind: 'new-account' })}>+ New account</Button>
            ) : (
              <Button onClick={() => open({ kind: 'space', spaceId: null })}>+ New space</Button>
            )
          }
        />

        {store.loading ? (
          <Splash text="Loading accounts…" mih="40vh" />
        ) : screen === 'people' ? (
          store.users.length ? (
            <PeopleList
              users={store.users}
              spaces={store.spaces}
              onOpen={(user) => open({ kind: 'person', userId: user.id })}
            />
          ) : (
            <EmptyCard title="No accounts" blurb="Couldn’t list anyone — try reloading the page." />
          )
        ) : store.spaces.length ? (
          <SpaceList
            spaces={store.spaces}
            users={store.users}
            onOpen={(space) => open({ kind: 'space', spaceId: space.id })}
          />
        ) : (
          <EmptyCard title="No spaces yet" blurb="Use + New space to add one." />
        )}

        <Text fz={text.caption} c={colors.faint} mt={20} style={{ fontFamily: fonts.sans }}>
          Delete spaces and accounts in Supabase for now.
        </Text>
      </PageFrame>

      {modal.kind === 'new-account' && (
        <NewAccountModal key={session} opened={opened} spaces={store.spaces} store={store} onClose={close} />
      )}
      {modal.kind === 'person' && personUser && (
        <PersonModal
          key={session}
          opened={opened}
          user={personUser}
          spaces={store.spaces}
          store={store}
          onClose={close}
        />
      )}
      {modal.kind === 'space' && (
        <SpaceModal
          key={session}
          opened={opened}
          space={editingSpace}
          users={store.users}
          store={store}
          onClose={close}
        />
      )}
    </>
  )
}
