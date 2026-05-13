import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Sidebar } from './sidebar'
import { Header } from './header'

interface AppShellProps {
  children: ReactNode
  title?: string
  breadcrumbs?: { label: string; href?: string }[]
  actions?: ReactNode
}

/**
 * AppShell is used in two modes:
 * 1. As a route-level layout wrapper (App.tsx) — no title prop, just provides sidebar
 * 2. As a page-level wrapper with title/breadcrumbs
 */
export function AppShell({ children, title, breadcrumbs, actions }: AppShellProps) {
  const showHeader = title !== undefined

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Sidebar />
      <div
        style={{
          marginLeft: 'var(--sidebar-width)',
          paddingTop: showHeader ? 'var(--header-height)' : undefined,
          minHeight: '100vh',
        }}
      >
        {showHeader && (
          <Header title={title!} breadcrumbs={breadcrumbs} actions={actions} />
        )}
        {title ? (
          <motion.main
            className="p-6"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {children}
          </motion.main>
        ) : (
          // Route-level wrapper: just render children (pages manage their own padding)
          <>{children}</>
        )}
      </div>
    </div>
  )
}

export default AppShell
