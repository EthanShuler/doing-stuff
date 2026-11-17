import { Text } from '@mantine/core'
import { Navigate } from 'react-router'
import { PageFrame } from '../../components/PageFrame'
import { useSpaceContext } from '../../data/useSpace'
import { colors } from '../../theme'

/** `/admin` — accounts, spaces and per-space features. A stub until the admin
 *  page proper lands; the route and the menu link already exist. Not a feature
 *  (no space gates it): anyone who isn't the admin bounces to the hub. */
export function AdminPage() {
  const { isAdmin } = useSpaceContext()
  if (!isAdmin) return <Navigate to="/" replace />
  return (
    <PageFrame>
      <title>Admin · cajubinile.com</title>
      <Text c={colors.muted}>Accounts, spaces and features will be managed here.</Text>
    </PageFrame>
  )
}
