import { type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { Sidebar } from './sidebar'
import { Header } from './header'

interface AppShellProps {
  children: ReactNode
  title?: string
  breadcrumbs?: { label: string; href?: string }[]
  actions?: ReactNode
}

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/campaigns': 'Campaigns',
  '/ads': 'Ad Library',
  '/generate': 'Generate Ads',
  '/calendar': 'Content Calendar',
  '/analytics': 'Analytics',
  '/brand-voice': 'Brand Voice',
  '/connections': 'Connections',
  '/ab-testing': 'A/B Testing',
  '/settings': 'Settings',
}

export function AppShell({ children, title, breadcrumbs, actions }: AppShellProps) {
  const [location] = useLocation()

  const resolvedTitle =
    title ??
    ROUTE_TITLES[location] ??
    (location.startsWith('/campaigns/') ? 'Campaign Detail' : 'Viralix')

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Sidebar />
      <div
        style={{
          marginLeft: 'var(--sidebar-width)',
          paddingTop: 'var(--header-height)',
          minHeight: '100vh',
        }}
      >
        <Header title={resolvedTitle} breadcrumbs={breadcrumbs} actions={actions} />
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  )
}

export default AppShell
