import { Bell, ChevronRight } from 'lucide-react'
import { Link } from 'wouter'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { useAuth } from '../../lib/hooks/use-auth'
import { getInitials } from '../../lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface HeaderProps {
  title: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
}

export function Header({ title, breadcrumbs, actions }: HeaderProps) {
  const { user, logout } = useAuth()

  return (
    <header
      className="fixed top-0 right-0 z-30 flex items-center justify-between px-6 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.9)] backdrop-blur-md"
      style={{
        left: 'var(--sidebar-width)',
        height: 'var(--header-height)',
      }}
    >
      {/* Left: title + breadcrumbs */}
      <div className="flex flex-col">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 mb-0.5">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-[hsl(var(--foreground))] transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-base font-semibold text-[hsl(var(--foreground))]">{title}</h1>
      </div>

      {/* Right: actions + notifications + user */}
      <div className="flex items-center gap-2">
        {actions}

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[hsl(var(--accent))] transition-colors">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {user ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                {user?.name?.split(' ')[0] ?? 'User'}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-semibold">{user?.name}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-[hsl(var(--destructive))] focus:text-[hsl(var(--destructive))]"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
